// Explicit release task: copy approved Seoul render payloads and immutable image bytes.
// Does not mutate Supabase. Never stores credentials or expiring signed URLs.
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
const root=path.resolve(import.meta.dirname,'..'),out=path.join(root,'public/data/jury-frozen');
const env=Object.fromEntries((await fs.readFile(path.join(root,'.env.local'),'utf8')).split(/\r?\n/).filter(l=>l&&!l.startsWith('#')).map(l=>{const i=l.indexOf('=');return[l.slice(0,i),l.slice(i+1).replace(/^['"]|['"]$/g,'')];}));
const db=createClient(env.VITE_SUPABASE_URL,env.VITE_SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
const {error:auth}=await db.auth.signInAnonymously({options:{data:{display_name:'심사본 고정 읽기',public_editor:true}}});if(auth)throw auth;
const {data,error}=await db.from('object_slot_replacement_versions').select('id,slot_key,storage_path,file_name,replacement_width_px,replacement_height_px,replacement_mime_type,current_store_name,review_status,is_active,reviewed_at,created_at,slot:object_texture_slots!inner(site_id,is_active,object_key,slot_alias,floor,td_id,model_name,object_label,source_kind,target_asset_id,target_surface_id,surface_width_m,surface_height_m,replacement_canvas_width_px,replacement_canvas_height_px,longitude,latitude,height_m,camera_heading_deg,surface_area_m2,crop_width_px,crop_height_px,surface_count,placement_count,surface_placements)').eq('review_status','approved').eq('is_active',true).eq('slot.site_id','S202103').eq('slot.is_active',true).order('created_at',{ascending:false});if(error)throw error;
const latest=[...new Map([...data].reverse().map(r=>[r.slot_key,r])).values()];if(latest.length<20)throw Error('승인 파사드 수가 예상보다 적습니다. 고정본 미작성.');
await fs.mkdir(path.join(out,'images'),{recursive:true});const rows=[];let total=0;
for(const row of latest){const r={...row,slot:Array.isArray(row.slot)?row.slot[0]:row.slot};const {data:file,error:e}=await db.storage.from('vworld-catalog-replacements').download(r.storage_path);if(e)throw e;const bytes=Buffer.from(await file.arrayBuffer()),hash=createHash('sha256').update(bytes).digest('hex'),ext=r.replacement_mime_type==='image/png'?'png':r.replacement_mime_type==='image/webp'?'webp':'jpg';const name=hash+'.'+ext;await fs.writeFile(path.join(out,'images',name),bytes);delete r.storage_path;r.image_url='/data/jury-frozen/images/'+name;r.sha256=hash;rows.push(r);total+=bytes.length;}
await fs.writeFile(path.join(out,'approved-facades.json'),JSON.stringify({site_id:'S202103',frozen_at:new Date().toISOString(),basis:'approved render snapshot; no live subscription',count:rows.length,bytes:total,replacements:rows}));
console.log(JSON.stringify({frozen_facades:rows.length,total_bytes:total,output:'public/data/jury-frozen/approved-facades.json'}));
