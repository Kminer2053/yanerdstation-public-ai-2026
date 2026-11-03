import assert from 'node:assert/strict';
import fs from 'node:fs';
import {TRAIN_MATES as a,TRAIN_MATES_SURFACES as surfaces,TRAIN_MATES_ESCALATOR_EDGE as edge,TRAIN_MATES_WEST_ENTRANCE as door,trainMatesPoint,isTrainMatesSlot} from '../app/seoul-train-mates.js';
assert.equal(a.id,'TRAIN-MATES-SEOUL-2F');
assert.deepEqual([a.centerEast,a.centerNorth,a.baseUp,a.headingDeg],[-95.029287651896,-40.782623097138,36.23,19.9704431]);
assert.deepEqual([a.width,a.depth,a.height,a.signHeight],[9.792,4.608,2.72,.49]);
const center=trainMatesPoint(a,0,0,0),front=trainMatesPoint(a,0,-a.depth/2,0),right=trainMatesPoint(a,a.width/2,0,0);
const heading=p=>(Math.atan2(p[0]-center[0],p[1]-center[1])*180/Math.PI+360)%360;
assert(Math.abs(heading(front)-(a.headingDeg+180))<1e-8);assert(Math.abs(heading(right)-(a.headingDeg+90))<1e-8);
const length=Math.hypot(edge.end[0]-edge.start[0],edge.end[1]-edge.start[1]);
for(const x of [-a.width/2,a.width/2]){
  const p=trainMatesPoint(a,x,a.depth/2,0),delta=p.slice(0,2).map((v,i)=>v-edge.start[i]);
  const gap=p.slice(0,2).reduce((sum,v,i)=>sum+v*edge.inwardNormal[i],0)-edge.supportingOffset;
  const along=delta.reduce((sum,v,i)=>sum+v*edge.tangent[i],0);
  assert(Math.abs(gap)<1e-6,`rear corner gap/overlap ${gap}`);
  assert(along>0&&along<length,'both rear corners fit on actual escalator edge');
}
assert.equal(door.id,'west-entrance');assert(door.width>.9&&door.height>2);
assert(door.centerY<0,'west doorway follows the photo right, toward local south');
assert(Math.abs(door.centerY)+door.width/2<a.depth/2);
assert.equal(new Set(surfaces.map(s=>s.alias)).size,3);
const west=surfaces.find(s=>s.id==='west-side'),east=surfaces.find(s=>s.id==='east-side');
assert.equal(west.image,east.image,'exact same baseline image, independent slots');
assert.equal(west.alias,'TRAIN-MATES-LEFT-S01');
assert.notEqual(west.alias,east.alias);
assert(Math.abs(heading(trainMatesPoint(a,-a.width/2,0,0))-(a.headingDeg+270))<1e-8);
for(const s of surfaces){
  assert(isTrainMatesSlot({slot_alias:s.alias}));
  const bytes=fs.readFileSync(new URL(`../public${s.image}`,import.meta.url));
  assert.equal(bytes.toString('hex',0,8),'89504e470d0a1a0a');assert(bytes.readUInt32BE(16)>1000);
}
assert(!isTrainMatesSlot({target_asset_id:'SEOUL-2F-TRUEDAN'}));
const app=fs.readFileSync(new URL('../app/app.js',import.meta.url),'utf8');
const renderer=fs.readFileSync(new URL('../app/seoul-train-mates.js',import.meta.url),'utf8');
const visible=app.split('\n').find(l=>l.includes('vworld.assets.show = SHOW_TRAIN_MATES'));
assert(visible&&!visible.includes('CATALOG_FOCUS'),'catalog focus must not hide the shop');
assert(visible.includes('state.layers.shops')&&visible.includes('TRAIN_MATES.floor'));
assert(app.includes('escalator-flush-v8'));assert(app.includes('vworld.trainMatesFacades?.destroy()'));
assert(app.includes('if (isTrainMatesSlot(slot)) continue;'),'no duplicate generic approved plane');
assert(renderer.includes('1.0-cropMin.y-(1.0-t)*cropSpan.y'));
assert(renderer.includes("flipV:surface.id==='east-side'?1:0"));
assert(!renderer.includes('1.0-materialInput.st.x'),'never mirror the letters');
assert(renderer.includes("photo(west,'west-side',[[-w,d,0],[-w,-d,0],[-w,-d,h],[-w,d,h]]"),'west corners wind outward');
assert(renderer.includes('[0,120/770],[1,650/770]'));
assert(renderer.includes('[506/2042,6/770],[1030/2042,111/770]'),'exclude all checkerboard atlas corners');
assert(!renderer.includes('customShader')&&!renderer.includes('tileset'),'no original structure retirement');
assert(!renderer.includes("box('west',"),'no full blocking west wall behind doorway');
for(const id of ['west-south','west-north','west-entrance-lintel'])assert(renderer.includes(id));
console.log('TRAIN MATES: flush anchors, three surface orientations, shared east/west baseline, independent slots, atlas masks and lifecycle passed.');
