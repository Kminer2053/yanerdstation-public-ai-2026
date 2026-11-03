import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {INFORMATION_CENTER as a,INFORMATION_CENTER_SURFACES as surfaces,informationCenterPoint,
  informationCenterQuad,informationCenterNormalHeading,informationCenterRetirementStyleConditions,
  isInformationCenterSlot,isRetiredInformationCenterSlot} from '../app/seoul-information-center.js';
assert.equal(surfaces.length,4);assert.equal(new Set(surfaces.map(s=>s.slotKey)).size,4);
assert.equal(a.retired.features.reduce((n,f)=>n+f.triangles,0),1136);
assert.deepEqual(a.retired.preserveModels,['F02PL004','F02FL005']);
assert.equal(informationCenterRetirementStyleConditions('S201801').length,0);
const condition=informationCenterRetirementStyleConditions(a.site)[0];
assert.equal(condition[1],false);assert.match(condition[0],/F02FC074/);assert.match(condition[0],/TD_ID/);
assert.doesNotMatch(condition[0],/PL004|FC011|FC086/);
assert.ok(isRetiredInformationCenterSlot({site_id:a.site,slot_alias:a.retired.slotAlias,slot_key:a.retired.slotKey}));
assert.ok(!isRetiredInformationCenterSlot({site_id:'S201801',slot_alias:a.retired.slotAlias,slot_key:a.retired.slotKey}));
const corners=[[-a.width/2,a.depth/2],[a.width/2,a.depth/2],[a.width/2,-a.depth/2],[-a.width/2,-a.depth/2]].map(p=>informationCenterPoint(...p));
const expected=[[-5.866659,55.529730],[5.211469,55.718357],[5.378959,45.881571],[-5.699168,45.692944]];
corners.forEach((p,i)=>assert.ok(Math.hypot(p[0]-expected[i][0],p[1]-expected[i][1])<.00001));
for(const s of surfaces){
  assert.equal(crypto.createHash('sha256').update(`${a.site}:APP_ASSET:${a.id}:${s.id}`).digest('hex'),s.slotKey);
  assert.ok(isInformationCenterSlot({site_id:a.site,slot_key:s.slotKey}));
  const q=informationCenterQuad(s),u=q[1].map((v,i)=>v-q[0][i]),v=q[3].map((v,i)=>v-q[0][i]);
  const n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
  const outward={north:[0,1],south:[0,-1],east:[1,0],west:[-1,0]}[s.direction];
  assert.ok(n[0]*outward[0]+n[1]*outward[1]>0,`${s.direction} outward winding`);
  const heading=informationCenterNormalHeading(s);assert.ok(heading>=0&&heading<360);
  const bytes=fs.readFileSync(new URL(`../public${s.image}`,import.meta.url));
  assert.equal(bytes.readUInt32BE(16),2172);assert.equal(bytes.readUInt32BE(20),724);
}
assert.equal(surfaces[2].image,surfaces[3].image);
const source=fs.readFileSync(new URL('../app/seoul-information-center.js',import.meta.url),'utf8');
assert.match(source,/new C.Geometry\(/);assert.match(source,/new Float32Array\(\[0,0,1,0,1,1,0,1\]\)/);
assert.doesNotMatch(source,/czm_materialInput input\)/);
assert.match(source,/228\/724/);assert.match(source,/561\/2172/);assert.match(source,/request!==r.request/);
const app=fs.readFileSync(new URL('../app/app.js',import.meta.url),'utf8');
for(const name of ['informationCenterRetirementStyleConditions','createInformationCenter','isRetiredInformationCenterSlot','catalogFocusedInformationCenter']) assert.match(app,new RegExp(name));
assert.match(app,/informationCenter\?\.setReplacements/);
console.log('Information center: exact retirement, preserved neighbors, boundary, 4 surfaces, outward UV, image dimensions, routing PASS');
