import { createReadStream, promises as fs } from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadReplacementManifest, saveCatalogReplacement } from "./catalog_replacement_store.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = Number(process.env.STATION_ONE_PORT || 4173);
const host = "127.0.0.1";
const catalogDirectory = path.join(projectRoot, "outputs", "20260831_vworld_seoul_image_catalog");
const catalogPath = path.join(catalogDirectory, "image-catalog.json");
const replacementRoot = path.resolve(process.env.CATALOG_REPLACEMENT_ROOT || path.join(catalogDirectory, "replacements"));
const replacementPublicRoot = process.env.CATALOG_REPLACEMENT_ROOT
  ? null
  : "/outputs/20260831_vworld_seoul_image_catalog/replacements";

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".csv": "text/csv; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

function send(res, status, body, headers = {}) {
  res.writeHead(status, { "Content-Type": "text/plain; charset=utf-8", ...headers });
  res.end(body);
}

function sendJson(res, status, value) {
  const body = JSON.stringify(value);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store",
  });
  res.end(body);
}

async function readJsonBody(req, maxBytes = 24 * 1024 * 1024) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > maxBytes) {
      const error = new Error("업로드 파일이 너무 큽니다. 18MB 이하 이미지를 사용하세요.");
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    const error = new Error("요청 데이터 형식을 읽을 수 없습니다.");
    error.statusCode = 400;
    throw error;
  }
}

let replacementWriteQueue = Promise.resolve();

const server = http.createServer(async (req, res) => {
  try {
    const requestUrl = new URL(req.url || "/", `http://${req.headers.host || host}`);
    if (requestUrl.pathname === "/health") {
      send(res, 200, "ok", { "Cache-Control": "no-store" });
      return;
    }
    if (requestUrl.pathname === "/api/catalog/replacements") {
      if (req.method === "GET") {
        sendJson(res, 200, await loadReplacementManifest(replacementRoot));
        return;
      }
      if (req.method === "POST") {
        const payload = await readJsonBody(req);
        const base64 = String(payload.dataBase64 || "").replace(/^data:image\/[^;]+;base64,/, "");
        const fileBuffer = Buffer.from(base64, "base64");
        const operation = replacementWriteQueue.then(() => saveCatalogReplacement({
          catalogPath,
          replacementRoot,
          payload,
          fileBuffer,
          publicRoot: replacementPublicRoot,
        }));
        replacementWriteQueue = operation.catch(() => {});
        sendJson(res, 201, { ok: true, entry: await operation });
        return;
      }
      sendJson(res, 405, { ok: false, error: "GET 또는 POST만 사용할 수 있습니다." });
      return;
    }
    if (requestUrl.pathname === "/") {
      res.writeHead(302, { Location: "/app/" });
      res.end();
      return;
    }

    let relativePath = decodeURIComponent(requestUrl.pathname).replace(/^\/+/, "");
    let resolved = path.resolve(projectRoot, relativePath);
    if (!resolved.startsWith(`${projectRoot}${path.sep}`) && resolved !== projectRoot) {
      send(res, 403, "Forbidden");
      return;
    }

    let stat = await fs.stat(resolved).catch(() => null);
    if (stat?.isDirectory()) {
      resolved = path.join(resolved, "index.html");
      stat = await fs.stat(resolved).catch(() => null);
    }
    if (!stat?.isFile()) {
      send(res, 404, "Not found");
      return;
    }

    res.writeHead(200, {
      "Content-Type": mimeTypes[path.extname(resolved).toLowerCase()] || "application/octet-stream",
      "Content-Length": stat.size,
      "Cache-Control": "no-store",
    });
    createReadStream(resolved).pipe(res);
  } catch (error) {
    if (req.url?.startsWith("/api/")) {
      sendJson(res, error.statusCode || 500, { ok: false, error: error.message });
    } else {
      send(res, 500, `Internal server error: ${error.message}`);
    }
  }
});

server.listen(port, host, () => {
  console.log(`STATION ONE dev server: http://${host}:${port}/app/`);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
