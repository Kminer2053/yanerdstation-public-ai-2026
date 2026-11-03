import { INFORMATION_SLOT_CONTRACTS as rows, INFORMATION_RETIRED_SLOT_KEYS as retired, TRUEDAN_SLOT_KEY } from "./information_zone_contract.mjs";

const keys = rows.map(row => `'${row.slot_key}'`).join(",\n    ");
const retiredKeys = retired.map(key => `'${key}'`).join(",\n    ");
const sql = `-- Correct the pending information-zone rollout using the user-confirmed
-- F02WL072-S04 booth (F02WL054 shared shell), with S03/S05 upper panels.
-- IMG_6176.jpg: left boards, central booth, right TV, overhead supported TIDS.
-- This migration updates the five EXISTING app assets; image/version history
-- and replacement canvas sizes are intentionally preserved. The earlier S11/S10
-- western booth is unrelated and is not retired.

do $$
begin
  if (select count(*) from public.object_texture_slots
      where site_id = 'S202103' and source_kind = 'app_asset'
        and slot_key in (${keys})) <> 5 then
    raise exception 'Expected exactly five existing Seoul information assets';
  end if;
  if not exists (select 1 from public.object_texture_slots
      where slot_key = '${TRUEDAN_SLOT_KEY}' and site_id = 'S202103'
        and source_kind = 'app_asset' and target_asset_id = 'SEOUL-2F-TRUEDAN') then
    raise exception 'Expected the existing TRUEDAN facade slot';
  end if;
  if (select count(*) from public.object_texture_slots
      where site_id = 'S202103' and source_kind = 'vworld_uv'
        and slot_key in (${retiredKeys})
        and slot_alias in ('F02WL072-S03','F02WL072-S04','F02WL072-S05')
        and placement_count = 1) <> 3 then
    raise exception 'S04 retirement requires exactly three single-placement original surfaces';
  end if;
end $$;

with corrected as (
  select * from jsonb_to_recordset($placements$
${JSON.stringify(rows, null, 2)}
$placements$::jsonb) as c(
    slot_key text, slot_alias text, target_asset_id text, target_surface_id text,
    pixel_width integer, pixel_height integer,
    longitude double precision, latitude double precision, height_m double precision,
    east_m double precision, north_m double precision, up_m double precision,
    camera_heading_deg double precision, surface_width_m double precision,
    surface_height_m double precision, surface_placements jsonb, source_region_signature text
  )
)
update public.object_texture_slots as slot
set longitude = c.longitude, latitude = c.latitude, height_m = c.height_m,
    east_m = c.east_m, north_m = c.north_m, up_m = c.up_m,
    camera_heading_deg = c.camera_heading_deg,
    surface_placements = c.surface_placements,
    source_region_signature = c.source_region_signature,
    is_active = true
from corrected c
where slot.slot_key = c.slot_key and slot.site_id = 'S202103'
  and slot.source_kind = 'app_asset' and slot.target_asset_id = c.target_asset_id
  and slot.target_surface_id = c.target_surface_id
  and coalesce(slot.replacement_canvas_width_px,slot.crop_width_px) = c.pixel_width
  and coalesce(slot.replacement_canvas_height_px,slot.crop_height_px) = c.pixel_height;

-- Undo migration 008's mistaken TRUEDAN retirement without altering any version.
update public.object_texture_slots set is_active = true
where site_id = 'S202103' and slot_key = '${TRUEDAN_SLOT_KEY}';

update public.object_slot_work_items w
set status = case
      when exists (select 1 from public.object_slot_replacement_versions v
        where v.slot_key=w.slot_key and v.review_status='approved' and v.is_active) then 'approved'
      when exists (select 1 from public.object_slot_replacement_versions v
        where v.slot_key=w.slot_key and v.review_status='submitted') then 'review'
      when w.assignee_id is null then 'pending' else 'in_progress' end,
    is_management_target = true,
    note = 'TRUEDAN은 S04 계단 앞 철거 대상이 아니므로 기존 관리와 승인 이력을 유지합니다.'
where w.slot_key = '${TRUEDAN_SLOT_KEY}' and w.status = 'hold';

-- The S04 front and its two upper panels are the ONLY retired catalog slots.
update public.object_texture_slots set is_active = false
where site_id = 'S202103' and slot_key in (${retiredKeys});
update public.object_slot_work_items set status = 'hold', is_management_target = false,
  note = '2026-09-14 현장 확인: F02WL072-S04 매장부스 철거 및 안내존 설치. 원본·교체 이력 보존.'
where slot_key in (${retiredKeys});

update public.object_slot_work_items
set note = '2026-09-14 사용자 확정 F02WL072-S04 부스 자리. IMG_6176.jpg 기준 안내존 시설; 기존 애셋 ID·이미지·승인 이력 유지.',
    is_management_target = true
where slot_key in (${keys});

do $$
begin
  if (select count(*) from public.object_texture_slots
      where slot_key in (${keys}) and is_active
        and east_m between -13.0 and -5.0
        and camera_heading_deg between 358.63 and 358.64
        and jsonb_array_length(surface_placements) = 1
        and source_region_signature like 'S04-IMG_6176-%') <> 5 then
    raise exception 'All five information assets must match the verified S04 placement';
  end if;
  if exists (select 1 from public.object_texture_slots
      where slot_key in (${retiredKeys}) and is_active) then
    raise exception 'S04 retired surfaces remain active';
  end if;
end $$;
`;
process.stdout.write(sql);
