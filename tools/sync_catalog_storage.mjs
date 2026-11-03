import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

const [localDir, bucket, remotePrefix = ""] = process.argv.slice(2);
if (!localDir || !bucket) {
  throw new Error("Usage: node tools/sync_catalog_storage.mjs <local-dir> <bucket> [remote-prefix]");
}

const localFiles = (await fs.readdir(localDir, { withFileTypes: true }))
  .filter((entry) => entry.isFile())
  .map((entry) => entry.name)
  .sort();

const remotePath = remotePrefix ? `ss:///${bucket}/${remotePrefix}` : `ss:///${bucket}`;
const listOutput = execFileSync(
  "supabase",
  ["storage", "ls", remotePath, "-r", "--linked", "--experimental"],
  { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 },
);
const remoteFiles = new Set(listOutput
  .split(/\r?\n/)
  .map((line) => path.basename(line.trim()))
  .filter(Boolean));

const missing = localFiles.filter((name) => !remoteFiles.has(name));
let uploaded = 0;
for (let start = 0; start < missing.length; start += 50) {
  const batch = missing.slice(start, start + 50);
  const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "station-one-storage-"));
  const batchDir = path.join(temporaryRoot, remotePrefix || "files");
  await fs.mkdir(batchDir, { recursive: true });
  for (const name of batch) await fs.copyFile(path.join(localDir, name), path.join(batchDir, name));
  try {
    execFileSync(
      "supabase",
      ["storage", "cp", "-r", batchDir, `ss:///${bucket}`, "--linked", "--experimental", "--jobs", "1"],
      { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"], maxBuffer: 32 * 1024 * 1024 },
    );
  } finally {
    await fs.rm(temporaryRoot, { recursive: true, force: true });
  }
  uploaded += batch.length;
  console.log(JSON.stringify({ uploaded, missingAtStart: missing.length, totalLocal: localFiles.length }));
}

console.log(JSON.stringify({
  bucket,
  remotePrefix,
  localFiles: localFiles.length,
  alreadyPresent: localFiles.length - missing.length,
  uploaded,
  complete: true,
}, null, 2));
