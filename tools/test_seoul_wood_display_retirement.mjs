import assert from "node:assert/strict";
import fs from "node:fs";
import { WOOD_DISPLAY_RETIREMENT as data, woodDisplayRetirementShaderDeclarations } from "../app/seoul-wood-display-retirement.js";
import { seoulVworldRetirementShaderText } from "../app/seoul-vworld-retirement.js";
import { retirementShaderText } from "../app/seoul-truedan.js";
const preserved = JSON.parse(fs.readFileSync(new URL("./fixtures/wood-display-preserved-triangles.json", import.meta.url), "utf8"));
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),sub=(a,b)=>a.map((v,i)=>v-b[i]);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
function matches(t,p,uv){
  const [a,b,c]=t.points,x=sub(b,a),y=sub(c,a),q=sub(p,a),n=cross(x,y),nn=Math.hypot(...n);
  if(Math.abs(dot(q,n)/nn)>.002)return false;
  const xx=dot(x,x),yy=dot(y,y),xy=dot(x,y),den=xx*yy-xy*xy;
  const u=(yy*dot(q,x)-xy*dot(q,y))/den,v=(xx*dot(q,y)-xy*dot(q,x))/den;
  if(u < -1e-7 || v < -1e-7 || u+v > 1+1e-7)return false;
  return uv.every((value,i)=>Math.abs(value-(t.uv[0][i]+u*(t.uv[1][i]-t.uv[0][i])+v*(t.uv[2][i]-t.uv[0][i])))<=1e-5);
}
const hidden=(p,uv)=>data.enabled&&p.every((v,i)=>v>=data.broadPhaseBounds.min[i]&&v<=data.broadPhaseBounds.max[i])&&data.triangles.some(t=>matches(t,p,uv));
const interpolate=(a,u,v)=>a[0].map((x,i)=>x*(1-u-v)+a[1][i]*u+a[2][i]*v);
const samples=[];for(let i=0;i<=8;i++)for(let j=0;j<=8-i;j++)samples.push([i/8,j/8]);
assert.equal(data.triangles.length,24);assert.equal(data.lodCount,2);assert.equal(data.physicalCaseCount,1);
assert.deepEqual(data.origin,[126.97082,37.55363,27.2]);assert.equal(data.slotAlias,"F02FC086-S01");
for(const [featureKey,firstFace] of [["B_1_23_18:F001",50],["B_0_22_18:F007",678]])
  assert.deepEqual(data.triangles.filter(t=>t.featureKey===featureKey).map(t=>t.face).sort((a,b)=>a-b),Array.from({length:12},(_,i)=>firstFace+i));
let targetSamples=0,preservedSamples=0;
for(const t of data.triangles)for(const [u,v] of samples){
  assert(hidden(interpolate(t.points,u,v),interpolate(t.uv,u,v)),`target ${t.featureKey}:${t.face}`);targetSamples++;
}
for(const t of preserved)for(const [u,v] of samples){
  assert(!hidden(interpolate(t.points,u,v),interpolate(t.uv,u,v)),`preserve ${t.model} ${t.featureKey}:${t.face}`);preservedSamples++;
}
for(const model of ["F02FC086","F02FL","F02FC011","F02PL004"])
  assert(preserved.some(t=>t.model.startsWith(model)),`preservation fixture ${model}`);
assert.match(woodDisplayRetirementShaderDeclarations(),/insideReviewedFacadeTriangle/);
for(const shader of [seoulVworldRetirementShaderText(),retirementShaderText()]){
  assert.match(shader,/isRetiredWoodDisplay\(p, fsInput.attributes.texCoord_0\)/);
  assert.match(shader,/isRetiredCeladonCase/);assert.match(shader,/isRetiredS38Booth/);
  assert.match(shader,/isReviewedFacadeRetirementPoint/);
}
const previous=JSON.parse(fs.readFileSync(new URL("../app/seoul-feedback-retirement.json",import.meta.url),"utf8"));
assert(!previous.wholeObjects.some(x=>x.tdId===data.targetTdId),"shared F02FC086 must not be globally hidden");
data.enabled=false;
assert(!hidden(data.triangles[0].points[0],data.triangles[0].uv[0]));
assert.match(woodDisplayRetirementShaderDeclarations(),/return false/);
data.enabled=true;
console.log(JSON.stringify({cases:1,lods:2,triangles:24,targetSamples,preservedSamples,collateralHits:0,restorable:true}));
