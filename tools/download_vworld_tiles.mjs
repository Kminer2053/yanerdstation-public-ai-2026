import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

const [planPath, outputDir] = process.argv.slice(2);
if (!planPath || !outputDir) {
  console.error("Usage: node tools/download_vworld_tiles.mjs <collection-plan.json> <output-dir>");
  process.exit(1);
}

const plan = JSON.parse(await fs.readFile(planPath, "utf8"));
await fs.mkdir(outputDir, { recursive: true });
const concurrency = 8;
const retries = 4;
const timeoutMs = 90_000;
let cursor = 0;
let completed = 0;
let skipped = 0;
const results = new Array(plan.steps.length);

const sha256 = (data) => crypto.createHash("sha256").update(data).digest("hex");
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function existingResult(step, index) {
  const bodyPath = path.join(outputDir, `${step.id}.bin`);
  const metadataPath = path.join(outputDir, `${step.id}.json`);
  try {
    const stat = await fs.stat(bodyPath);
    if (stat.size < 28) return null;
    const data = await fs.readFile(bodyPath);
    if (data.subarray(0, 4).toString("ascii") !== "b3dm") return null;
    skipped += 1;
    return { index, id: step.id, url: step.url, status: 200, bytes: data.length, sha256: sha256(data), body_path: bodyPath, metadata_path: metadataPath, skipped: true };
  } catch {
    return null;
  }
}

async function download(step, index) {
  const prior = await existingResult(step, index);
  if (prior) return prior;
  let lastError = null;
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(step.url, {
        headers: { "user-agent": plan.user_agent ?? "Mozilla/5.0 CodexResearch/1.0" },
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = Buffer.from(await response.arrayBuffer());
      if (data.subarray(0, 4).toString("ascii") !== "b3dm") throw new Error("invalid b3dm magic");
      const record = {
        kind: "binary",
        status: response.status,
        url: step.url,
        final_url: response.url,
        content_type: response.headers.get("content-type"),
        bytes: data.length,
        sha256: sha256(data),
        fetched_at: new Date().toISOString(),
        attempt,
      };
      const bodyPath = path.join(outputDir, `${step.id}.bin`);
      const metadataPath = path.join(outputDir, `${step.id}.json`);
      await fs.writeFile(bodyPath, data);
      await fs.writeFile(metadataPath, `${JSON.stringify(record, null, 2)}\n`);
      return { index, id: step.id, url: step.url, ...record, body_path: bodyPath, metadata_path: metadataPath, skipped: false };
    } catch (error) {
      lastError = error;
      if (attempt < retries) await wait(700 * attempt);
    } finally {
      clearTimeout(timer);
    }
  }
  return { index, id: step.id, url: step.url, error: String(lastError) };
}

async function worker() {
  while (true) {
    const index = cursor;
    cursor += 1;
    if (index >= plan.steps.length) return;
    results[index] = await download(plan.steps[index], index);
    completed += 1;
    if (completed % 25 === 0 || completed === plan.steps.length) {
      const failures = results.slice(0, completed).filter((result) => result?.error).length;
      console.log(JSON.stringify({ completed, total: plan.steps.length, skipped, failures }));
    }
  }
}

await Promise.all(Array.from({ length: concurrency }, () => worker()));
const summary = {
  plan_name: plan.name,
  completed_at: new Date().toISOString(),
  total: results.length,
  succeeded: results.filter((result) => result && !result.error).length,
  failed: results.filter((result) => result?.error).length,
  skipped,
  results,
};
await fs.writeFile(path.join(outputDir, "plan-result.json"), `${JSON.stringify(summary, null, 2)}\n`);
console.log(JSON.stringify({ total: summary.total, succeeded: summary.succeeded, failed: summary.failed, skipped }));
if (summary.failed) process.exitCode = 2;
