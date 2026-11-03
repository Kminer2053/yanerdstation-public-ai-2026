import crypto from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const SHA256_PATTERN = /^[a-f0-9]{64}$/i;
const FORMAT_EXTENSION = Object.freeze({ jpeg: ".jpg", png: ".png", webp: ".webp" });
const FORMAT_MIME = Object.freeze({ jpeg: "image/jpeg", png: "image/png", webp: "image/webp" });

export async function loadReplacementManifest(replacementRoot) {
  const manifestPath = path.join(replacementRoot, "replacements.json");
  const fallback = { schema_version: "1.0", updated_at: null, entries: [] };
  try {
    const parsed = JSON.parse(await fs.readFile(manifestPath, "utf8"));
    return { ...fallback, ...parsed, entries: Array.isArray(parsed.entries) ? parsed.entries : [] };
  } catch (error) {
    if (error.code === "ENOENT") return fallback;
    throw error;
  }
}

export async function saveCatalogReplacement({ catalogPath, replacementRoot, payload, fileBuffer, publicRoot }) {
  const sha = String(payload.imageSha256 || "").toLowerCase();
  if (!SHA256_PATTERN.test(sha)) throw httpError(400, "올바른 이미지 해시가 아닙니다.");
  if (!Buffer.isBuffer(fileBuffer) || !fileBuffer.length) throw httpError(400, "교체 이미지 파일이 비어 있습니다.");

  const catalog = JSON.parse(await fs.readFile(catalogPath, "utf8"));
  const original = catalog.find((row) => String(row.image_sha256).toLowerCase() === sha && !row.placeholder);
  if (!original) throw httpError(404, "카탈로그에서 원본 이미지를 찾지 못했습니다.");

  let metadata;
  try {
    metadata = await sharp(fileBuffer, { failOn: "error" }).metadata();
  } catch {
    throw httpError(400, "PNG, JPEG 또는 WebP 이미지 파일만 등록할 수 있습니다.");
  }
  const extension = FORMAT_EXTENSION[metadata.format];
  if (!extension || !metadata.width || !metadata.height) {
    throw httpError(400, "PNG, JPEG 또는 WebP 이미지 파일만 등록할 수 있습니다.");
  }
  if (metadata.width !== Number(original.width_px) || metadata.height !== Number(original.height_px)) {
    throw httpError(
      422,
      `이미지 규격이 다릅니다. 원본 ${original.width_px}×${original.height_px}px, 등록 파일 ${metadata.width}×${metadata.height}px`,
    );
  }

  const timestamp = new Date().toISOString();
  const stamp = timestamp.replace(/[-:.TZ]/g, "");
  const suppliedName = path.basename(String(payload.fileName || "replacement"), path.extname(String(payload.fileName || "")));
  const safeName = suppliedName.normalize("NFKC").replace(/[^0-9A-Za-z가-힣_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "replacement";
  const versionId = `${stamp}-${crypto.randomUUID().slice(0, 8)}`;
  const relativeFile = path.posix.join(sha, `${versionId}-${safeName}${extension}`);
  const target = path.join(replacementRoot, ...relativeFile.split("/"));
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, fileBuffer, { flag: "wx" });

  const entry = {
    version_id: versionId,
    image_sha256: sha,
    image_id: String(payload.imageId || original.image_id),
    original_width_px: Number(original.width_px),
    original_height_px: Number(original.height_px),
    replacement_width_px: metadata.width,
    replacement_height_px: metadata.height,
    replacement_mime_type: FORMAT_MIME[metadata.format],
    replacement_byte_length: fileBuffer.length,
    replacement_sha256: crypto.createHash("sha256").update(fileBuffer).digest("hex"),
    replacement_file: relativeFile,
    replacement_url: publicRoot ? `${publicRoot.replace(/\/$/, "")}/${relativeFile}` : null,
    current_store_name: cleanText(payload.currentStoreName, 120),
    note: cleanText(payload.note, 600),
    usage_floor: cleanText(payload.floor, 20),
    usage_model: cleanText(payload.modelName, 160),
    usage_td_id: cleanText(payload.tdId, 180),
    created_at: timestamp,
  };

  const manifest = await loadReplacementManifest(replacementRoot);
  manifest.updated_at = timestamp;
  manifest.entries.push(entry);
  const manifestPath = path.join(replacementRoot, "replacements.json");
  const tempPath = `${manifestPath}.${process.pid}.tmp`;
  await fs.mkdir(replacementRoot, { recursive: true });
  await fs.writeFile(tempPath, `${JSON.stringify(manifest, null, 2)}\n`);
  await fs.rename(tempPath, manifestPath);
  return entry;
}

function cleanText(value, maxLength) {
  return String(value || "").normalize("NFKC").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, maxLength);
}

function httpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}
