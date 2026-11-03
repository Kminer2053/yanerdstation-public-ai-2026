import assert from 'node:assert/strict';
import fs from 'node:fs';
import { LOUNGE_RETIREMENT as data, loungeRetirementStyleConditions, isRetiredLoungeSlot } from '../app/seoul-lounge-retirement.js';
const audit = JSON.parse(fs.readFileSync(new URL('./fixtures/lounge-feature-audit.json', import.meta.url)));
const metadata = f => ({FLOOR:f.floor, MODEL_NAME:f.model, TD_ID:f.tdId});
const hidden = (site, f) => loungeRetirementStyleConditions(site).some(([expression, show]) =>
  !show && Function('p', 'return '+expression.replace(/\$\{([A-Z_]+)\}/g, (_, k) => `p["${k}"]`))(f));
assert.equal(audit.target.triangleCount, 224);
assert.equal(audit.target.connectedComponentsPerLod, 1);
assert.deepEqual(audit.target.features.map(f=>f.featureKey).sort(), ['B_0_24_18:F001','B_1_24_18:F001']);
for (const f of audit.target.features) {
  assert.equal(f.triangleCount,112);
  assert(hidden('S202103',metadata(f)));
  assert(f.min.every((v,i)=>v>=data.bounds.min[i]-.001));
  assert(f.max.every((v,i)=>v<=data.bounds.max[i]+.001));
}
for (const f of audit.preserved.features) assert(!hidden('S202103',metadata(f)), f.featureKey);
for (const model of ['F03FL001','F03PL001','F03PL002','F03FC005','F03FC036','F03FC025','F03FC009'])
  assert(audit.preserved.features.some(f=>f.model===model),model);
const target = metadata(audit.target.features[0]);
for (const patch of [{FLOOR:'2F'},{MODEL_NAME:'F03PL002'},{TD_ID:'different'}])
  assert(!hidden('S202103',{...target,...patch}));
assert(!hidden('S202107',target));
assert.equal(data.slots.length,23);
for (let i=0;i<23;i++) assert.equal(data.slots[i].slotAlias,`F03WL018-S${String(i+1).padStart(2,'0')}`);
for (const s of data.slots) {
  const slot={site_id:data.siteId,slot_alias:s.slotAlias,slot_key:s.slotKey};
  assert(isRetiredLoungeSlot(slot));
  for (const patch of [{site_id:'S202107'},{slot_alias:'F03PL002-S01'},{slot_key:'different'}])
    assert(!isRetiredLoungeSlot({...slot,...patch}));
}
assert(!isRetiredLoungeSlot(null));
const app=fs.readFileSync(new URL('../app/app.js',import.meta.url),'utf8');
assert(app.indexOf('...loungeRetirementStyleConditions(VWORLD_CONFIG.siteId)')<app.indexOf("[`\\${FLOOR} === '${state.floor}'",app.indexOf('show: { conditions:')));
assert.match(app,/if \(isRetiredLoungeSlot\(slot\)\) continue;/);
data.enabled=false;
assert.deepEqual(loungeRetirementStyleConditions('S202103'),[]);
assert(!isRetiredLoungeSlot({site_id:data.siteId,slot_alias:data.slots[0].slotAlias,slot_key:data.slots[0].slotKey}));
data.enabled=true;
console.log(JSON.stringify({hiddenTriangles:224,lods:2,physicalStructures:1,overlaySlots:23,preservedSamples:audit.preserved.features.reduce((n,f)=>n+f.sampleTriangles,0),collateralHits:0,restorable:true}));
