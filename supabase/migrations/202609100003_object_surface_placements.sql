-- Preserve one replacement workflow for shared UV pixels while rendering the
-- approved image at every real, disconnected surface placement.

alter table public.object_texture_slots
  add column if not exists surface_placements jsonb not null default '[]'::jsonb;

create or replace function public.object_surface_placements_are_valid(
  p_placements jsonb,
  p_surface_count integer,
  p_placement_count integer
)
returns boolean
language plpgsql
immutable
strict
set search_path = pg_catalog, public
as $$
declare
  placement jsonb;
  placement_id text;
  placement_ids text[] := array[]::text[];
  primary_count integer := 0;
  longitude_value double precision;
  latitude_value double precision;
  heading_value double precision;
  width_value double precision;
  height_value double precision;
begin
  if jsonb_typeof(p_placements) <> 'array' then return false; end if;
  if jsonb_array_length(p_placements) = 0 then return true; end if;
  if jsonb_array_length(p_placements) <> p_surface_count
    or jsonb_array_length(p_placements) <> p_placement_count then
    return false;
  end if;

  for placement in select value from jsonb_array_elements(p_placements)
  loop
    if jsonb_typeof(placement) <> 'object' then return false; end if;
    placement_id := nullif(btrim(placement ->> 'placement_id'), '');
    if placement_id is null or placement_id = any(placement_ids) then return false; end if;
    placement_ids := array_append(placement_ids, placement_id);

    if jsonb_typeof(placement -> 'is_primary') is distinct from 'boolean'
      or jsonb_typeof(placement -> 'longitude') is distinct from 'number'
      or jsonb_typeof(placement -> 'latitude') is distinct from 'number'
      or jsonb_typeof(placement -> 'height_m') is distinct from 'number'
      or jsonb_typeof(placement -> 'east_m') is distinct from 'number'
      or jsonb_typeof(placement -> 'north_m') is distinct from 'number'
      or jsonb_typeof(placement -> 'up_m') is distinct from 'number'
      or jsonb_typeof(placement -> 'camera_heading_deg') is distinct from 'number'
      or jsonb_typeof(placement -> 'surface_width_m') is distinct from 'number'
      or jsonb_typeof(placement -> 'surface_height_m') is distinct from 'number' then
      return false;
    end if;

    if (placement ->> 'is_primary')::boolean then primary_count := primary_count + 1; end if;
    longitude_value := (placement ->> 'longitude')::double precision;
    latitude_value := (placement ->> 'latitude')::double precision;
    heading_value := (placement ->> 'camera_heading_deg')::double precision;
    width_value := (placement ->> 'surface_width_m')::double precision;
    height_value := (placement ->> 'surface_height_m')::double precision;
    if longitude_value < -180 or longitude_value > 180
      or latitude_value < -90 or latitude_value > 90
      or heading_value < 0 or heading_value >= 360
      or width_value <= 0 or height_value <= 0 then
      return false;
    end if;
  end loop;

  return primary_count = 1;
exception when others then
  return false;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.object_texture_slots'::regclass
      and conname = 'object_texture_slots_surface_placements_array_check'
  ) then
    alter table public.object_texture_slots
      add constraint object_texture_slots_surface_placements_array_check
      check (public.object_surface_placements_are_valid(
        surface_placements,
        surface_count,
        placement_count
      ));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from public.object_texture_slots
    where slot_key = 'f01787e8cb1eaac8d79c4c1a58190af819fee12d7fd19928664c73cf7a1a6bd6'
      and site_id = 'S202103'
      and source_kind = 'vworld_uv'
      and slot_alias = 'F02WL072-S22'
  ) then
    raise exception 'F02WL072-S22 surface slot was not found';
  end if;
end $$;

update public.object_texture_slots
set
  placement_count = 2,
  surface_width_m = 1.5026416,
  surface_height_m = 2.8133820,
  surface_placements = jsonb_build_array(
    jsonb_build_object(
      'placement_id', 'south-end',
      'is_primary', true,
      'longitude', 126.97079916206121,
      'latitude', 37.55387833860242,
      'height_m', 37.5426800968,
      'east_m', -1.84129,
      'north_m', 27.56278,
      'up_m', 10.34262,
      'camera_heading_deg', 174.969833,
      'surface_width_m', 1.5026416,
      'surface_height_m', 2.8133820
    ),
    jsonb_build_object(
      'placement_id', 'north-end',
      'is_primary', false,
      'longitude', 126.97079695828627,
      'latitude', 37.553914096515854,
      'height_m', 37.5426800922,
      'east_m', -2.03602,
      'north_m', 31.53150,
      'up_m', 10.34260,
      'camera_heading_deg', 354.970071,
      'surface_width_m', 1.5026416,
      'surface_height_m', 2.8133820
    )
  )
where slot_key = 'f01787e8cb1eaac8d79c4c1a58190af819fee12d7fd19928664c73cf7a1a6bd6'
  and site_id = 'S202103'
  and source_kind = 'vworld_uv'
  and slot_alias = 'F02WL072-S22';
