import fs from 'node:fs';
import crypto from 'node:crypto';
import {PHOTOBOOTH as a,photoboothSurfaceCenter} from '../app/seoul-photobooth.js';
import {catalogPointGeodetic} from './information_zone_contract.mjs';
// Emits reviewed registration data only. No database or filesystem writes.
const [basePath,beforePath]=process.argv.slice(2);
const base=JSON.parse(fs.readFileSync(basePath)).rows[1],before=JSON.parse(fs.readFileSync(beforePath));
const s=a.surface,bytes=fs.readFileSync(new URL(`../public${s.image}`,import.meta.url));
const sha=crypto.createHash('sha256').update(bytes).digest('hex'),w=bytes.readUInt32BE(16),h=bytes.readUInt32BE(20);
const [east_m,north_m,up_m]=photoboothSurfaceCenter(),[longitude,latitude,height_m]=catalogPointGeodetic([east_m,north_m,up_m]);
const position={east_m,north_m,up_m,longitude,latitude,height_m};
const placement={placement_id:s.id,target_surface_id:s.id,is_primary:true,render_kind:'app_asset_wall',...position,
  camera_heading_deg:a.normalHeading,surface_width_m:a.width,surface_height_m:a.height,texture_coordinates:[[0,0],[1,0],[1,1],[0,1]]};
const row={...base,...position,slot_key:s.slotKey,slot_alias:s.alias,object_key:`${a.site}:APP_ASSET:${a.id}`,
  target_asset_id:a.id,target_surface_id:s.id,model_name:a.id,object_label:`${a.label} · 정면`,source_feature_key:`APP_ASSET:${a.id}`,
  source_image_id:`APP_ASSET:${a.id}:${s.id}:20260915`,source_region_signature:`photo-20260915:${s.id}`,source_kind:'app_asset',
  slot_level:'texture_image',site_id:a.site,floor:a.floor,class_code:'APP_ASSET',tile:'APP_ASSET',tile_depth:0,source_observed_at:'2026-09-15',
  is_active:true,image_sha256:sha,slot_index:0,td_id:'',mime_type:'image/png',atlas_width_px:w,atlas_height_px:h,crop_width_px:w,crop_height_px:h,
  replacement_canvas_width_px:w,replacement_canvas_height_px:h,u_min:0,v_min:0,u_max:1,v_max:1,uv_vertex_count:4,triangle_count:2,
  surface_count:1,placement_count:1,uv_area:1,uv_fill_ratio:1,surface_area_m2:a.width*a.height,surface_width_m:a.width,surface_height_m:a.height,
  surface_placements:[placement],camera_heading_deg:a.normalHeading,original_storage_path:`originals/${sha}.png`,preview_storage_path:`previews/${sha}.png`,
  ocr_text:'인생네컷 LIFE FOUR CUTS 스티커 사진 부스',replacement_priority:'HIGH'};
const key=before.original.slot_key,q=s=>`'${s.replaceAll("'","''")}'`,columns=Object.keys(base);
const snapshot=`jsonb_build_object('original',(select to_jsonb(s) from public.object_texture_slots s where slot_key=${q(key)}),'work',(select to_jsonb(w) from public.object_slot_work_items w where slot_key=${q(key)}),'versions',(select coalesce(jsonb_agg(to_jsonb(v) order by id),'[]'::jsonb) from public.object_slot_replacement_versions v where slot_key=${q(key)}))`;
const guard=`if ${snapshot} is distinct from $before$${JSON.stringify(before)}$before$::jsonb then raise exception 'FC036 source/history changed'; end if;`;
const sql=`-- New photo booth baseline only; FC036 shared source/history untouched.
begin;
do $$ begin
${guard}
if exists(select 1 from public.object_texture_slots where target_asset_id=${q(a.id)} or slot_alias=${q(s.alias)} or slot_key=${q(s.slotKey)}) then raise exception 'Photobooth exists; reconcile first'; end if;
end $$;
insert into public.object_texture_slots(${columns.join(',')})
select ${columns.map(c=>`r.${c}`).join(',')} from jsonb_populate_record(null::public.object_texture_slots,$row$${JSON.stringify(row)}$row$::jsonb) r;
insert into public.object_slot_work_items(slot_key,status,current_store_name,note,is_management_target)
values (${q(s.slotKey)},'pending','인생네컷',${q(a.uncertainty+' IMG_6165 2.jpg 정면 보정·사람/배경 제거, 가림 부분은 사진 기반 복원. 기본 이미지 등록; 승인 교체 이력 없음. 기존 공유 FC036 슬롯 보존.')},true);
do $$ begin
${guard}
if (select count(*) from public.object_texture_slots where target_asset_id=${q(a.id)} and is_active)<>1 then raise exception 'Expected one active slot'; end if;
end $$;
commit;
`;
console.log(JSON.stringify({rows:[row],sql}));
