-- Remove the remaining horizontal mirror from the approved F02WL072-S32 sign.
-- Keep the exact inclined facade geometry and approved replacement version unchanged.

do $$
declare
  updated_count integer;
begin
  with updated as (
    update public.object_texture_slots
    set surface_placements = jsonb_set(
      surface_placements,
      '{0,texture_coordinates}',
      '[[0,1],[1,1],[1,0],[0,0]]'::jsonb,
      false
    )
    where slot_key = '40b474282ea960465a740aa908c1d1df083ada3a8275a67812fae0dccc3b3fe2'
      and site_id = 'S202103'
      and is_active
      and source_kind = 'vworld_uv'
      and object_key = 'b00540045882300332204131200'
      and slot_alias = 'F02WL072-S32'
      and source_feature_key = 'B_1_23_15:F002'
      and source_image_id = 'B_1_23_15:I003'
      and source_region_signature = 'c9b22dc0c3c2eb65977b'
      and image_sha256 = '26e7ba80a4a472cf78b6f85346121314bc66cb40be0ff507215437f251cf9083'
      and crop_width_px = 340
      and crop_height_px = 29
      and surface_count = 1
      and placement_count = 1
      and surface_width_m = 23.1649939
      and surface_height_m = 1.76935595
      and jsonb_array_length(surface_placements) = 1
      and surface_placements #> '{0,faces}' = '[238,239]'::jsonb
      and surface_placements #>> '{0,render_kind}' = 'coplanar_polygon'
      and surface_placements #> '{0,normal_enu}' = '[0.31619758,0.92365093,-0.21653649]'::jsonb
      and surface_placements #> '{0,corners_wgs84}' = '[[126.970243342935,37.553915946792,39.750717],[126.969995437996,37.553983448021,39.760842],[126.969996693203,37.553986827304,41.483221],[126.970244837611,37.553919114939,41.482944]]'::jsonb
      and surface_placements #> '{0,texture_coordinates}' = '[[1,1],[0,1],[0,0],[1,0]]'::jsonb
    returning slot_key
  )
  select count(*) into updated_count from updated;

  if updated_count <> 1 then
    raise exception 'F02WL072-S32 horizontal-orientation target mismatch: updated % of 1 rows', updated_count;
  end if;
end $$;
