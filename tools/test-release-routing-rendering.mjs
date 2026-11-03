import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRetirementTriangleTable} from '../app/retirement-triangle-table.js';
import {seoulVworldRetirementShaderText} from '../app/seoul-vworld-retirement.js';
const read=p=>JSON.parse(fs.readFileSync(new URL('../'+p,import.meta.url),'utf8'));
const table=createRetirementTriangleTable(), shader=seoulVworldRetirementShaderText(table);
assert(shader.length<20000,`Shader unexpectedly expanded: ${shader.length}`);
assert.equal(table.data.length%20,0);
let triangles=0;
for(const name of ['feedback','celadon','s11','s38','wood-display','lounge-sign','photobooth']) {
  const t=createRetirementTriangleTable(),source=read(`app/seoul-${name}-retirement.json`).triangles;
  t.checks(source); const data=t.data;
  assert.equal(data[0],source.length);
  source.forEach((s,i)=>{
    const row=data.slice((i+1)*20,(i+2)*20), p=[0,1,2].map(k=>s.points.reduce((sum,v)=>sum+v[k],0)/3);
    const q=p.map((v,k)=>v-row[k]);
    const dotAt=at=>q.reduce((sum,v,k)=>sum+v*row[at+k],0);
    assert(Math.abs(dotAt(4))<0.002,`${name} plane ${i}`);
    const u=dotAt(8),v=dotAt(12);
    assert(u>0 && v>0 && u+v<1,`${name} barycentric ${i}`);
    const uv=[row[3]+u*(row[11]-row[3])+v*(row[16]-row[3]),row[7]+u*(row[15]-row[7])+v*(row[17]-row[7])];
    uv.forEach((n,k)=>assert(Math.abs(n-s.uv.reduce((sum,a)=>sum+a[k],0)/3)<1e-5,`${name} UV ${i}`));
    triangles++;
  });
}
const w=read('public/data/experience/walk-graph.json'), routes=read('public/data/experience/facility-routes.json');
const r=routes.find(r=>r.routing_policy==='reviewed_escalator_F02MV007-4');
assert(r); assert.equal(routes.length,496); assert.equal(w.revision,337);
assert.equal(w.connections.filter(c=>c.direction==='forward').length,22);
const c=w.connections.find(c=>c.id==='AUTO-F02MV007-4-1');
const start=r.point_ids.indexOf(c.from);
assert.deepEqual(r.point_ids.slice(start,start+c.path.length),c.path);
assert.equal(r.connections,1); assert(r.distance_m>122 && r.distance_m<124);
const ids=new Map(w.points.map((p,i)=>[p[0],i]));
for(let i=0;i<r.point_ids.length-1;i++) {
  if(i>=start && i<start+c.path.length-1) continue;
  const a=ids.get(r.point_ids[i]),b=ids.get(r.point_ids[i+1]);
  assert(w.adj[a].some(e=>e[0]===b && !e[2]),`Unverified approach edge ${i}`);
  assert.equal(w.points[a][1],w.points[b][1]);
}
assert.equal(r.coordinates.length,r.point_ids.length);
assert.equal(r.floors.length,r.point_ids.length);
console.log(`PASS: ${shader.length}-character compact shader; ${triangles} reviewed triangle coefficients/UVs; directed escalator itinerary and mesh-verified approaches.`);
