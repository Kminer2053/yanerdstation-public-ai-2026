import assert from "node:assert/strict";
import fs from "node:fs";
import { PERGOLA_RETIREMENT as data, pergolaRetirementStyleConditions, isRetiredPergolaSlot } from "../app/seoul-pergola-retirement.js";
const audit=JSON.parse(fs.readFileSync(new URL("./fixtures/pergola-feature-audit.json",import.meta.url),"utf8"));
// Evaluate the generated Cesium style expression, not a separate copy of its logic.
function hidden(site,feature){
  return pergolaRetirementStyleConditions(site).some(([expression,show])=>
    !show&&Function("p","return "+expression.replace(/\$\{([A-Z_]+)\}/g,(_,key)=>'p["'+key+'"]'))(feature));
}
const metadata=f=>({FLOOR:f.floor,MODEL_NAME:f.model,TD_ID:f.tdId});
assert.equal(audit.target.triangleCount,1308);
assert.deepEqual(audit.target.features.map(f=>f.featureKey).sort(),["B_0_24_14:F000","B_1_24_14:F000"]);
assert.equal(audit.target.features.length,2);
let hiddenTriangles=0,preservedTriangles=0;
for(const f of audit.target.features){
  assert(hidden("S202103",metadata(f)),f.featureKey);
  assert(f.min.every((v,i)=>v>=data.bounds.min[i]-.001));
  assert(f.max.every((v,i)=>v<=data.bounds.max[i]+.001));
  hiddenTriangles+=f.triangleCount;
}
for(const f of audit.preserved.features){
  assert(!hidden("S202103",metadata(f)),f.featureKey);
  preservedTriangles+=f.triangleCount;
}
for(const model of ["F02PL004","F02FL005","F02FC086"])
  assert(audit.preserved.features.some(f=>f.model===model),model);
const target=metadata(audit.target.features[0]);
for(const patch of [{FLOOR:"1F"},{MODEL_NAME:"F02PL004"},{TD_ID:"different"}])
  assert(!hidden("S202103",{...target,...patch}));
assert(!hidden("S202107",target));
const slot={site_id:data.siteId,slot_alias:data.slotAlias,slot_key:data.slotKey};
assert(isRetiredPergolaSlot(slot));
for(const patch of [{site_id:"S202107"},{slot_alias:"F02PL004-S01"},{slot_key:"different"}])
  assert(!isRetiredPergolaSlot({...slot,...patch}));
assert(!isRetiredPergolaSlot(null));
const app=fs.readFileSync(new URL("../app/app.js",import.meta.url),"utf8");
assert.match(app,/conditions: \[\.\.\.pergolaRetirementStyleConditions\(VWORLD_CONFIG.siteId\), \.\.\.feedbackRetirementStyleConditions/);
assert.match(app,/if \(isRetiredPergolaSlot\(slot\)\) continue;/);
data.enabled=false;
assert.deepEqual(pergolaRetirementStyleConditions("S202103"),[]);
assert(!isRetiredPergolaSlot(slot));assert(!hidden("S202103",target));
data.enabled=true;
console.log(JSON.stringify({physicalStructures:1,lods:2,hiddenTriangles,preservedTriangles,collateralHits:0,restorable:true}));
