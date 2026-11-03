import fs from "node:fs";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { INFORMATION_SLOT_CONTRACTS, INFORMATION_RETIRED_SLOT_KEYS, TRUEDAN_SLOT_KEY } from "./information_zone_contract.mjs";

const env = Object.fromEntries(fs.readFileSync(new URL("../.env.local",import.meta.url),"utf8").split(/\r?\n/)
  .filter(line => line && !line.startsWith("#")).map(line => { const i=line.indexOf("=");return [line.slice(0,i),line.slice(i+1)]; }));
const db = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY,
  {auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
const {error:authError}=await db.auth.signInAnonymously({options:{data:{display_name:"S04 안내존 검증",public_editor:true}}});
if(authError) throw authError;
const keys=[...INFORMATION_SLOT_CONTRACTS.map(r=>r.slot_key),...INFORMATION_RETIRED_SLOT_KEYS,TRUEDAN_SLOT_KEY];
const results=await Promise.all([
  db.from("object_texture_slots").select("slot_key,slot_alias,is_active,target_asset_id,target_surface_id,east_m,north_m,up_m,longitude,latitude,height_m,camera_heading_deg,surface_placements,crop_width_px,crop_height_px,replacement_canvas_width_px,replacement_canvas_height_px,original_storage_path,preview_storage_path,source_region_signature").in("slot_key",keys).order("slot_key"),
  db.from("object_slot_replacement_versions").select("id,slot_key,review_status,is_active,storage_path,replacement_width_px,replacement_height_px").in("slot_key",keys).order("id"),
  db.from("object_slot_work_items").select("slot_key,status,is_management_target,assignee_id").in("slot_key",keys).order("slot_key"),
]);
for(const r of results) if(r.error) throw r.error;
const snapshot={slots:results[0].data,versions:results[1].data,work:results[2].data};
assert.equal(snapshot.slots.length,9);
if(process.argv.includes("--verify")){
  for(const c of INFORMATION_SLOT_CONTRACTS){
    const s=snapshot.slots.find(s=>s.slot_key===c.slot_key);
    assert(s.is_active,c.slot_alias);
    for(const field of ["east_m","north_m","up_m","longitude","latitude","height_m","camera_heading_deg"])
      assert(Math.abs(s[field]-c[field])<1e-7,`${c.slot_alias} ${field}`);
    assert.deepEqual(s.surface_placements,c.surface_placements);
    assert.equal(s.replacement_canvas_width_px??s.crop_width_px,c.pixel_width);
    assert.equal(s.replacement_canvas_height_px??s.crop_height_px,c.pixel_height);
  }
  for(const key of INFORMATION_RETIRED_SLOT_KEYS) assert.equal(snapshot.slots.find(s=>s.slot_key===key).is_active,false);
  assert(snapshot.slots.find(s=>s.slot_key===TRUEDAN_SLOT_KEY).is_active);
  const beforeArg=process.argv.indexOf("--before");
  if(beforeArg>=0){
    const before=JSON.parse(fs.readFileSync(process.argv[beforeArg+1],"utf8"));
    assert.deepEqual(snapshot.versions,before.versions,"all image versions and approvals must be unchanged");
    for(const c of INFORMATION_SLOT_CONTRACTS){
      const prev=before.slots.find(s=>s.slot_key===c.slot_key),next=snapshot.slots.find(s=>s.slot_key===c.slot_key);
      for(const key of ["original_storage_path","preview_storage_path","target_asset_id","target_surface_id"])
        assert.deepEqual(next[key],prev[key]);
      const workBefore=before.work.find(w=>w.slot_key===c.slot_key),workAfter=snapshot.work.find(w=>w.slot_key===c.slot_key);
      assert.equal(workAfter.status,workBefore.status);assert.equal(workAfter.assignee_id,workBefore.assignee_id);
    }
  }
}
console.log(JSON.stringify(snapshot,null,2));
