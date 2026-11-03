-- Preserve the upright orientation of the approved F02WL072-S32 sign image.
-- Cesium coplanar texture coordinates use V=0 on the lower edge and V=1 on
-- the upper edge; the exact quad added in 202609110004 is ordered bottom-first.

do $$
declare
  updated_count integer;
begin
  with updated as (
    update public.object_texture_slots
    set surface_placements = jsonb_set(
      surface_placements,
      '{0,texture_coordinates}',
      '[[0,0],[1,0],[1,1],[0,1]]'::jsonb,
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
      and jsonb_array_length(surface_placements) = 1
      and surface_placements #> '{0,faces}' = '[238,239]'::jsonb
      and surface_placements #>> '{0,render_kind}' = 'coplanar_polygon'
      and surface_placements #> '{0,texture_coordinates}' = '[[0,1],[1,1],[1,0],[0,0]]'::jsonb
    returning slot_key
  )
  select count(*) into updated_count from updated;

  if updated_count <> 1 then
    raise exception 'F02WL072-S32 texture-orientation target mismatch: updated % of 1 rows', updated_count;
  end if;
end $$;
