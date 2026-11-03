import assert from 'node:assert/strict';
import fs from 'node:fs';
import { DESSERT_BANNER_RETIREMENT as data, dessertBannerRetirementShaderDeclarations } from '../app/seoul-dessert-banner-retirement.js';
import { seoulVworldRetirementShaderText } from '../app/seoul-vworld-retirement.js';

const preserved = JSON.parse(fs.readFileSync(new URL('./fixtures/dessert-banner-preserved-triangles.json', import.meta.url), 'utf8'));
const targets = JSON.parse(fs.readFileSync(new URL('./fixtures/dessert-banner-target-triangles.json', import.meta.url), 'utf8'));
const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
const sub = (a, b) => a.map((v, i) => v - b[i]);
const cross = (a, b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
const hidden = p => data.enabled && data.banners.some(b => p.every((v,i) => v>=b.broadPhaseBounds.min[i] && v<=b.broadPhaseBounds.max[i]));
function intersectsTriangleBox(points, {min,max}) {
  const center=min.map((v,i)=>(v+max[i])/2), half=min.map((v,i)=>(max[i]-v)/2);
  const q=points.map(p=>sub(p,center));
  const edges=[sub(q[1],q[0]),sub(q[2],q[1]),sub(q[0],q[2])], axesXYZ=[[1,0,0],[0,1,0],[0,0,1]];
  const axes=[...axesXYZ,cross(edges[0],edges[1]),...edges.flatMap(e=>axesXYZ.map(a=>cross(e,a)))];
  return axes.every(a=>{const projected=q.map(p=>dot(p,a)),r=half.reduce((s,v,i)=>s+Math.abs(a[i])*v,0);return Math.min(...projected)<=r+1e-12&&Math.max(...projected)>=-r-1e-12;});
}
const interpolate = (a,u,v) => a[0].map((x,i) => x*(1-u-v)+a[1][i]*u+a[2][i]*v);
const samples = []; for(let i=0;i<=8;i++) for(let j=0;j<=8-i;j++) samples.push([i/8,j/8]);
assert.equal(data.physicalBannerCount,4);
assert.equal(data.lodCount,2);
assert.equal(data.targetModel,'B03FC015');
assert.equal(data.targetTdId,'b00540045882100332203524100');
assert.deepEqual(data.origin,[126.97082,37.55363,27.2]);
assert.equal(targets.length,816);
let targetSamples=0, preservedSamples=0;
for (const t of targets) for(const [u,v] of samples) {
  assert(hidden(interpolate(t.points,u,v),interpolate(t.uv,u,v)),`missed banner ${t.featureKey}:${t.face}`); targetSamples++;
}
for (const t of preserved) for(const [u,v] of samples) {
  assert(!hidden(interpolate(t.points,u,v),interpolate(t.uv,u,v)),`collateral ${t.model}:${t.featureKey}:${t.face}`); preservedSamples++;
}
assert(preserved.some(t => t.model === data.targetModel), 'Shared model preservation coverage');
assert(preserved.some(t => t.model === 'B03WL011'), 'Dessert Box facade preservation coverage');
const shader = seoulVworldRetirementShaderText();
for(const t of preserved) for(const banner of data.banners)
  assert(!intersectsTriangleBox(t.points,banner.broadPhaseBounds), `intersection ${t.model}:${t.featureKey}:${t.face}`);
assert(dessertBannerRetirementShaderDeclarations().length < 2000, 'Bounded shader complexity');
assert.match(shader, /if \(isRetiredDessertBanner\(p, fsInput.attributes.texCoord_0\)\) discard;/);
assert.match(shader, /isRetiredPhotoboothCharger/);
assert.match(shader, /isRetiredPlatform111/);
assert.equal(shader.match(/void fragmentMain\(/g).length,1);
console.log(JSON.stringify({banners:4,lods:2,triangles:targets.length,targetSamples,preservedSamples,exactIntersectionTests:preserved.length*4,collateralHits:0,restorable:true}));
