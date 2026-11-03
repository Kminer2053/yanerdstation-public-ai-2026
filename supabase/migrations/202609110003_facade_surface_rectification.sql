-- Rectify seven facade replacement canvases against their decoded physical
-- surfaces. Preserve legacy approved versions while future uploads use the
-- corrected aspect contracts.

do $$
declare
  calibrated_count integer;
begin
  with expected as (
    select * from jsonb_to_recordset($calibrations$[
      {
        "slot_key":"63dd8a1d992af67bae87019e7d29a6b6b0d75ed1cda386a9a52f49c003f4b19a",
        "slot_alias":"F02WL023-S01","object_key":"b00540045882100332205845300",
        "source_feature_key":"B_1_26_8:F000","source_image_id":"B_1_26_8:I000",
        "image_sha256":"b8ad1f6cc1c7b04ccfccc44cf80896ed653d01c862c084ce812680d88de9919e",
        "crop_width_px":510,"crop_height_px":510,"canvas_width_px":1764,"canvas_height_px":510,
        "surface_width_m":13.23843887,"surface_height_m":3.82843188
      },
      {
        "slot_key":"740b513abfaddbff53414368d5c375ed586e175629abbdef09fc72f8d6c03883",
        "slot_alias":"F02WL076-S01","object_key":"b00540045882400332205579300",
        "source_feature_key":"B_1_24_23:F009","source_image_id":"B_1_24_23:I005",
        "image_sha256":"5995e9d8b2e617d13cfb606752bc7b7f2ed85026c499c685aa17a6da5dcc059f",
        "crop_width_px":256,"crop_height_px":255,"canvas_width_px":2006,"canvas_height_px":255,
        "surface_width_m":10.60067322,"surface_height_m":1.34721320
      },
      {
        "slot_key":"553ee3b54a3ed5c79502717026ac2b904fdd37762b92aab7a9bf4173f5a9be99",
        "slot_alias":"F02WL072-S25","object_key":"b00540045882300332204131200",
        "source_feature_key":"B_1_23_15:F002","source_image_id":"B_1_23_15:I003",
        "image_sha256":"26e7ba80a4a472cf78b6f85346121314bc66cb40be0ff507215437f251cf9083",
        "crop_width_px":175,"crop_height_px":176,"canvas_width_px":441,"canvas_height_px":512,
        "surface_width_m":3.16073886,"surface_height_m":3.67189244
      },
      {
        "slot_key":"d3c9bc023df8a18de2075206cfff450096d883a2855bccc7bac207aed96afe4b",
        "slot_alias":"F02WL072-S26","object_key":"b00540045882300332204131200",
        "source_feature_key":"B_1_23_15:F002","source_image_id":"B_1_23_15:I003",
        "image_sha256":"26e7ba80a4a472cf78b6f85346121314bc66cb40be0ff507215437f251cf9083",
        "crop_width_px":340,"crop_height_px":86,"canvas_width_px":1934,"canvas_height_px":512,
        "surface_width_m":13.87227840,"surface_height_m":3.67189072
      },
      {
        "slot_key":"49b283aab99c66143487d7318dfb573f0a8617142476408b82d15fbf186e9ffa",
        "slot_alias":"F02WL072-S34","object_key":"b00540045882300332204131200",
        "source_feature_key":"B_1_23_15:F002","source_image_id":"B_1_23_15:I003",
        "image_sha256":"26e7ba80a4a472cf78b6f85346121314bc66cb40be0ff507215437f251cf9083",
        "crop_width_px":144,"crop_height_px":85,"canvas_width_px":1183,"canvas_height_px":512,
        "surface_width_m":8.84533226,"surface_height_m":3.82812690
      },
      {
        "slot_key":"a02230d12b7a1a98a67d4a12fa1911cbaeb2eccae10cc0f279d72746e4dc2af9",
        "slot_alias":"F02WL072-S35","object_key":"b00540045882300332204131200",
        "source_feature_key":"B_1_23_15:F002","source_image_id":"B_1_23_15:I003",
        "image_sha256":"26e7ba80a4a472cf78b6f85346121314bc66cb40be0ff507215437f251cf9083",
        "crop_width_px":80,"crop_height_px":163,"canvas_width_px":214,"canvas_height_px":512,
        "surface_width_m":1.53532017,"surface_height_m":3.67991276
      },
      {
        "slot_key":"f4a3618ed8c810b08833227a92f5651ba2947cc3659fce56abc1cd3c160c4f93",
        "slot_alias":"F02WL072-S37","object_key":"b00540045882300332204131200",
        "source_feature_key":"B_1_23_15:F002","source_image_id":"B_1_23_15:I003",
        "image_sha256":"26e7ba80a4a472cf78b6f85346121314bc66cb40be0ff507215437f251cf9083",
        "crop_width_px":133,"crop_height_px":163,"canvas_width_px":490,"canvas_height_px":512,
        "surface_width_m":3.51966955,"surface_height_m":3.67991823
      }
    ]$calibrations$::jsonb) as row(
      slot_key text, slot_alias text, object_key text,
      source_feature_key text, source_image_id text, image_sha256 text,
      crop_width_px integer, crop_height_px integer,
      canvas_width_px integer, canvas_height_px integer,
      surface_width_m double precision, surface_height_m double precision
    )
  ), updated as (
    update public.object_texture_slots as slot
    set
      replacement_canvas_width_px = expected.canvas_width_px,
      replacement_canvas_height_px = expected.canvas_height_px,
      surface_width_m = expected.surface_width_m,
      surface_height_m = expected.surface_height_m
    from expected
    where slot.slot_key = expected.slot_key
      and slot.site_id = 'S202103'
      and slot.source_kind = 'vworld_uv'
      and slot.slot_alias = expected.slot_alias
      and slot.object_key = expected.object_key
      and slot.source_feature_key = expected.source_feature_key
      and slot.source_image_id = expected.source_image_id
      and slot.image_sha256 = expected.image_sha256
      and slot.crop_width_px = expected.crop_width_px
      and slot.crop_height_px = expected.crop_height_px
    returning slot.slot_key
  )
  select count(*) into calibrated_count from updated;

  if calibrated_count <> 7 then
    raise exception 'Facade surface calibration target mismatch: updated % of 7 rows', calibrated_count;
  end if;
end $$;

-- F02WL023 needs a corrected geometric center, F02WL076 needs its inclined
-- four-corner plane, and the legacy S26 approval needs its accidental blank
-- lower band removed until a 1934x512 replacement is registered.
do $$
declare
  placement_count integer;
begin
  with expected as (
    select * from jsonb_to_recordset($placements$[
      {
        "slot_key":"63dd8a1d992af67bae87019e7d29a6b6b0d75ed1cda386a9a52f49c003f4b19a",
        "slot_alias":"F02WL023-S01","object_key":"b00540045882100332205845300",
        "source_feature_key":"B_1_26_8:F000","source_image_id":"B_1_26_8:I000",
        "image_sha256":"b8ad1f6cc1c7b04ccfccc44cf80896ed653d01c862c084ce812680d88de9919e",
        "crop_width_px":510,"crop_height_px":510,
        "longitude":126.97003980295344,"latitude":37.554265329313125,"height_m":38.16716548,
        "east_m":-68.93972573,"north_m":70.51467287,"up_m":10.96640241,"camera_heading_deg":120.174192,
        "surface_placements":[{
          "placement_id":"facade","is_primary":true,
          "longitude":126.97003980295344,"latitude":37.554265329313125,"height_m":38.16716548,
          "east_m":-68.93972573,"north_m":70.51467287,"up_m":10.96640241,"camera_heading_deg":120.174192,
          "surface_width_m":13.23843887,"surface_height_m":3.82843188
        }]
      },
      {
        "slot_key":"740b513abfaddbff53414368d5c375ed586e175629abbdef09fc72f8d6c03883",
        "slot_alias":"F02WL076-S01","object_key":"b00540045882400332205579300",
        "source_feature_key":"B_1_24_23:F009","source_image_id":"B_1_24_23:I005",
        "image_sha256":"5995e9d8b2e617d13cfb606752bc7b7f2ed85026c499c685aa17a6da5dcc059f",
        "crop_width_px":256,"crop_height_px":255,
        "longitude":126.97150356180364,"latitude":37.554053421655865,"height_m":39.08130853,
        "east_m":60.399,"north_m":46.995,"up_m":11.881,"camera_heading_deg":330.29329547,
        "surface_placements":[{
          "placement_id":"inclined-sign","is_primary":true,"render_kind":"coplanar_polygon",
          "longitude":126.97150356180364,"latitude":37.554053421655865,"height_m":39.08130853,
          "east_m":60.399,"north_m":46.995,"up_m":11.881,"camera_heading_deg":330.29329547,
          "surface_width_m":10.60067322,"surface_height_m":1.34721320,
          "normal_enu":[-0.45983556740656595,0.8059584185423447,-0.3728032705444044],
          "corners_wgs84":[
            [126.9715541819266,37.554079058358035,39.70628804],
            [126.97155714319126,37.5540751163405,38.45628149],
            [126.97145277314063,37.55402778587916,38.45632269],
            [126.97145014902237,37.55403172599876,39.70635074]
          ],
          "texture_coordinates":[[0,1],[0,0],[1,0],[1,1]]
        }]
      },
      {
        "slot_key":"d3c9bc023df8a18de2075206cfff450096d883a2855bccc7bac207aed96afe4b",
        "slot_alias":"F02WL072-S26","object_key":"b00540045882300332204131200",
        "source_feature_key":"B_1_23_15:F002","source_image_id":"B_1_23_15:I003",
        "image_sha256":"26e7ba80a4a472cf78b6f85346121314bc66cb40be0ff507215437f251cf9083",
        "crop_width_px":340,"crop_height_px":86,
        "longitude":126.970521687,"latitude":37.553920811,"height_m":38.073509,
        "east_m":-26.36,"north_m":32.277,"up_m":10.873,"camera_heading_deg":4.89,
        "surface_placements":[{
          "placement_id":"facade","is_primary":true,
          "longitude":126.970521687,"latitude":37.553920811,"height_m":38.073509,
          "east_m":-26.36,"north_m":32.277,"up_m":10.873,"camera_heading_deg":4.89,
          "surface_width_m":13.87227840,"surface_height_m":3.67189072,
          "legacy_replacement_crop":{
            "source_width_px":340,"source_height_px":86,
            "left_px":0,"top_px":0,"width_px":340,"height_px":67
          }
        }]
      }
    ]$placements$::jsonb) as row(
      slot_key text, slot_alias text, object_key text,
      source_feature_key text, source_image_id text, image_sha256 text,
      crop_width_px integer, crop_height_px integer,
      longitude double precision, latitude double precision, height_m double precision,
      east_m double precision, north_m double precision, up_m double precision,
      camera_heading_deg double precision, surface_placements jsonb
    )
  ), updated as (
    update public.object_texture_slots as slot
    set
      longitude = expected.longitude,
      latitude = expected.latitude,
      height_m = expected.height_m,
      east_m = expected.east_m,
      north_m = expected.north_m,
      up_m = expected.up_m,
      camera_heading_deg = expected.camera_heading_deg,
      placement_count = jsonb_array_length(expected.surface_placements),
      surface_placements = expected.surface_placements
    from expected
    where slot.slot_key = expected.slot_key
      and slot.site_id = 'S202103'
      and slot.source_kind = 'vworld_uv'
      and slot.slot_alias = expected.slot_alias
      and slot.object_key = expected.object_key
      and slot.source_feature_key = expected.source_feature_key
      and slot.source_image_id = expected.source_image_id
      and slot.image_sha256 = expected.image_sha256
      and slot.crop_width_px = expected.crop_width_px
      and slot.crop_height_px = expected.crop_height_px
      and slot.surface_count = 1
    returning slot.slot_key
  )
  select count(*) into placement_count from updated;

  if placement_count <> 3 then
    raise exception 'Facade placement target mismatch: updated % of 3 rows', placement_count;
  end if;
end $$;
