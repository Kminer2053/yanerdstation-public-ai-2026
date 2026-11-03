import assert from 'node:assert/strict';
import fs from 'node:fs';
import {OPENING_GUARDRAIL as rail, openingGuardrailPlan, createOpeningGuardrail} from '../app/seoul-opening-guardrail.js';
import {LOUNGE_SIGN_RETIREMENT as data, loungeSignRetirementStyleConditions, loungeSignRetirementShaderDeclarations, isRetiredLoungeSignBodySlot} from '../app/seoul-lounge-sign-retirement.js';
import {seoulVworldRetirementShaderText} from '../app/seoul-vworld-retirement.js';
const preserved=JSON.parse(fs.readFileSync(new URL('./fixtures/lounge-sign-preserved-triangles.json',import.meta.url)));
const plan=openingGuardrailPlan();
assert.equal(rail.centerline.length,7);
assert.equal(rail.retainOpening,true);
assert.equal(rail.existingRailing.retainWholeModel,true);
assert.equal(rail.audit.onSlabSamples,159);
assert.deepEqual(rail.audit.offSlab,[]);
assert(Math.abs(plan.spans.reduce((n,s)=>n+s.length,0)-37.3723245212)<1e-6);
assert(plan.spans.every(s=>s.length>0 && s.length<=rail.maxPanelWidth));
for(const [point,cap] of [[rail.centerline[0],rail.existingRailing.rightCap],[rail.centerline.at(-1),rail.existingRailing.leftCap]]) {
  assert(Math.hypot(point[0]-cap.position[0],point[1]-cap.position[1])<1e-8);
  assert(Math.abs(point[2]+rail.height-cap.top)<.012);
}
assert.equal(new Set(plan.posts.map(p=>p.join(','))).size,plan.posts.length);
assert.equal(await createOpeningGuardrail(null,null,'S202107'),null);
rail.enabled=false;assert.equal(await createOpeningGuardrail(null,null,'S202103'),null);rail.enabled=true;
const dot=(a,b)=>a.reduce((n,v,i)=>n+v*b[i],0),sub=(a,b)=>a.map((v,i)=>v-b[i]);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
function match(t,p,uv) {
  const [a,b,c]=t.points,x=sub(b,a),y=sub(c,a),q=sub(p,a),n=cross(x,y);
  if(Math.abs(dot(q,n)/Math.hypot(...n))>.003)return false;
  const xx=dot(x,x),yy=dot(y,y),xy=dot(x,y),den=xx*yy-xy*xy;
  const u=(yy*dot(q,x)-xy*dot(q,y))/den,v=(xx*dot(q,y)-xy*dot(q,x))/den;
  if(u<-.0002 || v<-.0002 || u+v>1.0002)return false;
  return uv.every((value,i)=>Math.abs(value-(t.uv[0][i]+u*(t.uv[1][i]-t.uv[0][i])+v*(t.uv[2][i]-t.uv[0][i])))<=.00002);
}
const bodyHidden=(site,t)=>loungeSignRetirementStyleConditions(site).some(([expr,show])=>!show && Function('p','return '+expr.replace(/\$\{([A-Z_]+)\}/g,(_,key)=>`p["${key}"]`))({FLOOR:t.floor,MODEL_NAME:t.model,TD_ID:t.tdId}));
const screenHidden=(p,uv)=>data.enabled && p.every((v,i)=>v>=data.broadPhaseBounds.min[i]&&v<=data.broadPhaseBounds.max[i]) && data.triangles.filter(t=>t.model==='F03FC036').some(t=>match(t,p,uv));
const interp=(a,u,v)=>a[0].map((x,i)=>x*(1-u-v)+a[1][i]*u+a[2][i]*v);
const samples=[];for(let i=0;i<=8;i++)for(let j=0;j<=8-i;j++)samples.push([i/8,j/8]);
assert.equal(data.triangles.length,48);
assert.equal(data.triangles.filter(t=>t.model==='F03FC005').length,40);
assert.equal(data.triangles.filter(t=>t.model==='F03FC036').length,8);
let targetSamples=0,preservedSamples=0;
for(const t of data.triangles)for(const [u,v]of samples){
  assert(bodyHidden('S202103',t)||screenHidden(interp(t.points,u,v),interp(t.uv,u,v)),`${t.featureKey}:${t.face}`);targetSamples++;
}
for(const t of preserved)for(const [u,v]of samples){
  assert(!bodyHidden('S202103',t)&&!screenHidden(interp(t.points,u,v),interp(t.uv,u,v)),`${t.model}:${t.face}`);preservedSamples++;
}
for(const model of ['F03FC034','F03FC036','F03PL002','F03FC025','F03FL001']) assert(preserved.some(t=>t.model===model));
assert(!bodyHidden('S202107',data.triangles[0]));
assert(!bodyHidden('S202103',{...data.triangles[0],floor:'2F'}));
const slot={site_id:'S202103',slot_alias:data.bodySlotAlias,slot_key:data.bodySlotKey};
assert(isRetiredLoungeSignBodySlot(slot));
assert(!isRetiredLoungeSignBodySlot({...slot,slot_alias:data.preserveSharedSlotAlias}));
assert(!isRetiredLoungeSignBodySlot({...slot,slot_key:'different'}));
const shader=seoulVworldRetirementShaderText();
assert.match(shader,/isRetiredLoungeSign\(p, fsInput.attributes.texCoord_0\)/);
for(const previous of ['isRetiredWoodDisplay','isRetiredCeladonCase','isRetiredS38Booth','isReviewedFacadeRetirementPoint'])assert(shader.includes(previous));
data.enabled=false;
assert.deepEqual(loungeSignRetirementStyleConditions('S202103'),[]);
assert(!isRetiredLoungeSignBodySlot(slot));
assert.match(loungeSignRetirementShaderDeclarations(),/return false/);data.enabled=true;
console.log(JSON.stringify({guardrailLengthM:rail.totalLengthM,panels:plan.spans.length,openingPreserved:true,retiredSigns:2,targetTriangles:48,targetSamples,preservedSamples,collateralHits:0,restorable:true}));
