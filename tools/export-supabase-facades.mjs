// Export the approved object-slot facades of one site (latest approved version per slot) from the Supabase workbench,
// with the slot geometry the toolkit import needs (tools/import-facades.mjs in ya-nerd-station-editor).
// Reads VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY from .env.local (never printed) and uses the same anonymous
// public session the Daejeon map used. Read-only apart from that anonymous session.
// Usage: node tools/export-supabase-facades.mjs S201801 ../tmp/supabase-export-S201801
import {createClient} from '@supabase/supabase-js';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {join,resolve} from 'node:path';

const [site='S201801',outArg]=process.argv.slice(2),out=resolve(outArg||`../tmp/supabase-export-${site}`);
const env=Object.fromEntries(readFileSync('.env.local','utf8').split('\n').map(l=>l.match(/^([A-Z0-9_]+)=(.*)$/)).filter(Boolean).map(m=>[m[1],m[2].trim().replace(/^['"]|['"]$/g,'')]));
if(!env.VITE_SUPABASE_URL||!env.VITE_SUPABASE_PUBLISHABLE_KEY)throw Error('.env.local에 Supabase 주소와 공개 키가 없습니다.');
const supabase=createClient(env.VITE_SUPABASE_URL,env.VITE_SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const {error:authError}=await supabase.auth.signInAnonymously({options:{data:{display_name:'마이그레이션 내보내기',public_editor:true}}});
if(authError)throw authError;

const {data,error}=await supabase.from('object_slot_replacement_versions').select(`
  id,slot_key,storage_path,replacement_width_px,replacement_height_px,replacement_mime_type,current_store_name,reviewed_at,created_at,
  slot:object_texture_slots!inner(site_id,is_active,slot_alias,floor,td_id,model_name,surface_width_m,surface_height_m,
   replacement_canvas_width_px,replacement_canvas_height_px,longitude,latitude,height_m,camera_heading_deg,surface_area_m2,crop_width_px,crop_height_px)`)
 .eq('review_status','approved').eq('is_active',true).eq('slot.site_id',site).eq('slot.is_active',true).order('created_at',{ascending:false});
if(error)throw error;

// Same size rule as the service renderer (approvedOverlayDimensions): exact surface, else area and canvas/crop aspect.
function surface(s){
 const w=Number(s.surface_width_m),h=Number(s.surface_height_m);if(w>0&&h>0)return [w,h];
 const cw=Number(s.replacement_canvas_width_px)||Number(s.crop_width_px),ch=Number(s.replacement_canvas_height_px)||Number(s.crop_height_px),area=Number(s.surface_area_m2);
 if(!(area>0&&cw>0&&ch>0))return [1,1];const aspect=Math.max(.05,Math.min(24,cw/ch));return [Math.sqrt(area*aspect),Math.sqrt(area/aspect)].map(n=>Math.round(n*1000)/1000);
}
function size(b){ // PNG or JPEG pixel size from the header
 if(b[0]===137&&b[1]===80)return [b.readUInt32BE(16),b.readUInt32BE(20)];
 for(let i=2;i+9<b.length;){if(b[i]!==255){i++;continue;}const m=b[i+1];if(m>=192&&m<=207&&![196,200,204].includes(m))return [b.readUInt16BE(i+7),b.readUInt16BE(i+5)];i+=2+b.readUInt16BE(i+2);}
 return null;
}
const latest=new Map();for(const row of data||[])if(!latest.has(row.slot_key))latest.set(row.slot_key,row);
mkdirSync(out,{recursive:true});const items=[],problems=[];
for(const row of latest.values()){
 const slot=Array.isArray(row.slot)?row.slot[0]:row.slot;
 const {data:blob,error:e}=await supabase.storage.from('vworld-catalog-replacements').download(row.storage_path);
 if(e){problems.push(slot.slot_alias+': '+e.message);continue;}
 const bytes=Buffer.from(await blob.arrayBuffer()),px=size(bytes),file=slot.slot_alias+(row.replacement_mime_type==='image/jpeg'?'.jpg':'.png');
 if(!px){problems.push(slot.slot_alias+': 이미지 형식을 읽지 못함');continue;}
 writeFileSync(join(out,file),bytes);
 items.push({file,bytes:bytes.length,source:{kind:'supabase',id:row.id,approved_at:row.reviewed_at||row.created_at,store_name:row.current_store_name||''},
  slot:{alias:slot.slot_alias,name:row.current_store_name||slot.slot_alias,floor:slot.floor,position:[slot.longitude,slot.latitude,slot.height_m],heading:slot.camera_heading_deg,surface:surface(slot),px},
  declared_px:[row.replacement_width_px,row.replacement_height_px]});
}
writeFileSync(join(out,'manifest.json'),JSON.stringify({site,exported_at:new Date().toISOString(),approved_rows:(data||[]).length,count:items.length,items,problems},null,1));
await supabase.auth.signOut();
console.log(site+': 승인 이력 '+(data||[]).length+'건 · 자리별 최신 '+latest.size+'건 · 내보냄 '+items.length+'건'+(problems.length?' · 문제 '+problems.length+'건':'')+' → '+out);
