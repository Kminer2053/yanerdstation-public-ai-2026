import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import sharp from 'sharp';
import {GTX_WALL_PHOTO as config, gtxWallPhotoMesh, gtxBarricadeRetirementStyleConditions, createGtxWallPhoto} from '../app/seoul-gtx-wall-photo.js';

const mesh = gtxWallPhotoMesh();
assert.equal(mesh.positions.length, 8);
assert.equal(mesh.indices.length, 12);
assert.equal(mesh.normals.length, 8);
assert.equal(mesh.st.length, 16);
assert(Math.abs(mesh.availableWidth - 12) < .001);
assert(mesh.width <= mesh.availableWidth);
if (config.fit === 'contain') assert(Math.abs(mesh.width / config.height - config.imageAspect) < 1e-12);
for (const p of mesh.positions) assert(p.every(Number.isFinite));
for (const n of mesh.normals) {
  assert(Math.abs(Math.hypot(...n) - 1) < 1e-12);
  assert(n[0] < -.99, 'photo must face west toward the old concourse');
}
assert.equal(mesh.st[0], 0);
assert(Math.abs(mesh.st.at(-4) - 1) < 1e-12);
assert.equal(mesh.st[2], mesh.st[8], 'texture must join continuously across the wall seam');
for (let i = 0; i < 2; i++) {
  const [a,b,c,d] = mesh.positions.slice(i * 4, i * 4 + 4);
  assert(Math.abs(c[2] - b[2] - config.height) < 1e-12);
  assert(Math.abs(d[2] - a[2] - config.height) < 1e-12);
}
const metadata = await sharp(new URL(`../public${config.image}`, import.meta.url).pathname).metadata();
assert(Math.abs(metadata.width / metadata.height - config.imageAspect) < 1e-12);
assert.equal(createGtxWallPhoto(null, null, 'S202107'), null);
const matches = properties => gtxBarricadeRetirementStyleConditions('S202103').some(([expression, show]) =>
  !show && Function('p', `return ${expression.replace(/\$\{([A-Z_]+)\}/g, (_, key) => `p["${key}"]`)}`)(properties));
const barrier = {FLOOR:'B1', MODEL_NAME:'B01MV025', TD_ID:'b00540045882500332207829900'};
assert(matches(barrier));
for (const p of [{...barrier, FLOOR:'2F'}, {...barrier, MODEL_NAME:'B01MV026'}, {...barrier, MODEL_NAME:'B01WL009'}, {...barrier, TD_ID:'other'}]) assert(!matches(p));
assert.deepEqual(gtxBarricadeRetirementStyleConditions('S202107'), []);
config.enabled = false;
assert.deepEqual(gtxBarricadeRetirementStyleConditions('S202103'), []);
assert.equal(createGtxWallPhoto(null, null, 'S202103'), null);
config.enabled = true;

// The abandoned expansion must not affect any existing common shader.
const baseline = execFileSync('git', ['show','7d81bc35d69143d49fecb56c2a9101c31dab9091:app/seoul-vworld-retirement.js'], {encoding:'utf8'});
assert.equal(fs.readFileSync(new URL('../app/seoul-vworld-retirement.js', import.meta.url), 'utf8'), baseline);
const app = fs.readFileSync(new URL('../app/app.js', import.meta.url), 'utf8');
assert(!app.includes('createGtxTransfer'));
assert(!app.includes('u_gtxTransferEnabled'));
assert(!app.includes('seoul-gtx-retirement'));
assert(app.includes('gtxBarricadeRetirementStyleConditions(VWORLD_CONFIG.siteId)'));
const photoSource = fs.readFileSync(new URL('../app/seoul-gtx-wall-photo.js', import.meta.url), 'utf8');
for (const prohibited of ['CustomShader', 'box:', 'polygon:', 'GridMaterial', 'dataSources.add', 'setInterval', 'preRender.addEventListener']) assert(!photoSource.includes(prohibited));
assert.equal((photoSource.match(/new C\.Primitive\(/g) || []).length, 1);
console.log(JSON.stringify({mode:config.mode, photoWidthM:mesh.width, availableWallWidthM:mesh.availableWidth, heightM:config.height, triangles:mesh.indices.length/3, primitives:1, textures:1, sharedShaderUnchanged:true, targetedRailOnly:true, sourceWallsAndFloorRetained:true}));
