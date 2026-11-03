-- Fit the approved F02WL072-S32 sign image to its decoded inclined quad.
-- The former vertical-wall approximation was narrower than the source face and
-- left the original teal material visible along the top and both ends.

do $$
declare
  updated_count integer;
begin
  with updated as (
    update public.object_texture_slots
    set
      surface_width_m = 23.1649939,
      surface_height_m = 1.76935595,
      longitude = 126.970120077936,
      latitude = 37.553951334264,
      height_m = 40.619431,
      east_m = -61.846751,
      north_m = 35.664729,
      up_m = 13.419021,
      camera_heading_deg = 18.897845,
      surface_count = 1,
      placement_count = 1,
      surface_area_m2 = 40.9858,
      surface_placements = $placements$[
        {
          "placement_id":"inclined-sign",
          "is_primary":true,
          "render_kind":"coplanar_polygon",
          "faces":[238,239],
          "longitude":126.970120077936,
          "latitude":37.553951334264,
          "height_m":40.619431,
          "east_m":-61.846751,
          "north_m":35.664729,
          "up_m":13.419021,
          "camera_heading_deg":18.897845,
          "surface_width_m":23.1649939,
          "surface_height_m":1.76935595,
          "surface_area_m2":40.9858,
          "normal_enu":[0.31619758,0.92365093,-0.21653649],
          "corners_wgs84":[
            [126.970243342935,37.553915946792,39.750717],
            [126.969995437996,37.553983448021,39.760842],
            [126.969996693203,37.553986827304,41.483221],
            [126.970244837611,37.553919114939,41.482944]
          ],
          "texture_coordinates":[[0,1],[1,1],[1,0],[0,0]]
        }
      ]$placements$::jsonb
    where slot_key = '40b474282ea960465a740aa908c1d1df083ada3a8275a67812fae0dccc3b3fe2'
      and site_id = 'S202103'
      and source_kind = 'vworld_uv'
      and object_key = 'b00540045882300332204131200'
      and slot_alias = 'F02WL072-S32'
      and source_feature_key = 'B_1_23_15:F002'
      and source_image_id = 'B_1_23_15:I003'
      and source_region_signature = 'c9b22dc0c3c2eb65977b'
      and image_sha256 = '26e7ba80a4a472cf78b6f85346121314bc66cb40be0ff507215437f251cf9083'
      and crop_width_px = 340
      and crop_height_px = 29
    returning slot_key
  )
  select count(*) into updated_count from updated;

  if updated_count <> 1 then
    raise exception 'F02WL072-S32 exact-surface target mismatch: updated % of 1 rows', updated_count;
  end if;
end $$;
