-- Rectify the F02WL015-S01 replacement canvas to its decoded physical facade.
-- The immutable VWorld source atlas is square, but the target face is 1.601578:1.

do $$
declare calibrated_count integer;
begin
  update public.object_texture_slots
  set
    replacement_canvas_width_px = 820,
    replacement_canvas_height_px = 512,
    surface_width_m = 5.88603119,
    surface_height_m = 3.67514453
  where slot_key = '2d02316d8183557e64f69a57063dd4d966342a6febb043c4102a70525bb2c7d5'
    and site_id = 'S202103'
    and source_kind = 'vworld_uv'
    and slot_alias = 'F02WL015-S01'
    and object_key = 'b00540045882100332204582300'
    and source_feature_key = 'B_1_22_7:F000'
    and source_image_id = 'B_1_22_7:I000'
    and image_sha256 = '107987c0d497a74daf77b626283ca4282e1d077f2c451b5dde9c93c4f34cd1e5'
    and crop_width_px = 512
    and crop_height_px = 512;

  get diagnostics calibrated_count = row_count;
  if calibrated_count <> 1 then
    raise exception 'F02WL015-S01 surface calibration target mismatch: updated % rows', calibrated_count;
  end if;
end $$;
