import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
import {isCoplanarSurfacePlacement} from '../src/replacement-surface-contract.js';

// Physical corner UVs: bottom-left, bottom-right, top-right, top-left.
const physicalUv = [[0, 0.000007326554554796269], [1, 0],
  [0.9999957108256844, 1], [0.000015549001960399392, 0.9999812045306858]];
const manifest = JSON.parse(fs.readFileSync(new URL('../public/data/jury-frozen/approved-facades.json', import.meta.url)));
const matches = manifest.replacements.filter(r => r.slot?.slot_alias === 'F01WL018-S08');
assert.equal(matches.length, 1);
const replacement = matches[0], placement = replacement.slot.surface_placements[0];
assert.equal(replacement.slot.site_id, 'S202103');
assert.equal(replacement.slot.surface_placements.length, 1);
assert(isCoplanarSurfacePlacement(placement));
assert.deepEqual(placement.texture_coordinates, physicalUv.toReversed());
assert.equal(crypto.createHash('sha256').update(fs.readFileSync(
  new URL(`../public${replacement.image_url}`, import.meta.url))).digest('hex'),
  '6bbfd02965406308ab929f10d0f32974f534de537045d049c21720b5fa35f1da', 'keep the upright original photo unchanged');

// Optional real-engine regression. Supply the same Cesium.js release as app/index.html.
// The lightweight renderer mock cannot detect independent geometry/ST reordering.
if (process.argv[2]) {
  const C = vm.runInThisContext(fs.readFileSync(process.argv[2], 'utf8') + ';Cesium;');
  assert.equal(C.VERSION, '1.142.0');
  for (const offset of [0, .055, .065, .075]) {
    const frame = C.Transforms.eastNorthUpToFixedFrame(C.Cartesian3.fromDegrees(placement.longitude, placement.latitude, 0));
    const normal = C.Matrix4.multiplyByPointAsVector(frame, new C.Cartesian3(...placement.normal_enu), new C.Cartesian3());
    C.Cartesian3.normalize(normal, normal);
    C.Cartesian3.multiplyByScalar(normal, offset, normal);
    const positions = placement.corners_wgs84.map(p => C.Cartesian3.add(C.Cartesian3.fromDegrees(...p), normal, new C.Cartesian3()));
    const build = uv => C.CoplanarPolygonGeometry.createGeometry(new C.CoplanarPolygonGeometry({
      polygonHierarchy: new C.PolygonHierarchy(positions),
      textureCoordinates: new C.PolygonHierarchy(uv.map(p => new C.Cartesian2(...p))),
      vertexFormat: C.MaterialAppearance.MaterialSupport.TEXTURED.vertexFormat,
    }));
    const before = build(physicalUv), after = build(placement.texture_coordinates);
    assert.deepEqual(after.attributes.position.values, before.attributes.position.values);
    assert.deepEqual(after.indices, before.indices);
    const order = [];
    let beforeError = 0;
    for (let i = 0; i < 4; i++) {
      const vertex = new C.Cartesian3(...after.attributes.position.values.slice(i * 3, i * 3 + 3));
      const distances = positions.map(p => C.Cartesian3.distance(vertex, p));
      const source = distances.indexOf(Math.min(...distances));
      assert(distances[source] < 1e-7);
      order.push(source);
      for (let j = 0; j < 2; j++) {
        assert.equal(after.attributes.st.values[i * 2 + j], Math.fround(physicalUv[source][j]));
        beforeError = Math.max(beforeError, Math.abs(before.attributes.st.values[i * 2 + j] - physicalUv[source][j]));
      }
    }
    assert.deepEqual(order, [3, 2, 1, 0]);
    assert(beforeError > .99, 'reproduce the original vertical inversion');
  }
  console.log('Actual Cesium 1.142: original inversion reproduced; corrected UV error 0 (Float32), geometry unchanged at all 4 offsets.');
}
console.log('F01WL018-S08: scoped upright facade mapping and original-image hash passed.');
