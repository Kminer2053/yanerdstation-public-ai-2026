import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import vm from 'node:vm';
import {isCoplanarSurfacePlacement} from '../src/replacement-surface-contract.js';
import {F02WL072_FRAME, isF02wl072FrameReplacement} from '../app/f02wl072-frame.js';
import {
  COPLANAR_UV_ENGINE_VERSION, COPLANAR_UV_ENGINE_SHA256, COPLANAR_UV_ENGINE_SOURCE,
  APPROVED_REPLACEMENT_IMAGE_OFFSET_METERS, COPLANAR_UV_CACHE_URL,
  coplanarPlacementFingerprint, coplanarUVContractInfo, normalizeCoplanarSurfaceUV, approvedImageOffsetECEF,
  APPROVED_FRAME_ORIGIN, frameSurfaceFingerprint, normalizeApprovedFrameUV, approvedFrameImageOffsetECEF,
} from './commons-coplanar-uv.mjs';

const frozenURL = new URL('../public/data/jury-frozen/approved-facades.json', import.meta.url);
const frozenBytes = fs.readFileSync(frozenURL);
const approved = JSON.parse(frozenBytes).replacements.filter(r => r.is_active
  && r.review_status === 'approved' && ['2F', '3F'].includes(r.slot?.floor));
const corpus = approved.flatMap(r => (r.slot.surface_placements || []).flatMap((placement, i) =>
  isCoplanarSurfacePlacement(placement) ? [{alias: r.slot.slot_alias, placementIndex: i, placement}] : []));
assert.equal(approved.length, 59);
assert.equal(corpus.length, 96);
const wallCorpus = approved.filter(r => !isF02wl072FrameReplacement(r)).flatMap(r => {
  const placements = r.slot.surface_placements || [];
  if (!placements.length) return r.slot.slot_alias === 'TRUEDAN-FRONT-S01'
    ? [{alias: r.slot.slot_alias, placementIndex: 0, placement: r.slot, fallback: true}] : [];
  return placements.flatMap((p, i) => !isCoplanarSurfacePlacement(p)
    ? [{alias: r.slot.slot_alias, placementIndex: i, placement: {...r.slot, ...p}, fallback: false}] : []);
});
assert.equal(wallCorpus.filter(r => !r.fallback).length, 4);
assert.equal(wallCorpus.filter(r => r.fallback).length, 1);

function engineMapping(C, placement, offset) {
  const frame = C.Transforms.eastNorthUpToFixedFrame(C.Cartesian3.fromDegrees(Number(placement.longitude), Number(placement.latitude), 0));
  const normal = C.Matrix4.multiplyByPointAsVector(frame, new C.Cartesian3(...placement.normal_enu.map(Number)), new C.Cartesian3());
  C.Cartesian3.normalize(normal, normal);
  C.Cartesian3.multiplyByScalar(normal, offset, normal);
  if (offset === APPROVED_REPLACEMENT_IMAGE_OFFSET_METERS) {
    const derived = approvedImageOffsetECEF(placement);
    assert(derived.every((v, i) => Math.abs(v - [normal.x, normal.y, normal.z][i]) < 1e-12));
  }
  const positions = placement.corners_wgs84.map(v => C.Cartesian3.add(C.Cartesian3.fromDegrees(...v.map(Number)), normal, new C.Cartesian3()));
  const geometry = C.CoplanarPolygonGeometry.createGeometry(new C.CoplanarPolygonGeometry({
    polygonHierarchy: new C.PolygonHierarchy(positions),
    textureCoordinates: new C.PolygonHierarchy(placement.texture_coordinates.map(v => new C.Cartesian2(...v.map(Number)))),
    vertexFormat: C.MaterialAppearance.MaterialSupport.TEXTURED.vertexFormat,
  }));
  assert.equal(geometry.attributes.position.values.length, 12);
  assert.equal(geometry.attributes.st.values.length, 8);
  const order = [], uvOrder = Array(4), physicalUV = Array(4);
  for (let i = 0; i < 4; i++) {
    const position = new C.Cartesian3(...geometry.attributes.position.values.slice(i * 3, i * 3 + 3));
    const distances = positions.map(v => C.Cartesian3.distance(v, position));
    const source = distances.indexOf(Math.min(...distances));
    assert(distances[source] < 1e-7, 'Every output corner must match an approved source corner');
    order.push(source);
    physicalUV[source] = Array.from(geometry.attributes.st.values.slice(i * 2, i * 2 + 2));
    uvOrder[source] = placement.texture_coordinates.findIndex(v => v.every((x, k) => Math.fround(Number(x)) === physicalUV[source][k]));
  }
  assert.equal([...order].sort().join(','), '0,1,2,3');
  assert.equal([...uvOrder].sort().join(','), '0,1,2,3');
  return {uvOrder, indices: Array.from(geometry.indices).map(i => order[i]), physicalUV, positions};
}

function frameEngineMapping(C, surface) {
  const frame = C.Transforms.eastNorthUpToFixedFrame(C.Cartesian3.fromDegrees(APPROVED_FRAME_ORIGIN.longitude, APPROVED_FRAME_ORIGIN.latitude, APPROVED_FRAME_ORIGIN.height));
  const offset = C.Matrix4.multiplyByPointAsVector(frame,
    new C.Cartesian3(...surface.normalEnu.map(v => v * F02WL072_FRAME.imageOffset)), new C.Cartesian3());
  const derived = approvedFrameImageOffsetECEF(surface);
  assert(derived.every((v, i) => Math.abs(v - [offset.x, offset.y, offset.z][i]) < 1e-12));
  const positions = surface.corners.map(v => C.Cartesian3.add(C.Cartesian3.fromDegrees(...v), offset, new C.Cartesian3()));
  const geometry = C.CoplanarPolygonGeometry.createGeometry(new C.CoplanarPolygonGeometry({
    polygonHierarchy: new C.PolygonHierarchy(positions),
    vertexFormat: C.MaterialAppearance.MaterialSupport.TEXTURED.vertexFormat,
  }));
  const order = [], coords = Array(4);
  for (let i = 0; i < 4; i++) {
    const position = new C.Cartesian3(...geometry.attributes.position.values.slice(i * 3, i * 3 + 3));
    const distances = positions.map(v => C.Cartesian3.distance(v, position));
    const source = distances.indexOf(Math.min(...distances));
    assert(distances[source] < 1e-7); order.push(source);
    coords[source] = Array.from(geometry.attributes.st.values.slice(i * 2, i * 2 + 2));
  }
  assert.equal([...order].sort().join(','), '0,1,2,3');
  return {coords, indices: Array.from(geometry.indices).map(i => order[i]), positions};
}

function wallEngineMapping(C, placement) {
  // Same wall endpoints and height interpretation as app.js approvedOverlayWall.
  const heading = Number(placement.camera_heading_deg) * Math.PI / 180;
  const width = Number(placement.surface_width_m), height = Number(placement.surface_height_m);
  const low = Number(placement.height_m) - height / 2, high = Number(placement.height_m) + height / 2;
  const frame = C.Transforms.eastNorthUpToFixedFrame(C.Cartesian3.fromDegrees(Number(placement.longitude), Number(placement.latitude), 0));
  const endpoint = tangent => C.Matrix4.multiplyByPoint(frame, new C.Cartesian3(
    Math.sin(heading) * APPROVED_REPLACEMENT_IMAGE_OFFSET_METERS + Math.cos(heading) * tangent,
    Math.cos(heading) * APPROVED_REPLACEMENT_IMAGE_OFFSET_METERS - Math.sin(heading) * tangent, 0), new C.Cartesian3());
  const ends = [endpoint(width / 2), endpoint(-width / 2)];
  const atHeight = (p, h) => {const cart = C.Cartographic.fromCartesian(p); return C.Cartesian3.fromRadians(cart.longitude, cart.latitude, h);};
  const positions = [atHeight(ends[0], low), atHeight(ends[1], low), atHeight(ends[1], high), atHeight(ends[0], high)];
  const geometry = C.WallGeometry.createGeometry(new C.WallGeometry({positions: ends,
    minimumHeights: [low, low], maximumHeights: [high, high],
    vertexFormat: C.MaterialAppearance.MaterialSupport.TEXTURED.vertexFormat,
  }));
  const order = [], physicalUV = Array(4);
  assert.equal(geometry.attributes.position.values.length, 12);
  for (let i = 0; i < 4; i++) {
    const point = new C.Cartesian3(...geometry.attributes.position.values.slice(i * 3, i * 3 + 3));
    const distances = positions.map(v => C.Cartesian3.distance(v, point));
    const source = distances.indexOf(Math.min(...distances));
    assert(distances[source] < 1e-7, 'Wall output must match the actual app wall corners');
    order.push(source); physicalUV[source] = Array.from(geometry.attributes.st.values.slice(i * 2, i * 2 + 2));
  }
  assert.equal([...order].sort().join(','), '0,1,2,3');
  assert.deepEqual(physicalUV, [[0, 0], [1, 0], [1, 1], [0, 1]], 'Existing rectangular UV orientation must stay unchanged');
  return {positions, physicalUV, indices: Array.from(geometry.indices).map(i => order[i])};
}

const args = process.argv.slice(2), update = args[0] === '--update-cache';
const enginePath = update ? args[1] : args[0];
let C;
if (enginePath) {
  const bytes = fs.readFileSync(enginePath);
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), COPLANAR_UV_ENGINE_SHA256, 'Use the pinned official Cesium engine');
  C = vm.runInThisContext(bytes.toString('utf8') + ';Cesium;');
  assert.equal(C.VERSION, COPLANAR_UV_ENGINE_VERSION);
}
if (update) {
  assert(C, '--update-cache requires the pinned local Cesium engine path');
  const placements = {};
  for (const {alias, placementIndex, placement} of corpus) {
    const {uvOrder, indices} = engineMapping(C, placement, APPROVED_REPLACEMENT_IMAGE_OFFSET_METERS);
    placements[coplanarPlacementFingerprint(placement)] = {alias, placementIndex, uvOrder, indices};
  }
  const entries = Object.values(placements), changed = entries.filter(p => p.uvOrder.some((v, i) => v !== i));
  const frameSurfaces = Object.fromEntries(F02WL072_FRAME.surfaces.map(surface => {
    const {coords, indices} = frameEngineMapping(C, surface);
    return [frameSurfaceFingerprint(surface), {id: surface.id, coords, indices}];
  }));
  fs.writeFileSync(COPLANAR_UV_CACHE_URL, JSON.stringify({schema: 1,
    engineVersion: C.VERSION, engineSHA256: COPLANAR_UV_ENGINE_SHA256, engineSource: COPLANAR_UV_ENGINE_SOURCE,
    imageOffset: APPROVED_REPLACEMENT_IMAGE_OFFSET_METERS,
    basis: 'Actual engine output positions matched to approved source corners; output float32 ST matched to approved UVs. Original source coordinates and photographs are unchanged.',
    counts: {rows: new Set(entries.map(p => p.alias)).size, placements: entries.length,
      remappedRows: new Set(changed.map(p => p.alias)).size, remappedPlacements: changed.length,
      exactFrameSurfaces: F02WL072_FRAME.surfaces.length}, placements, frameSurfaces,
  }, null, 2) + '\n');
}

const contract = coplanarUVContractInfo(), changed = new Set();
let remappedPlacements = 0;
for (const {alias, placement} of corpus) {
  const normalized = normalizeCoplanarSurfaceUV(placement);
  if (normalized.changed) {changed.add(alias); remappedPlacements++;}
  if (C) for (const offset of [0, .055, APPROVED_REPLACEMENT_IMAGE_OFFSET_METERS, .075]) {
    const actual = engineMapping(C, placement, offset);
    assert.deepEqual(normalized.coords.map(v => v.map(Math.fround)), actual.physicalUV, `${alias}: physical UV correspondence`);
    assert.deepEqual(normalized.indices, actual.indices, `${alias}: physical triangle topology`);
  }
}
assert.equal(changed.size, 15);
assert.equal(remappedPlacements, 32);
assert.deepEqual(contract.counts, {rows: 31, placements: 96, remappedRows: 15, remappedPlacements: 32, exactFrameSurfaces: 6});
// Terarosa front was upside down; its side must keep the already-correct UVs.
for (const r of corpus.filter(r => r.alias === 'F03WL006-S01')) assert(normalizeCoplanarSurfaceUV(r.placement).changed);
for (const r of corpus.filter(r => r.alias === 'F03WL005-S01')) assert(!normalizeCoplanarSurfaceUV(r.placement).changed);
// A new/unverified placement must not silently guess the engine's winding.
const unknown = structuredClone(corpus[0].placement); unknown.corners_wgs84[0][2] += .000001;
assert.throws(() => normalizeCoplanarSurfaceUV(unknown), /Unverified Commons coplanar surface/);
assert.deepEqual(fs.readFileSync(frozenURL), frozenBytes, 'Never modify the approved inputs');
// Keep this copied contract tied to the original renderer's actual constants.
const app = fs.readFileSync(new URL('../app/app.js', import.meta.url), 'utf8');
assert.match(app, /const APPROVED_REPLACEMENT_IMAGE_OFFSET_METERS = \.065;/);
const frameSource = fs.readFileSync(new URL('../app/f02wl072-frame.js', import.meta.url), 'utf8');
assert.match(frameSource, /Cesium\.Cartesian3\.fromDegrees\(126\.97082, 37\.55363, 27\.2\)/);
assert.equal(F02WL072_FRAME.imageOffset, .015);
assert.equal(new Set(F02WL072_FRAME.surfaces.map(frameSurfaceFingerprint)).size, 6);
const frameReplacement = approved.find(isF02wl072FrameReplacement);
assert(frameReplacement);
for (const surface of F02WL072_FRAME.surfaces) {
  const approvedPlacement = frameReplacement.slot.surface_placements.find(p => p.placement_id === surface.id);
  assert.deepEqual(approvedPlacement.corners_wgs84, surface.corners);
  assert.deepEqual(approvedPlacement.normal_enu, surface.normalEnu);
  const normalized = normalizeApprovedFrameUV(surface);
  if (C) {
    const actual = frameEngineMapping(C, surface);
    assert.deepEqual(normalized.coords, actual.coords);
    assert.deepEqual(normalized.indices, actual.indices);
  }
}
if (C) for (const {placement} of wallCorpus) wallEngineMapping(C, placement);
// Optional generated-hall verification checks the whole build contract against
// actual engine ECEF positions, STs and physical topology, including frame faces.
if (C && args.includes('--verify-hall')) {
  const hall = JSON.parse(fs.readFileSync(new URL('../public/data/commons/hall.json', import.meta.url)));
  const transform = C.Matrix4.inverseTransformation(C.Transforms.eastNorthUpToFixedFrame(
    C.Cartesian3.fromDegrees(hall.origin.lon, hall.origin.lat, hall.origin.height)), new C.Matrix4());
  const verify = (face, index, actual, coords) => {
    actual.positions.forEach((p, i) => {
      const enu = C.Matrix4.multiplyByPoint(transform, p, new C.Cartesian3());
      const expected = [enu.x - hall.origin.east0, enu.z - hall.origin.up0, hall.origin.north0 - enu.y];
      assert(expected.every((v, k) => Math.abs(v - face.positions[index * 12 + i * 3 + k]) < .00051), `${face.alias}: exact offset corners`);
      assert(coords[i].every((v, k) => Math.abs(v - face.detailUV[index * 8 + i * 2 + k]) < .0000011), `${face.alias}: generated detail UV`);
    });
    assert.deepEqual(face.indices.slice(index * 6, index * 6 + 6), actual.indices.map(i => i + index * 4), `${face.alias}: generated triangles`);
  };
  for (const r of corpus) {
    const face = hall.facades.find(f => f.alias === r.alias);
    const actual = engineMapping(C, r.placement, APPROVED_REPLACEMENT_IMAGE_OFFSET_METERS);
    verify(face, r.placementIndex, actual, actual.physicalUV);
  }
  const face = hall.facades.find(f => f.alias === F02WL072_FRAME.slotAlias);
  assert.deepEqual(face.geometryBasis, ['approved-exact-frame']);
  for (const [i, surface] of F02WL072_FRAME.surfaces.entries()) {
    const actual = frameEngineMapping(C, surface);
    verify(face, i, actual, actual.coords);
  }
  const triangleSet = indices => Array.from({length: indices.length / 3}, (_, i) =>
    indices.slice(i * 3, i * 3 + 3).sort((a, b) => a - b).join(',')).sort();
  for (const {alias, placementIndex, placement} of wallCorpus) {
    const face = hall.facades.find(f => f.alias === alias), actual = wallEngineMapping(C, placement);
    actual.positions.forEach((p, i) => {
      const enu = C.Matrix4.multiplyByPoint(transform, p, new C.Cartesian3());
      const expected = [enu.x - hall.origin.east0, enu.z - hall.origin.up0, hall.origin.north0 - enu.y];
      assert(Math.hypot(...expected.map((v, k) => v - face.positions[placementIndex * 12 + i * 3 + k])) < .002,
        `${alias}: rectangular planar approximation stays within 2mm of actual Cesium wall`);
      assert.deepEqual(face.detailUV.slice(placementIndex * 8 + i * 2, placementIndex * 8 + i * 2 + 2), actual.physicalUV[i]);
    });
    assert.deepEqual(triangleSet(face.indices.slice(placementIndex * 6, placementIndex * 6 + 6).map(i => i - placementIndex * 4)),
      triangleSet(actual.indices), `${alias}: rectangular wall triangulation`);
  }
}
console.log(JSON.stringify({coplanarUV: 'pass', actualEngineCompared: Boolean(C), ...contract.counts,
  rectangularPatches: wallCorpus.filter(r => !r.fallback).length, slotFallbacks: wallCorpus.filter(r => r.fallback).length,
  offsets: C ? [0, .055, .065, .075] : undefined}));
