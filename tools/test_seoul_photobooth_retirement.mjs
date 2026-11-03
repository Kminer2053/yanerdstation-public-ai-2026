// Run after integration:
// node /tmp/photobooth-geometry-audit/test_seoul_photobooth_retirement.mjs /path/to/site
// Optional: --fixtures /directory/containing/charger-targets.json/and/charger-preserved-triangles.json
// --fixture-only checks the independently decoded source fixtures, not a deployed shader.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const argv=process.argv.slice(2), fixtureOnly=argv.includes('--fixture-only');
const fixtureFlag=argv.indexOf('--fixtures');
const site=path.resolve(argv.find((a,i)=>!a.startsWith('--')&&(fixtureFlag<0||i!==fixtureFlag+1))||process.cwd());
const here=path.dirname(fileURLToPath(import.meta.url));
const fixtureDir=path.resolve(fixtureFlag>=0?argv[fixtureFlag+1]:path.join(here,'fixtures/photobooth'));
const read=name=>JSON.parse(fs.readFileSync(path.join(fixtureDir,name),'utf8'));
const source=read('charger-targets.json');
const preserveFile=read('charger-preserved-triangles.json');
const preserved=Array.isArray(preserveFile)?preserveFile:preserveFile.triangles;
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),sub=(a,b)=>a.map((v,i)=>v-b[i]);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const lerp=(a,u,v)=>a[0].map((x,i)=>x*(1-u-v)+a[1][i]*u+a[2][i]*v);
const points=t=>t.points||t.vs;
function coefficients(t){
 const [a,b,c]=points(t),x=sub(b,a),y=sub(c,a),n=cross(x,y),xx=dot(x,x),yy=dot(y,y),xy=dot(x,y),den=xx*yy-xy*xy;
 assert(den>1e-15,'degenerate source triangle');
 return {origin:a,normal:n.map(v=>v/Math.hypot(...n)),dualU:x.map((v,i)=>(yy*v-xy*y[i])/den),dualV:y.map((v,i)=>(xx*v-xy*x[i])/den),uv:t.uv};
}
const sourceCoefficients=source.triangles.map(coefficients);
const grid=[];for(let i=0;i<=8;i++)for(let j=0;j<=8-i;j++)grid.push([i/8,j/8]);
function triangleMatcher(t,p,rawUv,tolerance){
 const q=sub(p,t.origin),u=dot(q,t.dualU),v=dot(q,t.dualV);
 if(Math.abs(dot(q,t.normal))>tolerance.plane||u < -tolerance.bary||v < -tolerance.bary||u+v>tolerance.sum)return false;
 return rawUv.every((x,i)=>Math.abs(x-(t.uv[0][i]+u*(t.uv[1][i]-t.uv[0][i])+v*(t.uv[2][i]-t.uv[0][i])))<=tolerance.uv);
}
function exercise(data,compiled,tolerance){
 const hidden=(p,uv)=>data.enabled&&p.every((v,i)=>v>=data.broadPhaseBounds.min[i]&&v<=data.broadPhaseBounds.max[i])&&compiled.some(t=>triangleMatcher(t,p,uv,tolerance));
 let targetSamples=0,preservedSamples=0,uvOnlyRejected=0,positionOnlyRejected=0,planeBoundaryAssertions=0,barycentricBoundaryAssertions=0,uvBoundaryAssertions=0;
 for(const t of source.triangles)for(const [u,v] of grid){
  assert(hidden(lerp(points(t),u,v),lerp(t.uv,u,v)),`target missed: ${t.featureKey}:${t.face} @ ${u},${v}`);targetSamples++;
 }
 for(const t of preserved)for(const [u,v] of grid){
  assert(!hidden(lerp(points(t),u,v),lerp(t.uv,u,v)),`collateral hit: ${t.model} ${t.featureKey}:${t.face} @ ${u},${v}`);preservedSamples++;
 }
 for(const [i,t] of source.triangles.entries()){
  const p=lerp(points(t),1/3,1/3),uv=lerp(t.uv,1/3,1/3),c=compiled[i];
  // Correct position must NOT hide an unrelated texture/approval overlay.
  assert(!hidden(p,uv.map(v=>v+.25)),`position-only overreach: ${t.featureKey}:${t.face}`);positionOnlyRejected++;
  // Correct atlas coordinates must NOT hide another placement of that shared atlas.
  assert(!hidden(p.map((v,i)=>v+(i<2?30:0)),uv),`UV-only overreach: ${t.featureKey}:${t.face}`);uvOnlyRejected++;
  for(let axis=0;axis<2;axis++)for(const sign of [-1,1]){
   const near=uv.map((v,i)=>v+(i===axis?sign*tolerance.uv*.9:0));
   const far=uv.map((v,i)=>v+(i===axis?sign*tolerance.uv*1.1:0));
   assert(triangleMatcher(c,p,near,tolerance),'inside UV tolerance rejected');
   assert(!triangleMatcher(c,p,far,tolerance),'outside UV tolerance admitted');uvBoundaryAssertions+=2;
  }
  // Check the actual generated helper's tolerances on each triangle independently.
  for(const sign of [-1,1]){
   const near=p.map((v,i)=>v+sign*tolerance.plane*.9*c.normal[i]);
   const far=p.map((v,i)=>v+sign*tolerance.plane*1.1*c.normal[i]);
   assert(triangleMatcher(c,near,uv,tolerance),'inside plane tolerance rejected');
   assert(!triangleMatcher(c,far,uv,tolerance),'outside plane tolerance admitted');planeBoundaryAssertions+=2;
  }
  const baryDelta=Math.max(tolerance.bary,1e-7);
  for(const u of [-baryDelta*.5,-baryDelta*2]){
   const p=lerp(points(t),u,.25),uv=lerp(t.uv,u,.25);
   assert.equal(triangleMatcher(c,p,uv,tolerance),u>=-tolerance.bary,'barycentric boundary');barycentricBoundaryAssertions++;
  }
 }
 assert.equal(targetSamples,1080);assert.equal(preservedSamples,42795);
 return {targetTriangles:source.triangles.length,targetSamples,preservedTriangles:preserved.length,preservedSamples,collateralHits:0,uvOnlyRejected,positionOnlyRejected,planeBoundaryAssertions,barycentricBoundaryAssertions,uvBoundaryAssertions};
}
assert.deepEqual(source.origin,[126.97082,37.55363,27.2]);
assert.equal(source.triangles.length,24);assert.equal(preserved.length,951);
assert.equal(preserved.filter(t=>t.model==='F03FC036').length,264);
assert.equal(source.sharedSlotAlias,'F03FC036-S01');
assert.equal(source.doNotHideSharedModelOrSlot,true);
for(const feature of ['B_0_24_14:F003','B_1_24_14:F003']){
 const ts=source.triangles.filter(t=>t.featureKey===feature);
 assert.equal(ts.length,12);assert.deepEqual(ts.map(t=>t.face).sort((a,b)=>a-b),Array.from({length:12},(_,i)=>i+36));
 assert(ts.every(t=>t.model==='F03FC036'&&t.tdId==='b00540045882200332205949200'));
}
if(fixtureOnly){
 const data={...source,enabled:true};
 console.log(JSON.stringify({mode:'source-fixture-only; not a runtime integration test',...exercise(data,sourceCoefficients,{plane:.002,bary:1e-7,sum:1+1e-7,uv:1e-5})},null,2));
 process.exit(0);
}
const modulePath=path.join(site,'app/seoul-photobooth-retirement.js');
assert(fs.existsSync(modulePath),`new retirement module missing: ${modulePath}`);
const module=await import(pathToFileURL(modulePath));
const data=(await import(pathToFileURL(path.join(site,'app/seoul-photobooth-retirement.json')),{with:{type:'json'}})).default;
assert.equal(data.enabled,true,'retirement must be enabled');
assert.equal(data.siteId,'S202103');assert.deepEqual(data.triangles,source.triangles,'deployed target geometry must equal independent original-tile fixture');
assert.deepEqual(data.broadPhaseBounds,source.broadPhaseBounds);
const candidates=[];
for(const [name,value] of Object.entries(module))if(typeof value==='function'&&/ShaderDeclarations/.test(name)){
 const result=value();if(typeof result==='string'&&result.includes('bool isRetiredPhotoboothCharger'))candidates.push({name,fn:value,shader:result});
}
assert.equal(candidates.length,1,'exactly one shader-declaration export must contain isRetiredPhotoboothCharger');
const {fn:declarations,shader}=candidates[0];
function bodyOf(text,name){
 const start=text.indexOf(`bool ${name}(`);assert(start>=0,`GLSL function missing: ${name}`);
 const open=text.indexOf('{',start);let depth=1,i=open+1;
 for(;i<text.length&&depth;i++){if(text[i]==='{')depth++;else if(text[i]==='}')depth--;}
 assert.equal(depth,0,`unbalanced GLSL function: ${name}`);return text.slice(open+1,i-1);
}
const maskBody=bodyOf(shader,'isRetiredPhotoboothCharger');
assert.match(maskBody,/lessThan\(p,/,'broad-phase lower boundary missing');
assert.match(maskBody,/greaterThan\(p,/,'broad-phase upper boundary missing');
const callPattern=/(\w+)\(p,\s*rawUv,\s*((?:vec[23]\([^)]*\),?\s*){7})\)/g;
const calls=[...maskBody.matchAll(callPattern)];assert.equal(calls.length,24,'generated GLSL must test every source triangle in both LODs');
assert.equal(new Set(calls.map(c=>c[1])).size,1,'triangle calls should use a single reviewed helper');
const helperName=calls[0][1];
const compiled=calls.map(c=>{
 const vectors=[...c[2].matchAll(/vec([23])\(([^)]*)\)/g)].map(v=>v[2].split(',').map(s=>Number(s.trim())));
 assert.deepEqual(vectors.map(v=>v.length),[3,3,3,3,2,2,2]);assert(vectors.flat().every(Number.isFinite));
 return {origin:vectors[0],normal:vectors[1],dualU:vectors[2],dualV:vectors[3],uv:vectors.slice(4)};
});
// Shared feedback helper may be declared by its own module, rather than duplicated here.
let helperText=shader;
if(!helperText.includes(`bool ${helperName}(`)){
 const helperModule=await import(pathToFileURL(path.join(site,'app/seoul-feedback-retirement.js')));
 helperText=helperModule.feedbackRetirementShaderDeclarations();
}
const helper=bodyOf(helperText,helperName);
const number='([+-]?(?:\\d*\\.\\d+|\\d+)(?:[eE][+-]?\\d+)?)';
const parsed=(pattern,label)=>{const match=helper.match(pattern);assert(match,`missing ${label} guard in generated GLSL`);return Number(match[1]);};
const plane=parsed(new RegExp(`abs\\(\\s*dot\\([^)]*\\)\\s*\\)\\s*>\\s*${number}`),'position-plane');
const uv=parsed(new RegExp(`abs\\(\\s*rawUv\\s*-\\s*expectedUv\\s*\\),\\s*vec2\\(\\s*${number}`),'raw interpolated UV');
const bary=-parsed(new RegExp(`u\\s*(?:>=|<)\\s*${number}`),'barycentric lower');
const sum=parsed(new RegExp(`u\\s*\\+\\s*v\\s*(?:<=|>)\\s*${number}`),'barycentric sum');
assert(plane>0&&plane<=.004);assert(uv>0&&uv<=.00002);assert(bary>=1e-7&&bary<=.0002);assert(sum>1&&sum<=1.0002);
assert.match(helper,/uv0\s*\+\s*u\s*\*\s*\(uv1\s*-\s*uv0\)\s*\+\s*v\s*\*\s*\(uv2\s*-\s*uv0\)/,'must derive expected UV from position barycentrics');
const result=exercise(data,compiled,{plane,bary,sum,uv});
const vworld=await import(pathToFileURL(path.join(site,'app/seoul-vworld-retirement.js')));
const truedan=await import(pathToFileURL(path.join(site,'app/seoul-truedan.js')));
for(const [name,text] of [['original tiles',vworld.seoulVworldRetirementShaderText()],['approved overlays',truedan.retirementShaderText()]]){
 assert.match(text,/isRetiredPhotoboothCharger\(p,\s*fsInput\.attributes\.texCoord_0\)/,`${name}: new mask is not wired to the render path`);
 assert.match(text,/isRetiredLoungeSign\(p,\s*fsInput\.attributes\.texCoord_0\)/,`${name}: prior sign retirement must remain`);
 assert.match(text,/bool isRetiredPhotoboothCharger\(/,`${name}: helper declaration is missing`);
}
for(const [name,value] of Object.entries(module))if(typeof value==='function'&&/StyleConditions/.test(name)){
 assert.deepEqual(value('S202103'),[],`${name}: shared FC036 must not be globally style-hidden`);
}
const before=data.enabled;
try{data.enabled=false;assert.match(declarations(),/return false/,'disabled layer must be reversible');}
finally{data.enabled=before;}
console.log(JSON.stringify({mode:'actual generated GLSL coefficients + both integration paths; CPU arithmetic, not a GPU render test',tolerance:{plane,bary,sum,uv},...result,reversible:true,sharedSlotPreserved:true},null,2));
