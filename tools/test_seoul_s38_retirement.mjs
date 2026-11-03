import assert from "node:assert/strict";
import fs from "node:fs";
import { S38_RETIREMENT as data, isRetiredS38Slot, s38RetirementShaderDeclarations } from "../app/seoul-s38-retirement.js";
import { seoulVworldRetirementShaderText } from "../app/seoul-vworld-retirement.js";
import { retirementShaderText } from "../app/seoul-truedan.js";
const preserved = JSON.parse(fs.readFileSync(new URL("./fixtures/s38-preserved-triangles.json", import.meta.url), "utf8"));
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
assert.equal(data.triangles.length,80);assert.equal(data.lodCount,2);assert.equal(data.physicalBoothCount,1);
assert.deepEqual(data.origin,[126.97082,37.55363,27.2]);
assert.deepEqual(data.slotAliases,["F02WL072-S38","F02WL072-S40","F02WL072-S41","F02WL072-S44","F02WL072-S45"]);
let targetSamples=0,preservedSamples=0;
for(const t of data.triangles)for(const [u,v] of samples){
  assert(hidden(interpolate(t.points,u,v),interpolate(t.uv,u,v)),`target ${t.featureKey}:${t.face}`);targetSamples++;
}
for(const t of preserved)for(const [u,v] of samples){
  assert(!hidden(interpolate(t.points,u,v),interpolate(t.uv,u,v)),`preserve ${t.model} ${t.featureKey}:${t.face}`);preservedSamples++;
}
for(const alias of data.slotAliases)assert(isRetiredS38Slot({site_id:"S202103",slot_alias:alias}));
for(const alias of ["F02WL072-S37","F02WL072-S43","F02WL072-S33","F02FC088-S01","F02FC062-S01"])
  assert(!isRetiredS38Slot({site_id:"S202103",slot_alias:alias}));
assert(!isRetiredS38Slot({site_id:"S202107",slot_alias:data.slotAlias}));
assert.match(s38RetirementShaderDeclarations(),/insideReviewedFacadeTriangle/);
for(const shader of [seoulVworldRetirementShaderText(),retirementShaderText()]){
  assert.match(shader,/isRetiredS38Booth\(p, fsInput.attributes.texCoord_0\)/);
  assert.match(shader,/isRetiredCeladonCase/);
  assert.match(shader,/isReviewedFacadeRetirementPoint/);
}
const app=fs.readFileSync(new URL("../app/app.js",import.meta.url),"utf8");
assert.match(app,/if \(isRetiredS38Slot\(slot\)\) continue;/);
const previous=JSON.parse(fs.readFileSync(new URL("../app/seoul-feedback-retirement.json",import.meta.url),"utf8"));
assert(!previous.wholeObjects.some(x=>x.tdId===data.targetTdId),"shared F02WL072 must not be globally hidden");
data.enabled=false;
assert(!isRetiredS38Slot({site_id:data.siteId,slot_alias:data.slotAlias}));
assert.match(s38RetirementShaderDeclarations(),/return false/);
data.enabled=true;
console.log(JSON.stringify({booths:1,lods:2,triangles:80,targetSamples,preservedSamples,collateralHits:0}));
