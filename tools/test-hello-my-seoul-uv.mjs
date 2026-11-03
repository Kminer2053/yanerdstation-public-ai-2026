import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Physical UVs before Cesium independently reverses the lower three quads.
const physical = [[[1,0.9926076495951504],[0.5000000000000006,0.9963038247975754],[0.33406243639441463,0.6661720990372292],[0.5010936546074551,0.49925814859481327]],[[0,1],[0.0010936546074569891,0.5029543237972388],[0.33406243639441463,0.6661720990372292],[0.5000000000000006,0.9963038247975754]],[[0.002187309214912759,0.0059086475944771484],[0.5010936546074551,0.49925814859481327],[0.33406243639441463,0.6661720990372292],[0.0010936546074569891,0.5029543237972388]],[[0.002187309214912759,0.0059086475944771484],[0.5006617663999148,0.00295432379723833],[0.6671078442429837,0.3328387657587738],[0.5010936546074551,0.49925814859481327]],[[0.999136223584918,0],[0.9995681117924584,0.4963038247975754],[0.6671078442429837,0.3328387657587738],[0.5006617663999148,0.00295432379723833]],[[1,0.9926076495951504],[0.5010936546074551,0.49925814859481327],[0.6671078442429837,0.3328387657587738],[0.9995681117924584,0.4963038247975754]]];
const data = JSON.parse(fs.readFileSync(new URL('../public/data/jury-frozen/approved-facades.json', import.meta.url)));
const r = data.replacements.find(r => r.slot?.slot_alias === 'F02WL033-S01');
assert.equal(r.slot.surface_placements.length, 6);
assert.equal(r.image_url, '/data/jury-frozen/images/6d3db31773517ecc13a4f38b7173afade8916daca9152d913d223a4dd5d6bd4c.png');
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
console.log('F02WL033-S01: all six facade pieces correctly map the original photograph; geometry unchanged.');
