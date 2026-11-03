import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import sharp from "sharp";

const [tilesDir, tileIndexPath, outputDir, vendorDir, siteConfigPath] = process.argv.slice(2);
if (!tilesDir || !tileIndexPath || !outputDir || !vendorDir) {
  console.error("Usage: node tools/build_vworld_image_catalog.mjs <tiles-dir> <tile-index.json> <output-dir> <vendor-dir> [site-config.json]");
  process.exit(1);
}

const siteConfig = siteConfigPath
  ? JSON.parse(fs.readFileSync(siteConfigPath, "utf8"))
  : {
      site_id: "S202103",
      site_name: "서울역KTX",
      source_base: "https://cdn.vworld.kr/TDServer/services/map4/7Iuk64K0/S202103/",
      origin: { lon: 126.97082, lat: 37.55363, height: 27.2 },
      source_observed_at: "2026-08-31",
      id_prefix: "",
    };
const SITE_ORIGIN = siteConfig.origin;
const SOURCE_BASE = String(siteConfig.source_base).replace(/\/?$/, "/");
const SOURCE_OBSERVED_AT = siteConfig.source_observed_at || new Date().toISOString().slice(0, 10);
const ID_PREFIX = siteConfig.id_prefix ?? (siteConfig.site_id === "S202103" ? "" : `${siteConfig.site_id}:`);
const imageId = (tileName, index) => `${ID_PREFIX}${tileName}:I${String(index).padStart(3, "0")}`;
const featureKey = (tileName, index) => `${ID_PREFIX}${tileName}:F${String(index).padStart(3, "0")}`;
const tileIndex = JSON.parse(fs.readFileSync(tileIndexPath, "utf8"));
const tileMetaByName = new Map(tileIndex.map((row) => [path.basename(row.uri, path.extname(row.uri)), row]));
const require = createRequire(import.meta.url);
const dracoFactory = require(path.resolve(vendorDir, "node_modules/draco3dgltf/draco3dgltf.js"));
const draco = await dracoFactory.createDecoderModule({});

const texturesRoot = path.resolve(vendorDir, "node_modules/@loaders.gl/textures/dist");
const basisCjsPath = path.resolve(vendorDir, "basis_encoder.cjs");
if (!fs.existsSync(basisCjsPath)) fs.copyFileSync(path.join(texturesRoot, "libs/basis_encoder.js"), basisCjsPath);
const basisFactory = require(basisCjsPath);
const basisModule = await basisFactory({ wasmBinary: fs.readFileSync(path.join(texturesRoot, "libs/basis_encoder.wasm")) });
basisModule.initializeBasis();
const loadersCore = await import(pathToFileURL(path.resolve(vendorDir, "node_modules/@loaders.gl/core/dist/index.js")));
const loadersTextures = await import(pathToFileURL(path.join(texturesRoot, "index.js")));

await fsp.mkdir(path.join(outputDir, "assets"), { recursive: true });
await fsp.mkdir(path.join(outputDir, "previews"), { recursive: true });

const sha256 = (buffer) => crypto.createHash("sha256").update(buffer).digest("hex");
const uint32 = (buffer, offset) => buffer.readUInt32LE(offset);
const cleanJson = (buffer) => JSON.parse(buffer.toString("utf8").replace(/^\uFEFF/, "").replace(/\0+$/g, "").trim());
const radiansToDegrees = (radians) => radians * 180 / Math.PI;
const round = (value, digits = 8) => Number.isFinite(value) ? Number(value.toFixed(digits)) : null;

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
  const chunks = [];
  for (let chunkOffset = 12; chunkOffset + 8 <= glb.length;) {
    const length = uint32(glb, chunkOffset);
    const type = uint32(glb, chunkOffset + 4);
    chunks.push({ type, data: glb.subarray(chunkOffset + 8, chunkOffset + 8 + length) });
    chunkOffset += 8 + length;
  }
  const jsonChunk = chunks.find((chunk) => chunk.type === 0x4e4f534a);
  const binaryChunk = chunks.find((chunk) => chunk.type === 0x004e4942);
  if (!jsonChunk) throw new Error(`${filePath}: GLB JSON missing`);
  return { bytes, featureTable, batchTable, gltf: cleanJson(jsonChunk.data), binary: binaryChunk?.data ?? Buffer.alloc(0) };
}

function imageExtension(mimeType) {
  if (mimeType === "image/jpeg") return "jpg";
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/ktx2") return "ktx2";
  return "bin";
}

function identityMatrix() {
  return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
}

// VWorld's GLB root uses this matrix to convert its authored tile-local axes for
// rendering. The authored POSITION values themselves are the offsets that must
// be added to B3DM RTC_CENTER for ECEF placement. Applying this renderer matrix
// before RTC_CENTER rotates those ECEF offsets a second time and produces a
// plausible-looking, but wrong, longitude/latitude/height.
const VWORLD_RENDERER_AXIS_MATRIX = [
  1, 0, 0, 0,
  0, 0, -1, 0,
  0, 1, 0, 0,
  0, 0, 0, 1,
];

function matrixEquals(a, b, epsilon = 1e-9) {
  return Array.isArray(a) && a.length === b.length && a.every((value, index) => Math.abs(value - b[index]) <= epsilon);
}

function multiplyMatrices(a, b) {
  const out = new Array(16).fill(0);
  for (let col = 0; col < 4; col += 1) {
    for (let row = 0; row < 4; row += 1) {
      for (let k = 0; k < 4; k += 1) out[col * 4 + row] += a[k * 4 + row] * b[col * 4 + k];
    }
  }
  return out;
}

function matrixFromNode(node) {
  if (node.matrix) return node.matrix.slice();
  const [x, y, z, w] = node.rotation ?? [0, 0, 0, 1];
  const [sx, sy, sz] = node.scale ?? [1, 1, 1];
  const [tx, ty, tz] = node.translation ?? [0, 0, 0];
  const xx = x * x; const yy = y * y; const zz = z * z;
  const xy = x * y; const xz = x * z; const yz = y * z;
  const wx = w * x; const wy = w * y; const wz = w * z;
  return [
    (1 - 2 * (yy + zz)) * sx, (2 * (xy + wz)) * sx, (2 * (xz - wy)) * sx, 0,
    (2 * (xy - wz)) * sy, (1 - 2 * (xx + zz)) * sy, (2 * (yz + wx)) * sy, 0,
    (2 * (xz + wy)) * sz, (2 * (yz - wx)) * sz, (1 - 2 * (xx + yy)) * sz, 0,
    tx, ty, tz, 1,
  ];
}

function transformPoint(matrix, point) {
  const [x, y, z] = point;
  return [
    matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12],
    matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13],
    matrix[2] * x + matrix[6] * y + matrix[10] * z + matrix[14],
  ];
}

function meshTransforms(gltf) {
  const result = new Map();
  const nodes = gltf.nodes ?? [];
  const childIds = new Set(nodes.flatMap((node) => node.children ?? []));
  const roots = (gltf.scenes?.[gltf.scene ?? 0]?.nodes ?? nodes.map((_, index) => index).filter((index) => !childIds.has(index)));
  const seen = new Set();
  function visit(index, parentMatrix, root = false) {
    const node = nodes[index];
    if (!node) return;
    const nodeMatrix = matrixFromNode(node);
    const localMatrix = root && matrixEquals(nodeMatrix, VWORLD_RENDERER_AXIS_MATRIX)
      ? identityMatrix()
      : nodeMatrix;
    const world = multiplyMatrices(parentMatrix, localMatrix);
    if (node.mesh !== undefined) {
      if (!result.has(node.mesh)) result.set(node.mesh, []);
      result.get(node.mesh).push(world);
    }
    seen.add(index);
    for (const child of node.children ?? []) visit(child, world, false);
  }
  for (const root of roots) visit(root, identityMatrix(), true);
  nodes.forEach((_, index) => { if (!seen.has(index)) visit(index, identityMatrix(), true); });
  return result;
}

const COMPONENT_INFO = {
  5120: { bytes: 1, getter: "getInt8" }, 5121: { bytes: 1, getter: "getUint8" },
  5122: { bytes: 2, getter: "getInt16" }, 5123: { bytes: 2, getter: "getUint16" },
  5125: { bytes: 4, getter: "getUint32" }, 5126: { bytes: 4, getter: "getFloat32" },
};
const TYPE_COMPONENTS = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT2: 4, MAT3: 9, MAT4: 16 };

function readAccessor(gltf, binary, accessorIndex) {
  const accessor = gltf.accessors?.[accessorIndex];
  if (!accessor || accessor.bufferView === undefined) return null;
  const view = gltf.bufferViews?.[accessor.bufferView];
  const info = COMPONENT_INFO[accessor.componentType];
  const components = TYPE_COMPONENTS[accessor.type];
  if (!view || !info || !components) return null;
  const stride = view.byteStride ?? info.bytes * components;
  const start = (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
  const dataView = new DataView(binary.buffer, binary.byteOffset, binary.byteLength);
  const rows = [];
  for (let i = 0; i < accessor.count; i += 1) {
    const row = [];
    for (let c = 0; c < components; c += 1) row.push(dataView[info.getter](start + i * stride + c * info.bytes, true));
    rows.push(row);
  }
  return rows;
}

function decodeDracoPrimitive(gltf, binary, primitive) {
  const extension = primitive.extensions?.KHR_draco_mesh_compression;
  if (!extension) return null;
  const view = gltf.bufferViews?.[extension.bufferView];
  if (!view) return null;
  const start = view.byteOffset ?? 0;
  const bytes = binary.subarray(start, start + view.byteLength);
  const decoder = new draco.Decoder();
  const decoderBuffer = new draco.DecoderBuffer();
  decoderBuffer.Init(new Int8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength), bytes.byteLength);
  const geometryType = decoder.GetEncodedGeometryType(decoderBuffer);
  const geometry = geometryType === draco.TRIANGULAR_MESH ? new draco.Mesh() : new draco.PointCloud();
  const status = geometryType === draco.TRIANGULAR_MESH
    ? decoder.DecodeBufferToMesh(decoderBuffer, geometry)
    : decoder.DecodeBufferToPointCloud(decoderBuffer, geometry);
  if (!status.ok() || geometry.ptr === 0) {
    const message = status.error_msg();
    draco.destroy(status); draco.destroy(geometry); draco.destroy(decoderBuffer); draco.destroy(decoder);
    throw new Error(`Draco decode failed: ${message}`);
  }
  function readAttribute(semantic) {
    const uniqueId = extension.attributes?.[semantic];
    if (uniqueId === undefined) return null;
    const attribute = decoder.GetAttributeByUniqueId(geometry, uniqueId);
    if (!attribute || attribute.ptr === 0) return null;
    const values = new draco.DracoFloat32Array();
    decoder.GetAttributeFloatForAllPoints(geometry, attribute, values);
    const components = attribute.num_components();
    const rows = [];
    for (let i = 0; i < geometry.num_points(); i += 1) {
      const row = [];
      for (let c = 0; c < components; c += 1) row.push(values.GetValue(i * components + c));
      rows.push(row);
    }
    draco.destroy(values);
    return rows;
  }
  const indices = [];
  if (geometryType === draco.TRIANGULAR_MESH) {
    const face = new draco.DracoInt32Array();
    for (let faceIndex = 0; faceIndex < geometry.num_faces(); faceIndex += 1) {
      decoder.GetFaceFromMesh(geometry, faceIndex, face);
      indices.push(face.GetValue(0), face.GetValue(1), face.GetValue(2));
    }
    draco.destroy(face);
  }
  const result = {
    positions: readAttribute("POSITION"),
    batchIds: readAttribute("_BATCHID"),
    texCoords0: readAttribute("TEXCOORD_0"),
    texCoords1: readAttribute("TEXCOORD_1"),
    indices,
  };
  draco.destroy(status); draco.destroy(geometry); draco.destroy(decoderBuffer); draco.destroy(decoder);
  return result;
}

function newAggregate() {
  return { count: 0, sum: [0, 0, 0], min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
}

function addPoint(aggregate, point) {
  aggregate.count += 1;
  for (let i = 0; i < 3; i += 1) {
    aggregate.sum[i] += point[i];
    aggregate.min[i] = Math.min(aggregate.min[i], point[i]);
    aggregate.max[i] = Math.max(aggregate.max[i], point[i]);
  }
}

function mergeAggregate(target, source) {
  target.count += source.count;
  for (let i = 0; i < 3; i += 1) {
    target.sum[i] += source.sum[i];
    target.min[i] = Math.min(target.min[i], source.min[i]);
    target.max[i] = Math.max(target.max[i], source.max[i]);
  }
}

function transformedUv(uv, textureInfo) {
  if (!uv || !Number.isFinite(uv[0]) || !Number.isFinite(uv[1])) return null;
  const transform = textureInfo?.extensions?.KHR_texture_transform;
  if (!transform) return uv;
  const [offsetX, offsetY] = transform.offset ?? [0, 0];
  const [scaleX, scaleY] = transform.scale ?? [1, 1];
  const rotation = transform.rotation ?? 0;
  const scaledU = uv[0] * scaleX;
  const scaledV = uv[1] * scaleY;
  const cosine = Math.cos(rotation);
  const sine = Math.sin(rotation);
  return [
    offsetX + cosine * scaledU - sine * scaledV,
    offsetY + sine * scaledU + cosine * scaledV,
  ];
}

function addFeatureImageUvPoint(groups, featureId, imageIndex, materialIndex, uv) {
  if (!uv) return;
  if (!groups.has(featureId)) groups.set(featureId, new Map());
  const featureGroups = groups.get(featureId);
  const key = `${imageIndex}:${materialIndex ?? "none"}`;
  if (!featureGroups.has(key)) {
    featureGroups.set(key, {
      image_index: imageIndex,
      material_index: materialIndex ?? null,
      u_min: Infinity, v_min: Infinity, u_max: -Infinity, v_max: -Infinity,
      uv_vertex_count: 0,
    });
  }
  const bounds = featureGroups.get(key);
  bounds.u_min = Math.min(bounds.u_min, uv[0]);
  bounds.v_min = Math.min(bounds.v_min, uv[1]);
  bounds.u_max = Math.max(bounds.u_max, uv[0]);
  bounds.v_max = Math.max(bounds.v_max, uv[1]);
  bounds.uv_vertex_count += 1;
}

function serializeUvBoundsFallback(tileName, groups) {
  return [...(groups?.values() ?? [])].map((bounds, index) => ({
    image_id: imageId(tileName, bounds.image_index),
    image_index: bounds.image_index,
    material_index: bounds.material_index,
    subregion_signature: crypto.createHash("sha256").update([
      bounds.image_index, bounds.material_index ?? "none",
      Number(bounds.u_min).toFixed(6), Number(bounds.v_min).toFixed(6),
      Number(bounds.u_max).toFixed(6), Number(bounds.v_max).toFixed(6),
    ].join("|")).digest("hex").slice(0, 20),
    subregion_index: index,
    u_min: round(Math.max(0, Math.min(1, bounds.u_min)), 8),
    v_min: round(Math.max(0, Math.min(1, bounds.v_min)), 8),
    u_max: round(Math.max(0, Math.min(1, bounds.u_max)), 8),
    v_max: round(Math.max(0, Math.min(1, bounds.v_max)), 8),
    uv_vertex_count: bounds.uv_vertex_count,
    triangle_count: 0,
    surface_count: 1,
    uv_area: 0,
    uv_fill_ratio: 1,
    surface_area_m2: 0,
    coordinate_accuracy: "feature_geometry_centroid",
    camera_heading_deg: null,
  })).filter((region) => region.u_max > region.u_min && region.v_max > region.v_min);
}

function unitNormal(first, second, third) {
  const a = second.map((value, index) => value - first[index]);
  const b = third.map((value, index) => value - first[index]);
  const cross = [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
  const length = Math.hypot(...cross);
  if (!Number.isFinite(length) || length < 1e-10) return null;
  return { vector: cross.map((value) => value / length), area: length / 2 };
}

function uvTriangleArea(uvs) {
  if (!uvs?.every(Boolean)) return 0;
  return Math.abs(
    (uvs[1][0] - uvs[0][0]) * (uvs[2][1] - uvs[0][1])
    - (uvs[1][1] - uvs[0][1]) * (uvs[2][0] - uvs[0][0]),
  ) / 2;
}

function addFeatureImageTriangle(groups, featureId, imageIndex, materialIndex, triangle) {
  if (!triangle.uvs?.every(Boolean) || !triangle.points?.every(Boolean)) return;
  if (!groups.has(featureId)) groups.set(featureId, new Map());
  const featureGroups = groups.get(featureId);
  const key = `${imageIndex}:${materialIndex ?? "none"}`;
  if (!featureGroups.has(key)) {
    featureGroups.set(key, {
      image_index: imageIndex,
      material_index: materialIndex ?? null,
      triangles: [],
    });
  }
  featureGroups.get(key).triangles.push({
    ...triangle,
    normal: unitNormal(triangle.points[0], triangle.points[1], triangle.points[2]),
    uv_area: uvTriangleArea(triangle.uvs),
  });
}

function quantized(values, digits = 5) {
  return values.map((value) => Number(value).toFixed(digits)).join(",");
}

function triangleEdgeKeys(triangle) {
  const keys = [];
  for (const [a, b] of [[0, 1], [1, 2], [2, 0]]) {
    const vertexPair = [triangle.vertex_keys[a], triangle.vertex_keys[b]].sort().join("~");
    const physicalUvPair = [
      `${quantized(triangle.points[a], 4)}|${quantized(triangle.uvs[a], 6)}`,
      `${quantized(triangle.points[b], 4)}|${quantized(triangle.uvs[b], 6)}`,
    ].sort().join("~");
    keys.push(`v:${vertexPair}`, `p:${physicalUvPair}`);
  }
  return keys;
}

function sameSurfaceNormal(first, second) {
  if (!first?.vector || !second?.vector) return false;
  const dot = first.vector.reduce((sum, value, index) => sum + value * second.vector[index], 0);
  return Math.abs(dot) >= .985;
}

function connectedSurfaceComponents(triangles) {
  const parents = triangles.map((_, index) => index);
  const find = (index) => {
    while (parents[index] !== index) {
      parents[index] = parents[parents[index]];
      index = parents[index];
    }
    return index;
  };
  const join = (a, b) => {
    const rootA = find(a);
    const rootB = find(b);
    if (rootA !== rootB) parents[rootB] = rootA;
  };
  const edgeOwners = new Map();
  triangles.forEach((triangle, triangleIndex) => {
    for (const edgeKey of triangleEdgeKeys(triangle)) {
      const otherIndexes = edgeOwners.get(edgeKey) ?? [];
      for (const otherIndex of otherIndexes) {
        if (sameSurfaceNormal(triangle.normal, triangles[otherIndex].normal)) join(triangleIndex, otherIndex);
      }
      otherIndexes.push(triangleIndex);
      edgeOwners.set(edgeKey, otherIndexes);
    }
  });
  const components = new Map();
  triangles.forEach((triangle, index) => {
    const root = find(index);
    if (!components.has(root)) components.set(root, []);
    components.get(root).push(triangle);
  });
  return [...components.values()];
}

function surfaceBounds(triangles) {
  const uvs = triangles.flatMap((triangle) => triangle.uvs);
  return {
    u_min: Math.min(...uvs.map((uv) => uv[0])),
    v_min: Math.min(...uvs.map((uv) => uv[1])),
    u_max: Math.max(...uvs.map((uv) => uv[0])),
    v_max: Math.max(...uvs.map((uv) => uv[1])),
  };
}

function serializeUvSurfaceRegions(tileName, groups, rtc, tileCenter) {
  const regions = [];
  for (const group of groups?.values() ?? []) {
    const mergedByUvBounds = [];
    for (const triangles of connectedSurfaceComponents(group.triangles)) {
      const bounds = surfaceBounds(triangles);
      const clipped = {
        u_min: Math.max(0, Math.min(1, bounds.u_min)),
        v_min: Math.max(0, Math.min(1, bounds.v_min)),
        u_max: Math.max(0, Math.min(1, bounds.u_max)),
        v_max: Math.max(0, Math.min(1, bounds.v_max)),
      };
      if (clipped.u_max - clipped.u_min < 1e-7 || clipped.v_max - clipped.v_min < 1e-7) continue;
      // 여러 면이 완전히 같은 텍스처 픽셀을 재사용하면 각각 교체할 수 없으므로
      // 하나의 작업 슬롯으로 묶는다. 서로 다른 아틀라스 위치는 별도 슬롯이다.
      const uvPixelTolerance = .002;
      const overlapRatio = (candidate) => {
        const overlapWidth = Math.max(0, Math.min(candidate.u_max, clipped.u_max) - Math.max(candidate.u_min, clipped.u_min));
        const overlapHeight = Math.max(0, Math.min(candidate.v_max, clipped.v_max) - Math.max(candidate.v_min, clipped.v_min));
        const intersection = overlapWidth * overlapHeight;
        const candidateArea = (candidate.u_max - candidate.u_min) * (candidate.v_max - candidate.v_min);
        const clippedArea = (clipped.u_max - clipped.u_min) * (clipped.v_max - clipped.v_min);
        return intersection / Math.max(candidateArea, clippedArea, 1e-12);
      };
      let merged = mergedByUvBounds.find((candidate) =>
        (Math.abs(candidate.u_min - clipped.u_min) <= uvPixelTolerance
          && Math.abs(candidate.v_min - clipped.v_min) <= uvPixelTolerance
          && Math.abs(candidate.u_max - clipped.u_max) <= uvPixelTolerance
          && Math.abs(candidate.v_max - clipped.v_max) <= uvPixelTolerance)
        || overlapRatio(candidate) >= .96);
      if (!merged) {
        merged = { triangles: [], surface_count: 0, ...clipped };
        mergedByUvBounds.push(merged);
      } else {
        merged.u_min = Math.min(merged.u_min, clipped.u_min);
        merged.v_min = Math.min(merged.v_min, clipped.v_min);
        merged.u_max = Math.max(merged.u_max, clipped.u_max);
        merged.v_max = Math.max(merged.v_max, clipped.v_max);
      }
      merged.triangles.push(...triangles);
      merged.surface_count += 1;
    }
    for (const merged of mergedByUvBounds) {
      const aggregate = newAggregate();
      for (const triangle of merged.triangles) for (const point of triangle.points) addPoint(aggregate, point);
      const centerLocal = aggregate.sum.map((value) => value / aggregate.count);
      const centerEcef = centerLocal.map((value, index) => value + rtc[index]);
      const geodetic = ecefToGeodetic(centerEcef);
      const enu = ecefToEnu(centerEcef);
      const headingGroups = new Map();
      for (const triangle of merged.triangles) {
        addCameraFacingTriangle(
          headingGroups,
          "surface",
          triangle.points[0], triangle.points[1], triangle.points[2],
          geodetic ?? tileCenter,
          triangle.uv_area,
        );
      }
      const uvArea = merged.triangles.reduce((sum, triangle) => sum + triangle.uv_area, 0);
      const bboxArea = (merged.u_max - merged.u_min) * (merged.v_max - merged.v_min);
      const signature = crypto.createHash("sha256").update([
        group.image_index,
        group.material_index ?? "none",
        merged.u_min.toFixed(6), merged.v_min.toFixed(6),
        merged.u_max.toFixed(6), merged.v_max.toFixed(6),
      ].join("|")).digest("hex").slice(0, 20);
      regions.push({
        image_id: imageId(tileName, group.image_index),
        image_index: group.image_index,
        material_index: group.material_index,
        subregion_signature: signature,
        u_min: round(merged.u_min, 8),
        v_min: round(merged.v_min, 8),
        u_max: round(merged.u_max, 8),
        v_max: round(merged.v_max, 8),
        uv_vertex_count: merged.triangles.length * 3,
        triangle_count: merged.triangles.length,
        surface_count: merged.surface_count,
        uv_area: round(uvArea, 8),
        uv_fill_ratio: round(Math.min(1, bboxArea > 0 ? uvArea / bboxArea : 0), 5),
        surface_area_m2: round(merged.triangles.reduce((sum, triangle) => sum + (triangle.normal?.area ?? 0), 0), 4),
        coordinate_accuracy: "surface_geometry_centroid",
        longitude: round(geodetic.lon, 9),
        latitude: round(geodetic.lat, 9),
        height_m: round(geodetic.height, 3),
        east_m: round(enu.east, 3),
        north_m: round(enu.north, 3),
        up_m: round(enu.up, 3),
        camera_heading_deg: preferredCameraHeading(headingGroups, "surface"),
      });
    }
  }
  return regions
    .sort((a, b) => a.image_index - b.image_index
      || (a.material_index ?? -1) - (b.material_index ?? -1)
      || a.v_min - b.v_min || a.u_min - b.u_min)
    .map((region, index) => ({ ...region, subregion_index: index }));
}

function ecefToGeodetic([x, y, z]) {
  const a = 6378137.0;
  const e2 = 6.69437999014e-3;
  const p = Math.hypot(x, y);
  let lon = Math.atan2(y, x);
  let lat = Math.atan2(z, p * (1 - e2));
  let height = 0;
  for (let i = 0; i < 10; i += 1) {
    const sin = Math.sin(lat);
    const n = a / Math.sqrt(1 - e2 * sin * sin);
    height = p / Math.cos(lat) - n;
    lat = Math.atan2(z, p * (1 - e2 * n / (n + height)));
  }
  return { lon: radiansToDegrees(lon), lat: radiansToDegrees(lat), height };
}

function geodeticToEcef(lonDeg, latDeg, height) {
  const a = 6378137.0;
  const e2 = 6.69437999014e-3;
  const lon = lonDeg * Math.PI / 180;
  const lat = latDeg * Math.PI / 180;
  const sin = Math.sin(lat); const cos = Math.cos(lat);
  const n = a / Math.sqrt(1 - e2 * sin * sin);
  return [(n + height) * cos * Math.cos(lon), (n + height) * cos * Math.sin(lon), (n * (1 - e2) + height) * sin];
}

const originEcef = geodeticToEcef(SITE_ORIGIN.lon, SITE_ORIGIN.lat, SITE_ORIGIN.height);
function ecefToEnu(point) {
  const lon = SITE_ORIGIN.lon * Math.PI / 180;
  const lat = SITE_ORIGIN.lat * Math.PI / 180;
  const [dx, dy, dz] = point.map((value, index) => value - originEcef[index]);
  return {
    east: -Math.sin(lon) * dx + Math.cos(lon) * dy,
    north: -Math.sin(lat) * Math.cos(lon) * dx - Math.sin(lat) * Math.sin(lon) * dy + Math.cos(lat) * dz,
    up: Math.cos(lat) * Math.cos(lon) * dx + Math.cos(lat) * Math.sin(lon) * dy + Math.sin(lat) * dz,
  };
}

function ecefVectorToEnu([dx, dy, dz], geodetic) {
  const lon = geodetic.lon * Math.PI / 180;
  const lat = geodetic.lat * Math.PI / 180;
  return {
    east: -Math.sin(lon) * dx + Math.cos(lon) * dy,
    north: -Math.sin(lat) * Math.cos(lon) * dx - Math.sin(lat) * Math.sin(lon) * dy + Math.cos(lat) * dz,
    up: Math.cos(lat) * Math.cos(lon) * dx + Math.cos(lat) * Math.sin(lon) * dy + Math.sin(lat) * dz,
  };
}

function addCameraFacingTriangle(groups, key, first, second, third, geodetic, preferredWeight = null) {
  if (!geodetic || !first || !second || !third) return;
  const a = second.map((value, index) => value - first[index]);
  const b = third.map((value, index) => value - first[index]);
  const normal = [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
  const enu = ecefVectorToEnu(normal, geodetic);
  const horizontalWeight = Math.hypot(enu.east, enu.north);
  const totalWeight = Math.hypot(horizontalWeight, enu.up);
  if (!Number.isFinite(totalWeight) || totalWeight < 1e-8 || horizontalWeight < totalWeight * .2) return;
  const weight = Number.isFinite(preferredWeight) && preferredWeight > 1e-10 ? preferredWeight : horizontalWeight;
  const heading = (Math.atan2(enu.east, enu.north) + Math.PI * 2) % (Math.PI * 2);
  const binCount = 72;
  const bin = Math.round(heading / (Math.PI * 2) * binCount) % binCount;
  if (!groups.has(key)) groups.set(key, new Map());
  const bins = groups.get(key);
  if (!bins.has(bin)) bins.set(bin, { east: 0, north: 0, weight: 0 });
  const aggregate = bins.get(bin);
  aggregate.east += enu.east / horizontalWeight * weight;
  aggregate.north += enu.north / horizontalWeight * weight;
  aggregate.weight += weight;
}

function preferredCameraHeading(groups, key) {
  const bins = groups.get(key);
  if (!bins?.size) return null;
  const best = [...bins.values()].sort((a, b) => b.weight - a.weight)[0];
  const heading = (Math.atan2(best.east, best.north) * 180 / Math.PI + 360) % 360;
  return round(heading, 3);
}

function tileRegionCenter(meta) {
  const region = meta?.region;
  if (!region) return null;
  return { lon: radiansToDegrees((region[0] + region[2]) / 2), lat: radiansToDegrees((region[1] + region[3]) / 2), height: (region[4] + region[5]) / 2 };
}

function coordinateInsideTileRegion(geodetic, meta, horizontalToleranceRadians = 2e-6, verticalToleranceMeters = 3) {
  const region = meta?.region;
  if (!geodetic || !region) return null;
  const lon = geodetic.lon * Math.PI / 180;
  const lat = geodetic.lat * Math.PI / 180;
  return lon >= region[0] - horizontalToleranceRadians
    && lon <= region[2] + horizontalToleranceRadians
    && lat >= region[1] - horizontalToleranceRadians
    && lat <= region[3] + horizontalToleranceRadians
    && geodetic.height >= region[4] - verticalToleranceMeters
    && geodetic.height <= region[5] + verticalToleranceMeters;
}

function classCode(modelName) {
  const tail = String(modelName ?? "").replace(/^(?:F\d{2}|B\d{2})/, "");
  const token = tail.split("_").filter(Boolean).at(-1) || tail;
  return token.match(/^([A-Z]{2})/)?.[1] ?? null;
}

async function imagePreview(data, mimeType, previewPath) {
  if (mimeType === "image/ktx2") {
    const parsed = await loadersCore.parse(data, loadersTextures.BasisLoader, {
      worker: false,
      modules: { basisEncoder: { BasisFile: basisModule.BasisFile, KTX2File: basisModule.KTX2File, BasisEncoder: basisModule.BasisEncoder } },
      basis: { format: "rgba32", containerFormat: "ktx2", module: "encoder" },
    });
    const level = parsed?.[0]?.[0];
    if (!level) throw new Error("KTX2 preview level missing");
    await sharp(level.data, { raw: { width: level.width, height: level.height, channels: 4 } })
      .resize(256, 256, { fit: "contain", background: "#111820" })
      .png().toFile(previewPath);
    return { width: level.width, height: level.height, previewConverted: true };
  }
  const metadata = await sharp(data).metadata();
  await sharp(data).resize(256, 256, { fit: "contain", background: "#111820" }).png().toFile(previewPath);
  return { width: metadata.width ?? null, height: metadata.height ?? null, previewConverted: false };
}

const tileFiles = fs.readdirSync(tilesDir).filter((name) => name.endsWith(".bin")).sort();
const imageRows = [];
const featureRows = [];
const failures = [];

for (let tileNumber = 0; tileNumber < tileFiles.length; tileNumber += 1) {
  const fileName = tileFiles[tileNumber];
  const tileName = path.basename(fileName, ".bin");
  const tileMeta = tileMetaByName.get(tileName) ?? {};
  try {
    const parsed = parseB3dm(path.join(tilesDir, fileName));
    const transforms = meshTransforms(parsed.gltf);
    const rtc = parsed.featureTable.RTC_CENTER ?? [0, 0, 0];
    const batchLength = parsed.featureTable.BATCH_LENGTH ?? 0;
    const tileCenter = tileRegionCenter(tileMeta);
    const featureAggregates = new Map();
    const imageFeatureIds = new Map();
    const featureImageIds = new Map();
    const featureImageTriangles = new Map();
    const featureImageBounds = new Map();
    const featureCameraGroups = new Map();
    const mappingMethods = new Map();

    for (let meshIndex = 0; meshIndex < (parsed.gltf.meshes ?? []).length; meshIndex += 1) {
      const mesh = parsed.gltf.meshes[meshIndex];
      const matrices = transforms.get(meshIndex) ?? [identityMatrix()];
      for (const [primitiveIndex, primitive] of (mesh.primitives ?? []).entries()) {
        const decoded = decodeDracoPrimitive(parsed.gltf, parsed.binary, primitive);
        const positions = decoded?.positions ?? readAccessor(parsed.gltf, parsed.binary, primitive.attributes?.POSITION);
        const batchRows = decoded?.batchIds ?? readAccessor(parsed.gltf, parsed.binary, primitive.attributes?._BATCHID);
        if (!positions) continue;
        const indices = decoded?.indices?.length
          ? decoded.indices
          : (readAccessor(parsed.gltf, parsed.binary, primitive.indices)?.map((row) => row[0]) ?? positions.map((_, index) => index));
        const inferredId = meshIndex < batchLength ? meshIndex : null;
        const material = parsed.gltf.materials?.[primitive.material];
        const textureInfo = material?.pbrMetallicRoughness?.baseColorTexture;
        const textureIndex = textureInfo?.index;
        const texture = textureIndex === undefined ? null : parsed.gltf.textures?.[textureIndex];
        const imageIndex = texture?.extensions?.KHR_texture_basisu?.source ?? texture?.source ?? null;
        const textureTransform = textureInfo?.extensions?.KHR_texture_transform;
        const texCoordSet = textureTransform?.texCoord ?? textureInfo?.texCoord ?? 0;
        const texCoords = texCoordSet === 1
          ? (decoded?.texCoords1 ?? readAccessor(parsed.gltf, parsed.binary, primitive.attributes?.TEXCOORD_1))
          : (decoded?.texCoords0 ?? readAccessor(parsed.gltf, parsed.binary, primitive.attributes?.TEXCOORD_0));
        const linkedIds = new Set();
        positions.forEach((_, index) => {
          const rawId = batchRows?.[index]?.[0];
          const featureId = Number.isFinite(rawId) ? Math.round(rawId) : inferredId;
          if (featureId === null || featureId < 0 || featureId >= batchLength) return;
          linkedIds.add(featureId);
          if (imageIndex !== null && texCoords?.[index]) {
            addFeatureImageUvPoint(featureImageBounds, featureId, imageIndex, primitive.material, transformedUv(texCoords[index], textureInfo));
          }
        });
        for (const [matrixIndex, matrix] of matrices.entries()) {
          const transformedPositions = positions.map((position) => transformPoint(matrix, position));
          transformedPositions.forEach((position, index) => {
            const rawId = batchRows?.[index]?.[0];
            const featureId = Number.isFinite(rawId) ? Math.round(rawId) : inferredId;
            if (featureId === null || featureId < 0 || featureId >= batchLength) return;
            if (!featureAggregates.has(featureId)) featureAggregates.set(featureId, newAggregate());
            addPoint(featureAggregates.get(featureId), position);
            mappingMethods.set(featureId, batchRows ? "decoded_batch_id" : "mesh_index_inferred");
          });
          if (imageIndex !== null) {
            for (let index = 0; index + 2 < indices.length; index += 3) {
              const vertexIndices = [indices[index], indices[index + 1], indices[index + 2]];
              const featureIds = vertexIndices.map((vertexIndex) => {
                const rawId = batchRows?.[vertexIndex]?.[0];
                return Number.isFinite(rawId) ? Math.round(rawId) : inferredId;
              });
              const featureId = featureIds[0];
              if (featureId === null || featureId < 0 || featureId >= batchLength || featureIds.some((id) => id !== featureId)) continue;
              const points = vertexIndices.map((vertexIndex) => transformedPositions[vertexIndex]);
              addCameraFacingTriangle(featureCameraGroups, featureId, points[0], points[1], points[2], tileCenter);
              const triangleUvs = vertexIndices.map((vertexIndex) => transformedUv(texCoords?.[vertexIndex], textureInfo));
              addFeatureImageTriangle(featureImageTriangles, featureId, imageIndex, primitive.material, {
                points,
                uvs: triangleUvs,
                vertex_keys: vertexIndices.map((vertexIndex) => `${meshIndex}:${primitiveIndex}:${matrixIndex}:${vertexIndex}`),
              });
            }
          }
        }
        if (imageIndex !== null) {
          if (!imageFeatureIds.has(imageIndex)) imageFeatureIds.set(imageIndex, new Set());
          for (const featureId of linkedIds) {
            imageFeatureIds.get(imageIndex).add(featureId);
            if (!featureImageIds.has(featureId)) featureImageIds.set(featureId, new Set());
            featureImageIds.get(featureId).add(imageIndex);
          }
        }
      }
    }

    const assetTileDir = path.join(outputDir, "assets", tileName);
    const previewTileDir = path.join(outputDir, "previews", tileName);
    await fsp.mkdir(assetTileDir, { recursive: true });
    await fsp.mkdir(previewTileDir, { recursive: true });
    for (const [imageIndex, image] of (parsed.gltf.images ?? []).entries()) {
      if (image.bufferView === undefined) continue;
      const view = parsed.gltf.bufferViews?.[image.bufferView];
      if (!view) continue;
      const start = view.byteOffset ?? 0;
      const data = parsed.binary.subarray(start, start + view.byteLength);
      const extension = imageExtension(image.mimeType);
      const imageName = `image-${String(imageIndex).padStart(3, "0")}.${extension}`;
      const previewName = `image-${String(imageIndex).padStart(3, "0")}.png`;
      const assetPath = path.join(assetTileDir, imageName);
      const previewPath = path.join(previewTileDir, previewName);
      await fsp.writeFile(assetPath, data);
      let dimensions = { width: null, height: null, previewConverted: false };
      let previewError = null;
      try { dimensions = await imagePreview(data, image.mimeType, previewPath); }
      catch (error) { previewError = String(error); }
      const linkedFeatureIds = [...(imageFeatureIds.get(imageIndex) ?? [])].sort((a, b) => a - b);
      const aggregate = newAggregate();
      for (const featureId of linkedFeatureIds) {
        const featureAggregate = featureAggregates.get(featureId);
        if (featureAggregate) mergeAggregate(aggregate, featureAggregate);
      }
      let geodetic = tileCenter;
      let enu = tileCenter ? ecefToEnu(geodeticToEcef(tileCenter.lon, tileCenter.lat, tileCenter.height)) : null;
      let coordinateAccuracy = "tile_region_center";
      if (aggregate.count > 0) {
        const centerLocal = aggregate.sum.map((value) => value / aggregate.count);
        const centerEcef = centerLocal.map((value, index) => value + rtc[index]);
        geodetic = ecefToGeodetic(centerEcef);
        enu = ecefToEnu(centerEcef);
        coordinateAccuracy = "feature_geometry_centroid";
      }
      const floors = [...new Set(linkedFeatureIds.map((id) => parsed.batchTable.FLOOR?.[id]).filter(Boolean))];
      const models = [...new Set(linkedFeatureIds.map((id) => parsed.batchTable.MODEL_NAME?.[id]).filter(Boolean))];
      const classes = [...new Set(models.map(classCode).filter(Boolean))];
      const placeholder = data.length <= 100 || (dimensions.width === 1 && dimensions.height === 1);
      const detailTile = (tileMeta.child_count ?? 0) === 0;
      const priority = placeholder ? "EXCLUDE" : detailTile && classes.includes("WL") ? "HIGH" : detailTile && classes.includes("FC") ? "MEDIUM" : detailTile ? "REVIEW" : "REFERENCE";
      imageRows.push({
        site_id: siteConfig.site_id,
        image_id: imageId(tileName, imageIndex),
        tile: tileName,
        tile_uri: `${tileName}.b3dm`,
        tile_url: `${SOURCE_BASE}${tileName}.b3dm`,
        tile_depth: tileMeta.depth ?? null,
        detail_tile: detailTile,
        parent_tile: tileMeta.parent_uri ? path.basename(tileMeta.parent_uri, path.extname(tileMeta.parent_uri)) : null,
        geometric_error: tileMeta.geometric_error ?? null,
        image_index: imageIndex,
        mime_type: image.mimeType ?? null,
        width_px: dimensions.width,
        height_px: dimensions.height,
        byte_length: data.length,
        image_sha256: sha256(data),
        placeholder,
        replacement_priority: priority,
        floors: floors.join("|"),
        feature_ids: linkedFeatureIds.join("|"),
        model_names: models.join("|"),
        class_codes: classes.join("|"),
        td_ids: linkedFeatureIds.map((id) => parsed.batchTable.TD_ID?.[id]).filter(Boolean).join("|"),
        oids: linkedFeatureIds.map((id) => parsed.batchTable.__OID__?.[id]).filter((value) => value !== undefined).join("|"),
        coordinate_accuracy: coordinateAccuracy,
        coordinate_inside_tile: coordinateInsideTileRegion(geodetic, tileMeta),
        longitude: round(geodetic?.lon, 9),
        latitude: round(geodetic?.lat, 9),
        height_m: round(geodetic?.height, 3),
        east_m: round(enu?.east, 3),
        north_m: round(enu?.north, 3),
        up_m: round(enu?.up, 3),
        rtc_center_x: round(rtc[0], 3), rtc_center_y: round(rtc[1], 3), rtc_center_z: round(rtc[2], 3),
        asset_path: path.relative(outputDir, assetPath),
        preview_path: previewError ? null : path.relative(outputDir, previewPath),
        preview_error: previewError,
        source_observed_at: SOURCE_OBSERVED_AT,
        current_store_name: "",
        replacement_image_path: "",
        field_verified: false,
      });
    }

    for (let featureId = 0; featureId < batchLength; featureId += 1) {
      const aggregate = featureAggregates.get(featureId);
      let geodetic = tileCenter;
      let enu = tileCenter ? ecefToEnu(geodeticToEcef(tileCenter.lon, tileCenter.lat, tileCenter.height)) : null;
      let accuracy = "tile_region_center";
      if (aggregate?.count) {
        const centerEcef = aggregate.sum.map((value, index) => value / aggregate.count + rtc[index]);
        geodetic = ecefToGeodetic(centerEcef);
        enu = ecefToEnu(centerEcef);
        accuracy = "feature_geometry_centroid";
      }
      const modelName = parsed.batchTable.MODEL_NAME?.[featureId] ?? null;
      const surfaceRegions = serializeUvSurfaceRegions(tileName, featureImageTriangles.get(featureId), rtc, tileCenter);
      featureRows.push({
        site_id: siteConfig.site_id,
        feature_key: featureKey(tileName, featureId),
        tile: tileName,
        feature_id: featureId,
        floor: parsed.batchTable.FLOOR?.[featureId] ?? null,
        site: parsed.batchTable.SITE?.[featureId] ?? null,
        type: parsed.batchTable.TYPE?.[featureId] ?? null,
        td_id: parsed.batchTable.TD_ID?.[featureId] ?? null,
        model_name: modelName,
        class_code: classCode(modelName),
        oid: parsed.batchTable.__OID__?.[featureId] ?? null,
        image_ids: [...(featureImageIds.get(featureId) ?? [])].map((id) => imageId(tileName, id)).join("|"),
        image_regions: surfaceRegions.length ? surfaceRegions : serializeUvBoundsFallback(tileName, featureImageBounds.get(featureId)),
        camera_heading_deg: preferredCameraHeading(featureCameraGroups, featureId),
        mapping_method: mappingMethods.get(featureId) ?? "unmapped",
        coordinate_accuracy: accuracy,
        coordinate_inside_tile: coordinateInsideTileRegion(geodetic, tileMeta),
        longitude: round(geodetic?.lon, 9), latitude: round(geodetic?.lat, 9), height_m: round(geodetic?.height, 3),
        east_m: round(enu?.east, 3), north_m: round(enu?.north, 3), up_m: round(enu?.up, 3),
        vertex_count: aggregate?.count ?? 0,
      });
    }
  } catch (error) {
    failures.push({ tile: tileName, error: String(error) });
  }
  if ((tileNumber + 1) % 25 === 0 || tileNumber + 1 === tileFiles.length) {
    console.log(JSON.stringify({ processed_tiles: tileNumber + 1, total_tiles: tileFiles.length, images: imageRows.length, features: featureRows.length, failures: failures.length }));
  }
}

function csvCell(value) {
  if (value === null || value === undefined) return "";
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
function writeCsv(filePath, rows) {
  const headers = rows.length ? Object.keys(rows[0]) : [];
  const text = [headers.join(","), ...rows.map((row) => headers.map((header) => csvCell(row[header])).join(","))].join("\n");
  fs.writeFileSync(filePath, `${text}\n`);
}

const duplicateGroups = new Map();
for (const row of imageRows) {
  if (!duplicateGroups.has(row.image_sha256)) duplicateGroups.set(row.image_sha256, []);
  duplicateGroups.get(row.image_sha256).push(row.image_id);
}
for (const row of imageRows) {
  row.duplicate_count = duplicateGroups.get(row.image_sha256)?.length ?? 1;
  row.unique_image = row.duplicate_count === 1;
}

const previousCatalogPath = path.join(outputDir, "image-catalog.json");
if (fs.existsSync(previousCatalogPath)) {
  const previousRows = JSON.parse(fs.readFileSync(previousCatalogPath, "utf8"));
  const previousById = new Map(previousRows.map((row) => [row.image_id, row]));
  const previousByHash = new Map(previousRows.map((row) => [row.image_sha256, row]));
  const preservedFields = [
    "ocr_text", "ocr_confidence", "ocr_label_candidate",
    "current_store_name", "replacement_image_path", "field_verified",
  ];
  for (const row of imageRows) {
    const previous = previousById.get(row.image_id) ?? previousByHash.get(row.image_sha256);
    if (!previous) continue;
    for (const field of preservedFields) {
      if (Object.prototype.hasOwnProperty.call(previous, field)) row[field] = previous[field];
    }
  }
}

const manifest = {
  generated_at: new Date().toISOString(),
  source_tileset: `${SOURCE_BASE}tileset.json`,
  site_id: siteConfig.site_id,
  site_name: siteConfig.site_name,
  tile_count: tileFiles.length,
  image_occurrence_count: imageRows.length,
  unique_image_count: duplicateGroups.size,
  feature_count: featureRows.length,
  feature_coordinate_outlier_count: featureRows.filter((row) => row.coordinate_inside_tile === false).length,
  extraction_failures: failures,
};
await fsp.writeFile(path.join(outputDir, "image-catalog.json"), `${JSON.stringify(imageRows, null, 2)}\n`);
await fsp.writeFile(path.join(outputDir, "feature-catalog.json"), `${JSON.stringify(featureRows, null, 2)}\n`);
await fsp.writeFile(path.join(outputDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
writeCsv(path.join(outputDir, "image-catalog.csv"), imageRows);
writeCsv(path.join(outputDir, "feature-catalog.csv"), featureRows);
console.log(JSON.stringify(manifest, null, 2));
if (failures.length) process.exitCode = 2;
