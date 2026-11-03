// Approved coplanar UVs encode Cesium's independent polygon winding changes.
// Resolve their physical corner correspondence once with the pinned engine,
// rather than applying a guessed vertical flip in the Three.js renderer.
import crypto from 'node:crypto';
import fs from 'node:fs';
import {isCoplanarSurfacePlacement} from '../src/replacement-surface-contract.js';
import {F02WL072_FRAME} from '../app/f02wl072-frame.js';

export const COPLANAR_UV_ENGINE_VERSION = '1.142.0';
export const COPLANAR_UV_ENGINE_SHA256 = 'c61d84d87b750c6ff65101cfa62d0ec6fb330cd2f70565827a84943c642b3112';
export const COPLANAR_UV_ENGINE_SOURCE = 'https://cesium.com/downloads/cesiumjs/releases/1.142/Build/Cesium/Cesium.js';
// app/app.js uses .055m for the mask and .065m for the photograph.
export const APPROVED_REPLACEMENT_IMAGE_OFFSET_METERS = .065;
export const COPLANAR_UV_CACHE_URL = new URL('./commons-coplanar-uv-mappings.json', import.meta.url);
// The dedicated frame renderer expresses its normals in this station frame,
// not in the ENU frame of each surface's centre.
export const APPROVED_FRAME_ORIGIN = Object.freeze({longitude: 126.97082, latitude: 37.55363, height: 27.2});
let cache;

export function coplanarPlacementFingerprint(placement) {
  if (!isCoplanarSurfacePlacement(placement)) throw Error('A valid approved coplanar placement is required');
  return crypto.createHash('sha256').update(JSON.stringify({
    longitude: Number(placement.longitude), latitude: Number(placement.latitude),
    corners: placement.corners_wgs84.map(v => v.map(Number)),
    normal: placement.normal_enu.map(Number),
    uv: placement.texture_coordinates.map(v => v.map(Number)),
    imageOffset: APPROVED_REPLACEMENT_IMAGE_OFFSET_METERS,
  })).digest('hex');
}

export function coplanarUVContractInfo() {
  cache ??= JSON.parse(fs.readFileSync(COPLANAR_UV_CACHE_URL, 'utf8'));
  if (cache.schema !== 1 || cache.engineVersion !== COPLANAR_UV_ENGINE_VERSION
    || cache.engineSHA256 !== COPLANAR_UV_ENGINE_SHA256
    || cache.imageOffset !== APPROVED_REPLACEMENT_IMAGE_OFFSET_METERS) {
    throw Error('Commons coplanar UV cache does not match the approved renderer contract');
  }
  return cache;
}

export function normalizeCoplanarSurfaceUV(placement) {
  const fingerprint = coplanarPlacementFingerprint(placement);
  const entry = coplanarUVContractInfo().placements[fingerprint];
  if (!entry) throw Error(`Unverified Commons coplanar surface ${fingerprint}; run tools/test-commons-coplanar-uv.mjs --update-cache with pinned Cesium 1.142 before building`);
  if (entry.uvOrder?.length !== 4 || [...entry.uvOrder].sort().join(',') !== '0,1,2,3'
    || entry.indices?.length !== 6 || !entry.indices.every(i => Number.isInteger(i) && i >= 0 && i < 4)) {
    throw Error(`Invalid verified Commons coplanar mapping ${fingerprint}`);
  }
  return {
    coords: entry.uvOrder.map(i => placement.texture_coordinates[i].map(Number)),
    indices: [...entry.indices],
    changed: entry.uvOrder.some((source, corner) => source !== corner),
  };
}

export function frameSurfaceFingerprint(surface) {
  return crypto.createHash('sha256').update(JSON.stringify({corners: surface.corners,
    normal: surface.normalEnu, origin: APPROVED_FRAME_ORIGIN, imageOffset: F02WL072_FRAME.imageOffset,
  })).digest('hex');
}

export function normalizeApprovedFrameUV(surface) {
  const entry = coplanarUVContractInfo().frameSurfaces?.[frameSurfaceFingerprint(surface)];
  if (!entry || entry.coords?.length !== 4 || !entry.coords.every(v => v.length === 2 && v.every(Number.isFinite))
    || entry.indices?.length !== 6 || !entry.indices.every(i => Number.isInteger(i) && i >= 0 && i < 4)) {
    throw Error(`Unverified Commons exact frame surface ${surface.id}; regenerate the pinned-engine UV cache`);
  }
  return {coords: entry.coords.map(v => [...v]), indices: [...entry.indices]};
}

// Match approved-replacement-surface.js without introducing a Cesium runtime
// dependency. This is a vector, not a replacement for the approved coordinates.
export function approvedImageOffsetECEF(placement) {
  let normal;
  if (isCoplanarSurfacePlacement(placement)) normal = placement.normal_enu.map(Number);
  else {
    const heading = Number(placement.camera_heading_deg) * Math.PI / 180;
    normal = [Math.sin(heading), Math.cos(heading), 0];
  }
  return enuOffsetECEF(placement, normal, APPROVED_REPLACEMENT_IMAGE_OFFSET_METERS / Math.hypot(...normal));
}

export function approvedFrameImageOffsetECEF(surface) {
  // The source frame renderer deliberately does not renormalize these normals.
  return enuOffsetECEF(APPROVED_FRAME_ORIGIN, surface.normalEnu, F02WL072_FRAME.imageOffset);
}

function enuOffsetECEF(placement, normal, scale) {
  const lon = Number(placement.longitude) * Math.PI / 180;
  const lat = Number(placement.latitude) * Math.PI / 180;
  if (![lon, lat, scale, ...normal].every(Number.isFinite)) throw Error('Approved surface offset needs a valid location and normal/heading');
  const [east, north, up] = normal.map(v => v * scale);
  // Cesium's ENU uses the ellipsoid-normal of the actual Cartesian origin;
  // at the dedicated frame's 27.2m origin this differs very slightly from the
  // latitude's zero-height normal. Preserve even that frame distinction.
  const e2 = 6.69437999014e-3, a2 = 6378137 ** 2;
  const radius = 6378137 / Math.sqrt(1 - e2 * Math.sin(lat) ** 2), height = Number(placement.height || 0);
  const normalUp = [(radius + height) * Math.cos(lat) * Math.cos(lon) / a2,
    (radius + height) * Math.cos(lat) * Math.sin(lon) / a2,
    (radius * (1 - e2) + height) * Math.sin(lat) / (a2 * (1 - e2))];
  const length = Math.hypot(...normalUp), [ux, uy, uz] = normalUp.map(v => v / length);
  const nx = -uz * Math.cos(lon), ny = -uz * Math.sin(lon), nz = ux * Math.cos(lon) + uy * Math.sin(lon);
  return [
    -Math.sin(lon) * east + nx * north + ux * up,
    Math.cos(lon) * east + ny * north + uy * up,
    nz * north + uz * up,
  ];
}
