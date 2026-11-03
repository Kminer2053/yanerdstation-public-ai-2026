import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Physical UVs before Cesium independently reverses the lower three quads.
const physical = [[[0.9990289399178264,0.9998351640513288],[0.4995144699589132,0.9999175820256642],[0.33322722668924537,0.6666599097477148],[0.4998408400115193,0.4999898645295846]],[[0,1],[0.00032637005260611443,0.50007228250392],[0.33322722668924537,0.6666599097477148],[0.4995144699589132,0.9999175820256642]],[[0.0006527401052110008,0.00014456500783988256],[0.4998408400115193,0.4999898645295846],[0.33322722668924537,0.6666599097477148],[0.00032637005260611443,0.50007228250392]],[[0.0006527401052110008,0.00014456500783988256],[0.5003263700526055,0.00007228250391994128],[0.6665605600069779,0.33332657642010466],[0.4998408400115193,0.4999898645295846]],[[1,0],[0.9995144699589138,0.49991758202566416],[0.6665605600069779,0.33332657642010466],[0.5003263700526055,0.00007228250391994128]],[[0.9990289399178264,0.9998351640513288],[0.4998408400115193,0.4999898645295846],[0.6665605600069779,0.33332657642010466],[0.9995144699589138,0.49991758202566416]]];
const data = JSON.parse(fs.readFileSync(new URL('../public/data/jury-frozen/approved-facades.json', import.meta.url)));
const r = data.replacements.find(r => r.slot?.slot_alias === 'F02WL035-S01');
assert.equal(r.slot.surface_placements.length, 6);
assert.equal(r.image_url, '/data/jury-frozen/images/92c770a8b1223ae49a18d5196d733962d532c46268cda8355fae4a8d41e582d2.png');
for (const [i, p] of r.slot.surface_placements.entries()) {
  assert.deepEqual(p.texture_coordinates, i < 3 ? physical[i] : physical[i].toReversed());
}
if (process.argv[2]) {
  const C = vm.runInThisContext(fs.readFileSync(process.argv[2], 'utf8') + ';Cesium;');
  assert.equal(C.VERSION, '1.142.0');
  for (const [i, p] of r.slot.surface_placements.entries()) {
    for (const offset of [0, .055, .065, .075]) {
      const frame = C.Transforms.eastNorthUpToFixedFrame(C.Cartesian3.fromDegrees(p.longitude, p.latitude, 0));
      const n = C.Matrix4.multiplyByPointAsVector(frame, new C.Cartesian3(...p.normal_enu), new C.Cartesian3());
      C.Cartesian3.normalize(n, n);
      C.Cartesian3.multiplyByScalar(n, offset, n);
      const positions = p.corners_wgs84.map(v => C.Cartesian3.add(C.Cartesian3.fromDegrees(...v), n, new C.Cartesian3()));
      const build = uv => C.CoplanarPolygonGeometry.createGeometry(new C.CoplanarPolygonGeometry({
        polygonHierarchy: new C.PolygonHierarchy(positions),
        textureCoordinates: new C.PolygonHierarchy(uv.map(v => new C.Cartesian2(...v))),
        vertexFormat: C.MaterialAppearance.MaterialSupport.TEXTURED.vertexFormat,
      }));
      const before = build(physical[i]), after = build(p.texture_coordinates);
      assert.deepEqual(after.attributes.position.values, before.attributes.position.values);
      assert.deepEqual(after.indices, before.indices);
      for (let j = 0; j < 4; j++) {
        const v = new C.Cartesian3(...after.attributes.position.values.slice(j * 3, j * 3 + 3));
        const distances = positions.map(x => C.Cartesian3.distance(x, v));
        const source = distances.indexOf(Math.min(...distances));
        assert(distances[source] < 1e-7);
        for (let k = 0; k < 2; k++) assert.equal(after.attributes.st.values[j * 2 + k], Math.fround(physical[i][source][k]));
      }
    }
  }
}
console.log('F02WL035-S01: all six facade pieces correctly map the original photograph; geometry unchanged.');
