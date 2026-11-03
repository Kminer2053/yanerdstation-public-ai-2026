-- Separate the immutable VWorld UV crop from the user-facing replacement canvas.
-- F02FC092 stores a square, pre-warped atlas texture on a 3.398:1 physical sign.

alter table public.object_texture_slots
  add column if not exists replacement_canvas_width_px integer,
  add column if not exists replacement_canvas_height_px integer;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.object_texture_slots'::regclass
      and conname = 'object_texture_slots_replacement_canvas_check'
  ) then
    alter table public.object_texture_slots
      add constraint object_texture_slots_replacement_canvas_check
      check (
        (replacement_canvas_width_px is null) = (replacement_canvas_height_px is null)
        and (
          replacement_canvas_width_px is null
          or (replacement_canvas_width_px > 0 and replacement_canvas_height_px > 0)
        )
      );
  end if;
end $$;

comment on column public.object_texture_slots.crop_width_px is
  'Pixel width of the immutable source UV crop; this may be pre-warped for the source mesh.';
comment on column public.object_texture_slots.crop_height_px is
  'Pixel height of the immutable source UV crop; this may be pre-warped for the source mesh.';
comment on column public.object_texture_slots.replacement_canvas_width_px is
  'Optional user-facing replacement width rectified to the physical surface aspect.';
comment on column public.object_texture_slots.replacement_canvas_height_px is
  'Optional user-facing replacement height rectified to the physical surface aspect.';

create or replace function public.validate_object_slot_replacement_dimensions()
returns trigger language plpgsql set search_path = public as $$
declare
  expected public.object_texture_slots;
  expected_width integer;
  expected_height integer;
begin
  -- Existing legacy files may be rejected or deactivated after a slot is calibrated.
  -- Activating or approving one again requires the current replacement contract.
  if tg_op = 'UPDATE' then
    if new.slot_key is not distinct from old.slot_key
      and new.replacement_width_px is not distinct from old.replacement_width_px
      and new.replacement_height_px is not distinct from old.replacement_height_px
      and (
        (
          coalesce((to_jsonb(old)->>'is_active')::boolean, false)
          and not coalesce((to_jsonb(new)->>'is_active')::boolean, false)
        )
        or (
          not coalesce((to_jsonb(new)->>'is_active')::boolean, false)
          and coalesce(to_jsonb(new)->>'review_status', '') <> 'approved'
        )
      ) then
        return new;
    end if;
  end if;

  select * into expected from public.object_texture_slots where slot_key = new.slot_key;
  if expected.slot_key is null then raise exception '이미지 슬롯을 찾지 못했습니다.'; end if;

  expected_width := coalesce(expected.replacement_canvas_width_px, expected.crop_width_px);
  expected_height := coalesce(expected.replacement_canvas_height_px, expected.crop_height_px);
  if new.replacement_width_px <> expected_width or new.replacement_height_px <> expected_height then
    raise exception '교체 이미지 규격은 % × %px이어야 합니다.', expected_width, expected_height;
  end if;
  return new;
end;
$$;

do $$
declare calibrated_count integer;
begin
  update public.object_texture_slots
  set
    replacement_canvas_width_px = 870,
    replacement_canvas_height_px = 256,
    surface_width_m = 1.22925696,
    surface_height_m = 0.36170862
  where slot_key = '1b1791647b8a6ff59f6c5bbaddea2104ce71be098dfed8d97221b01a13eafd0e'
    and site_id = 'S202103'
    and source_kind = 'vworld_uv'
    and object_key = 'b00540045882200332204737200'
    and source_feature_key = 'B_1_19_13:F000'
    and source_image_id = 'B_1_19_13:I000'
    and image_sha256 = 'd98ca0da523a6bcce2d89210bde472085eb34ac32f6f592e05c04c2ac3c99a78'
    and crop_width_px = 256
    and crop_height_px = 256;

  get diagnostics calibrated_count = row_count;
  if calibrated_count <> 1 then
    raise exception 'F02FC092-S01 surface calibration target mismatch: updated % rows', calibrated_count;
  end if;
end $$;
