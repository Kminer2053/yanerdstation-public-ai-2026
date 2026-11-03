import fs from 'node:fs';
import crypto from 'node:crypto';
import {INFORMATION_CENTER as a,INFORMATION_CENTER_SURFACES as surfaces,
  informationCenterSurfaceCenter,informationCenterNormalHeading} from '../app/seoul-information-center.js';
import {catalogPointGeodetic} from './information_zone_contract.mjs';

// Emits files as data. Caller reviews and saves with apply_patch; no DB writes.
const [basePath,beforePath]=process.argv.slice(2);
const base=JSON.parse(fs.readFileSync(basePath)).rows[1];
const before=JSON.parse(fs.readFileSync(beforePath));
const rows=surfaces.map((surface,index)=>{
  const bytes=fs.readFileSync(new URL(`../public${surface.image}`,import.meta.url));
  const sha=crypto.createHash('sha256').update(bytes).digest('hex');
  const width=bytes.readUInt32BE(16),height=bytes.readUInt32BE(20);
  const [east_m,north_m,up_m]=informationCenterSurfaceCenter(surface);
  const [longitude,latitude,height_m]=catalogPointGeodetic([east_m,north_m,up_m]);
  const position={east_m,north_m,up_m,longitude,latitude,height_m};
  const placement={placement_id:surface.id,target_surface_id:surface.id,is_primary:true,render_kind:'app_asset_wall',
    ...position,camera_heading_deg:informationCenterNormalHeading(surface),surface_width_m:surface.width,
    surface_height_m:surface.height,texture_coordinates:[[0,0],[1,0],[1,1],[0,1]]};
  return {...base,...position,slot_key:surface.slotKey,slot_alias:surface.alias,
    object_key:`${a.site}:APP_ASSET:${a.id}`,target_asset_id:a.id,target_surface_id:surface.id,
    model_name:a.id,object_label:`${a.label} · ${surface.label}`,source_feature_key:`APP_ASSET:${a.id}`,
    source_image_id:`APP_ASSET:${a.id}:${surface.id}:20260914`,source_region_signature:`photo-20260914:${surface.id}`,
    source_kind:'app_asset',site_id:a.site,floor:a.floor,class_code:'APP_ASSET',tile:'APP_ASSET',tile_depth:0,
    source_observed_at:'2026-09-14',is_active:true,image_sha256:sha,slot_index:index,td_id:'',
    mime_type:'image/png',atlas_width_px:width,atlas_height_px:height,crop_width_px:width,crop_height_px:height,
    replacement_canvas_width_px:width,replacement_canvas_height_px:Math.round(width*surface.height/surface.width),
    u_min:0,v_min:0,u_max:1,v_max:1,uv_vertex_count:surface.direction==='south'?8:4,
    triangle_count:surface.direction==='south'?4:2,surface_count:1,placement_count:1,uv_area:1,uv_fill_ratio:1,
    surface_area_m2:surface.width*surface.height,surface_width_m:surface.width,surface_height_m:surface.height,
    surface_placements:[placement],camera_heading_deg:placement.camera_heading_deg,
    original_storage_path:`originals/${sha}.png`,preview_storage_path:`previews/${sha}.png`,
    ocr_text:`안내센터 INFORMATION ${surface.label}`};
});
const key=a.retired.slotKey,q=s=>`'${s.replaceAll("'","''")}'`,columns=Object.keys(base);
const oldSnapshot=`jsonb_build_object('original',(select to_jsonb(s) from public.object_texture_slots s where slot_key=${q(key)}),
  'work',(select to_jsonb(w) from public.object_slot_work_items w where slot_key=${q(key)}),
  'versions',(select coalesce(jsonb_agg(to_jsonb(v) order by id),'[]'::jsonb) from public.object_slot_replacement_versions v where slot_key=${q(key)}))`;
const guard=`if ${oldSnapshot} is distinct from $before$${JSON.stringify(before)}$before$::jsonb then
  raise exception 'FC074 source/history changed; reconcile before continuing'; end if;`;
const sql=`-- New white information center: 4 managed baseline photo slots only.
-- Original FC074 slot, work item, and version history stay byte-equivalent JSON.
begin;
do $$ begin
${guard}
if exists(select 1 from public.object_texture_slots where target_asset_id=${q(a.id)}
 or slot_alias in (${rows.map(r=>q(r.slot_alias)).join(',')}) or slot_key in (${rows.map(r=>q(r.slot_key)).join(',')})) then
 raise exception 'Information center already registered; reconcile first'; end if;
end $$;
insert into public.object_texture_slots(${columns.join(',')})
${rows.map(r=>`select ${columns.map(c=>`r.${c}`).join(',')} from jsonb_populate_record(null::public.object_texture_slots,$row$${JSON.stringify(r)}$row$::jsonb) r`).join('\nunion all\n')};
insert into public.object_slot_work_items(slot_key,status,current_store_name,note,is_management_target)
values ${rows.map((r,i)=>`(${q(r.slot_key)},'pending','서울역 안내센터',${q(`2026-09-14 사용자 검은 경계 기준 신설. ${surfaces[i].photo} 보정 기본 이미지. 위치 ±0.3m·높이 추정치, 실측 아님. ${i===1?'남측은 상부 중앙 간판과 본체를 분리; 교체시 기본 이미지의 간판/본체 배치 비율 유지.':i>1?'동·서측 동일 사진 사용, 글자 반전 없음.':''} 원본 FC074 승인 이력 보존.`)},true)`).join(',')};
do $$ begin
${guard}
if (select count(*) from public.object_texture_slots where target_asset_id=${q(a.id)}) <> 4 then
 raise exception 'Expected exactly 4 information-center surfaces'; end if;
end $$;
commit;
`;
console.log(JSON.stringify({rows,sql}));
