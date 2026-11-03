import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { loadReplacementManifest, saveCatalogReplacement } from "./catalog_replacement_store.mjs";

const testRoot = await fs.mkdtemp(path.join(os.tmpdir(), "station-one-replacements-"));
try {
  const catalogPath = path.join(testRoot, "image-catalog.json");
  const replacementRoot = path.join(testRoot, "replacements");
  const imageSha256 = "a".repeat(64);
  await fs.writeFile(catalogPath, JSON.stringify([{
    image_sha256: imageSha256,
    image_id: "TEST:I000",
    width_px: 128,
    height_px: 64,
    placeholder: false,
  }]));
  const exactImage = await sharp({
    create: { width: 128, height: 64, channels: 3, background: "#20c9d8" },
  }).png().toBuffer();
  const saved = await saveCatalogReplacement({
    catalogPath,
    replacementRoot,
    publicRoot: "/test/replacements",
    fileBuffer: exactImage,
    payload: {
      imageSha256,
      imageId: "TEST:I000",
      fileName: "서울역 새 파사드.png",
      currentStoreName: "테스트 매장",
      note: "동일 규격 저장 검증",
      floor: "2F",
    },
  });
  assert.equal(saved.replacement_width_px, 128);
  assert.equal(saved.replacement_height_px, 64);
  assert.equal(saved.current_store_name, "테스트 매장");
  assert.match(saved.replacement_url, /^\/test\/replacements\//);
  assert.equal((await loadReplacementManifest(replacementRoot)).entries.length, 1);
  await fs.access(path.join(replacementRoot, saved.replacement_file));

  const wrongImage = await sharp({
    create: { width: 127, height: 64, channels: 3, background: "#ff6278" },
  }).png().toBuffer();
  await assert.rejects(
    saveCatalogReplacement({
      catalogPath,
      replacementRoot,
      fileBuffer: wrongImage,
      payload: { imageSha256, fileName: "wrong.png" },
    }),
    (error) => error.statusCode === 422 && /원본 128×64px/.test(error.message),
  );
  console.log(JSON.stringify({ passed: true, saved: saved.replacement_file, rejectedWrongDimensions: true }));
} finally {
  await fs.rm(testRoot, { recursive: true, force: true });
}
