import assert from 'node:assert/strict';
import fs from 'node:fs';
import {PLATFORM111 as original,PLATFORM111_WINDOW as windowLayout,PLATFORM111_SURFACES as surfaces,platform111Spans,platform111SurfaceCenter,platform111VisibleOnFloor,isPlatform111Slot} from '../app/seoul-platform111.js';
const near=(a,b,eps=1e-8)=>assert(Math.abs(a-b)<eps,`${a} != ${b}`);
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
assert.equal(original.length,111);
assert.equal(original.floor,'2F');assert.equal(windowLayout.floor,'3F');
assert.equal(windowLayout.points.length,32);
assert.equal(windowLayout.source.component,'B_1_24_15:C48');
assert.equal(windowLayout.source.model,'F03WL011');
assert.equal(windowLayout.backingHeightExtra,0,'no trim/skirt into the void');
near(windowLayout.height,5.306034240067561);
for(const layout of [original,windowLayout]){
 const sum=layout.points.slice(1).reduce((s,b,i)=>s+distance(layout.points[i],b),0);near(sum,layout.length,1e-5);
 const spans=surfaces.flatMap(surface=>{
  const spans=platform111Spans(surface,layout);near(spans[0].start,surface.start);near(spans.at(-1).end,surface.end,1e-5);
  const center=platform111SurfaceCenter(surface,layout);assert(center.every(Number.isFinite));
  assert(isPlatform111Slot({site_id:original.site,slot_key:surface.slotKey}));
  return spans;
 });
 near(spans.reduce((s,p)=>s+p.physicalLength,0),layout.length,1e-5);
 for(let i=1;i<spans.length;i++){
  spans[i].a.forEach((v,k)=>near(v,spans[i-1].b[k]));near(spans[i].start,spans[i-1].end);
 }
 if(layout===windowLayout)for(const p of spans){
  near(p.a[2],15.122534058744598);near(p.b[2]+layout.height,20.42856829881216);
 }
}
assert.deepEqual(['B1','1F','2F','3F','4F'].map(platform111VisibleOnFloor),[false,false,true,true,false]);
const app=fs.readFileSync(new URL('../app/app.js',import.meta.url),'utf8');
assert.match(app,/platform111\?\.setVisible\(platform111Visible && state.floor === PLATFORM111.floor\)/);
assert.match(app,/platform111Window\?\.setVisible\(platform111Visible && state.floor === PLATFORM111_WINDOW.floor\)/);
assert.match(app,/platform111Window\?\.setReplacements\(vworld.approvedReplacements\)/);
assert.match(app,/const openingGuardrailVisible = state.floor === OPENING_GUARDRAIL.floor/);
console.log(JSON.stringify({passed:true,originalFacilityLength:original.length,windowLength:windowLayout.length,windowHeight:windowLayout.height,catalogSlotsReused:surfaces.map(s=>s.alias),continuousSeams:true,noDownwardSkirt:true}));
