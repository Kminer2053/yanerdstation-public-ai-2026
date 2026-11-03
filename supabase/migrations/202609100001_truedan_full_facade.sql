-- Register the app-rendered TRUEDAN storefront as one catalog-managed facade image.
-- VWorld UV slots keep their existing behavior; this row targets a renderer-owned asset.

alter table public.object_texture_slots
  add column if not exists source_kind text not null default 'vworld_uv',
  add column if not exists target_asset_id text,
  add column if not exists target_surface_id text,
  add column if not exists surface_width_m double precision,
  add column if not exists surface_height_m double precision;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.object_texture_slots'::regclass
      and conname = 'object_texture_slots_source_kind_check'
  ) then
    alter table public.object_texture_slots
      add constraint object_texture_slots_source_kind_check
      check (source_kind in ('vworld_uv', 'app_asset'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.object_texture_slots'::regclass
      and conname = 'object_texture_slots_app_asset_target_check'
  ) then
    alter table public.object_texture_slots
      add constraint object_texture_slots_app_asset_target_check
      check (
        source_kind <> 'app_asset'
        or (
          nullif(btrim(target_asset_id), '') is not null
          and nullif(btrim(target_surface_id), '') is not null
          and surface_width_m > 0
          and surface_height_m > 0
        )
      );
  end if;
end $$;

create unique index if not exists object_texture_slots_one_active_app_surface_idx
  on public.object_texture_slots (site_id, target_asset_id, target_surface_id)
  where source_kind = 'app_asset' and is_active;

insert into public.object_texture_slots (
  slot_key, site_id, object_key, slot_alias, slot_level, is_active,
  source_kind, target_asset_id, target_surface_id, surface_width_m, surface_height_m,
  source_feature_key, source_image_id, source_region_signature, image_sha256, slot_index,
  floor, td_id, model_name, class_code, object_label, replacement_priority, mime_type,
  atlas_width_px, atlas_height_px, crop_width_px, crop_height_px,
  u_min, v_min, u_max, v_max, uv_vertex_count, triangle_count, surface_count, placement_count,
  uv_area, uv_fill_ratio, surface_area_m2,
  longitude, latitude, height_m, east_m, north_m, up_m, camera_heading_deg,
  tile, tile_depth, original_storage_path, preview_storage_path, ocr_text, source_observed_at
) values (
  '7afba516acfae10344297172e7c5c80368d4d3d43b140a71a14ccedc208852bc',
  'S202103',
  'S202103:APP_ASSET:SEOUL-2F-TRUEDAN',
  'TRUEDAN-FRONT-S01',
  'texture_image',
  true,
  'app_asset',
  'SEOUL-2F-TRUEDAN',
  'front-facade',
  6.0,
  3.1378,
  'APP_ASSET:SEOUL-2F-TRUEDAN',
  'APP_ASSET:SEOUL-2F-TRUEDAN:FRONT:BASELINE-V1',
  'front-facade-v1',
  'f10b7d899f599845ff66ac05f7b40c7569451cf2b79287d4d0e383dfc3e0329e',
  0,
  '2F',
  '',
  'TRUEDAN-FACADE',
  'APP_ASSET',
  'TRUEDAN 전체 파사드',
  'HIGH',
  'image/jpeg',
  1920,
  1004,
  1920,
  1004,
  0,
  0,
  1,
  1,
  4,
  2,
  1,
  1,
  1,
  1,
  18.8268,
  126.97100863065477,
  37.553635989133866,
  37.802389414049685,
  16.66791007847276,
  0.6647429472904479,
  10.6023676265,
  352.785094421892,
  'APP_ASSET',
  null,
  'originals/f10b7d899f599845ff66ac05f7b40c7569451cf2b79287d4d0e383dfc3e0329e.jpg',
  'previews/f10b7d899f599845ff66ac05f7b40c7569451cf2b79287d4d0e383dfc3e0329e.png',
  'TRUEDAN',
  date '2026-09-08'
)
on conflict (slot_key) do update set
  site_id = excluded.site_id,
  object_key = excluded.object_key,
  slot_alias = excluded.slot_alias,
  slot_level = excluded.slot_level,
  is_active = true,
  source_kind = excluded.source_kind,
  target_asset_id = excluded.target_asset_id,
  target_surface_id = excluded.target_surface_id,
  surface_width_m = excluded.surface_width_m,
  surface_height_m = excluded.surface_height_m,
  source_feature_key = excluded.source_feature_key,
  source_image_id = excluded.source_image_id,
  source_region_signature = excluded.source_region_signature,
  image_sha256 = excluded.image_sha256,
  slot_index = excluded.slot_index,
  floor = excluded.floor,
  td_id = excluded.td_id,
  model_name = excluded.model_name,
  class_code = excluded.class_code,
  object_label = excluded.object_label,
  replacement_priority = excluded.replacement_priority,
  mime_type = excluded.mime_type,
  atlas_width_px = excluded.atlas_width_px,
  atlas_height_px = excluded.atlas_height_px,
  crop_width_px = excluded.crop_width_px,
  crop_height_px = excluded.crop_height_px,
  u_min = excluded.u_min,
  v_min = excluded.v_min,
  u_max = excluded.u_max,
  v_max = excluded.v_max,
  uv_vertex_count = excluded.uv_vertex_count,
  triangle_count = excluded.triangle_count,
  surface_count = excluded.surface_count,
  placement_count = excluded.placement_count,
  uv_area = excluded.uv_area,
  uv_fill_ratio = excluded.uv_fill_ratio,
  surface_area_m2 = excluded.surface_area_m2,
  longitude = excluded.longitude,
  latitude = excluded.latitude,
  height_m = excluded.height_m,
  east_m = excluded.east_m,
  north_m = excluded.north_m,
  up_m = excluded.up_m,
  camera_heading_deg = excluded.camera_heading_deg,
  tile = excluded.tile,
  tile_depth = excluded.tile_depth,
  original_storage_path = excluded.original_storage_path,
  preview_storage_path = excluded.preview_storage_path,
  ocr_text = excluded.ocr_text,
  source_observed_at = excluded.source_observed_at;

insert into public.object_slot_work_items (
  slot_key, status, current_store_name, note, is_management_target
) values (
  '7afba516acfae10344297172e7c5c80368d4d3d43b140a71a14ccedc208852bc',
  'pending',
  'TRUEDAN',
  '전면 전체를 한 장의 이미지로 교체하는 앱 자산 슬롯',
  true
)
on conflict (slot_key) do nothing;
