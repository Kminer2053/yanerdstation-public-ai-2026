import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const [inputDir, outputDir] = process.argv.slice(2);
if (!inputDir || !outputDir) {
  throw new Error("Usage: node tools/extract_b3dm_assets.mjs INPUT_DIR OUTPUT_DIR");
}

fs.mkdirSync(outputDir, { recursive: true });

const sha256 = (buffer) => crypto.createHash("sha256").update(buffer).digest("hex");
const uint32 = (buffer, offset) => buffer.readUInt32LE(offset);
const cleanJson = (buffer) => JSON.parse(buffer.toString("utf8").replace(/^\uFEFF/, "").replace(/\0+$/g, "").trim());

function parseB3dm(filePath) {
  const bytes = fs.readFileSync(filePath);
  if (bytes.subarray(0, 4).toString("ascii") !== "b3dm") throw new Error(`${filePath}: invalid b3dm magic`);

  const featureJsonLength = uint32(bytes, 12);
  const featureBinaryLength = uint32(bytes, 16);
  const batchJsonLength = uint32(bytes, 20);
  const batchBinaryLength = uint32(bytes, 24);
  let offset = 28;
  const featureTable = featureJsonLength ? cleanJson(bytes.subarray(offset, offset + featureJsonLength)) : {};
  offset += featureJsonLength + featureBinaryLength;
  const batchTable = batchJsonLength ? cleanJson(bytes.subarray(offset, offset + batchJsonLength)) : {};
  offset += batchJsonLength + batchBinaryLength;

  const glb = bytes.subarray(offset);
  if (glb.subarray(0, 4).toString("ascii") !== "glTF") throw new Error(`${filePath}: embedded GLB not found`);
  const chunks = [];
  let chunkOffset = 12;
  while (chunkOffset + 8 <= glb.length) {
    const length = uint32(glb, chunkOffset);
    const type = uint32(glb, chunkOffset + 4);
    const data = glb.subarray(chunkOffset + 8, chunkOffset + 8 + length);
    chunks.push({ type, data });
    chunkOffset += 8 + length;
  }
  const jsonChunk = chunks.find((chunk) => chunk.type === 0x4e4f534a);
  const binaryChunk = chunks.find((chunk) => chunk.type === 0x004e4942);
  if (!jsonChunk) throw new Error(`${filePath}: GLB JSON chunk not found`);
  const gltf = cleanJson(jsonChunk.data);

  return { bytes, featureTable, batchTable, gltf, binary: binaryChunk?.data ?? Buffer.alloc(0) };
}

function extensionFor(mimeType) {
  if (mimeType === "image/jpeg") return "jpg";
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/ktx2") return "ktx2";
  return "bin";
}

const files = fs.readdirSync(inputDir)
  .filter((name) => name.endsWith(".bin"))
  .sort();

const inventory = [];
for (const fileName of files) {
  const tileName = path.basename(fileName, ".bin");
  const tileDir = path.join(outputDir, tileName);
  fs.mkdirSync(tileDir, { recursive: true });
  const parsed = parseB3dm(path.join(inputDir, fileName));
  const images = [];

  for (const [index, image] of (parsed.gltf.images ?? []).entries()) {
    if (image.bufferView === undefined) continue;
    const view = parsed.gltf.bufferViews?.[image.bufferView];
    if (!view) continue;
    const start = view.byteOffset ?? 0;
    const data = parsed.binary.subarray(start, start + view.byteLength);
    const extension = extensionFor(image.mimeType);
    const outputName = `image-${String(index).padStart(2, "0")}.${extension}`;
    fs.writeFileSync(path.join(tileDir, outputName), data);
    images.push({
      index,
      outputName,
      mimeType: image.mimeType ?? null,
      byteLength: data.length,
      sha256: sha256(data),
    });
  }

  const primitives = (parsed.gltf.meshes ?? []).flatMap((mesh, meshIndex) =>
    (mesh.primitives ?? []).map((primitive, primitiveIndex) => ({
      meshIndex,
      primitiveIndex,
      material: primitive.material ?? null,
      attributes: Object.keys(primitive.attributes ?? {}),
      dracoAttributes: Object.keys(primitive.extensions?.KHR_draco_mesh_compression?.attributes ?? {}),
    })),
  );

  const record = {
    tile: tileName,
    tileSha256: sha256(parsed.bytes),
    featureTable: parsed.featureTable,
    batchTable: parsed.batchTable,
    gltf: {
      asset: parsed.gltf.asset,
      extensionsUsed: parsed.gltf.extensionsUsed ?? [],
      imageCount: parsed.gltf.images?.length ?? 0,
      textureCount: parsed.gltf.textures?.length ?? 0,
      materialCount: parsed.gltf.materials?.length ?? 0,
      meshCount: parsed.gltf.meshes?.length ?? 0,
      images,
      textures: parsed.gltf.textures ?? [],
      materials: parsed.gltf.materials ?? [],
      primitives,
    },
  };
  fs.writeFileSync(path.join(tileDir, "metadata.json"), `${JSON.stringify(record, null, 2)}\n`);
  inventory.push(record);
}

fs.writeFileSync(path.join(outputDir, "inventory.json"), `${JSON.stringify(inventory, null, 2)}\n`);
console.log(JSON.stringify(inventory.map((item) => ({
  tile: item.tile,
  floors: item.batchTable.FLOOR ?? [],
  models: item.batchTable.MODEL_NAME ?? [],
  featureCount: item.featureTable.BATCH_LENGTH ?? 0,
  imageCount: item.gltf.imageCount,
  images: item.gltf.images,
  primitiveCount: item.gltf.primitives.length,
})), null, 2));
