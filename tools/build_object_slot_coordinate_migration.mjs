import fs from "node:fs";

const [slotsPath, outputPath] = process.argv.slice(2);
if (!slotsPath || !outputPath) {
  console.error("Usage: node tools/build_object_slot_coordinate_migration.mjs <object-texture-slots.json> <migration.sql>");
  process.exit(1);
}

const slots = JSON.parse(fs.readFileSync(slotsPath, "utf8"));
if (!Array.isArray(slots) || !slots.length) throw new Error("Object texture slot catalog is empty");

const corrected = slots.map((slot) => ({
  slot_key: slot.slot_key,
  source_feature_key: slot.source_feature_key,
  longitude: slot.longitude,
  latitude: slot.latitude,
  height_m: slot.height_m,
  east_m: slot.east_m,
  north_m: slot.north_m,
  up_m: slot.up_m,
  tile: slot.tile,
  tile_depth: slot.tile_depth,
}));

const payload = JSON.stringify(corrected).replaceAll("$corrected_slots$", "");
const migration = `-- Correct object positions extracted from VWorld B3DM.
-- The previous catalog applied the GLB renderer axis matrix before RTC_CENTER,
-- rotating tile-local ECEF offsets twice. This migration changes source
-- placement metadata only; assignments, replacements, and review state remain.

create temporary table corrected_object_slot_coordinates (
  slot_key text primary key,
  source_feature_key text not null,
  longitude double precision not null,
  latitude double precision not null,
  height_m double precision not null,
  east_m double precision not null,
  north_m double precision not null,
  up_m double precision not null,
  tile text not null,
  tile_depth integer
) on commit drop;

insert into corrected_object_slot_coordinates
select * from jsonb_to_recordset($corrected_slots$${payload}$corrected_slots$::jsonb) as x(
  slot_key text,
  source_feature_key text,
  longitude double precision,
  latitude double precision,
  height_m double precision,
  east_m double precision,
  north_m double precision,
  up_m double precision,
  tile text,
  tile_depth integer
);

do $$
declare
  expected_count integer := ${corrected.length};
  supplied_count integer;
  missing_count integer;
begin
  select count(*) into supplied_count from corrected_object_slot_coordinates;
  if supplied_count <> expected_count then
    raise exception 'Expected % corrected slots, got %', expected_count, supplied_count;
  end if;

  select count(*) into missing_count
  from corrected_object_slot_coordinates corrected
  left join public.object_texture_slots existing using (slot_key)
  where existing.slot_key is null;
  if missing_count > 0 then
    raise exception '% corrected slots do not exist in object_texture_slots', missing_count;
  end if;
end;
$$;

update public.object_texture_slots existing
set source_feature_key = corrected.source_feature_key,
    longitude = corrected.longitude,
    latitude = corrected.latitude,
    height_m = corrected.height_m,
    east_m = corrected.east_m,
    north_m = corrected.north_m,
    up_m = corrected.up_m,
    tile = corrected.tile,
    tile_depth = corrected.tile_depth
from corrected_object_slot_coordinates corrected
where existing.slot_key = corrected.slot_key;
`;

fs.writeFileSync(outputPath, migration);
console.log(JSON.stringify({ slots: corrected.length, outputPath }, null, 2));
