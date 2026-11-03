import fs from "node:fs";

const [slotsPath, outputPath] = process.argv.slice(2);
if (!slotsPath || !outputPath) {
  console.error("Usage: node tools/build_object_slot_camera_heading_migration.mjs <object-texture-slots.json> <migration.sql>");
  process.exit(1);
}

const slots = JSON.parse(fs.readFileSync(slotsPath, "utf8"));
if (!Array.isArray(slots) || !slots.length) throw new Error("Object texture slot catalog is empty");

const headings = slots.map((slot) => ({
  slot_key: slot.slot_key,
  camera_heading_deg: Number.isFinite(slot.camera_heading_deg) ? slot.camera_heading_deg : null,
}));
const payload = JSON.stringify(headings).replaceAll("$object_headings$", "");
const migration = `-- Store the facade-facing camera azimuth extracted from each object's
-- textured B3DM triangles. Existing assignments and replacement history remain.

alter table public.object_texture_slots
  add column if not exists camera_heading_deg double precision
  check (camera_heading_deg is null or (camera_heading_deg >= 0 and camera_heading_deg < 360));

create temporary table corrected_object_slot_headings (
  slot_key text primary key,
  camera_heading_deg double precision
) on commit drop;

insert into corrected_object_slot_headings
select * from jsonb_to_recordset($object_headings$${payload}$object_headings$::jsonb) as x(
  slot_key text,
  camera_heading_deg double precision
);

do $$
declare
  expected_count integer := ${headings.length};
  supplied_count integer;
  missing_count integer;
begin
  select count(*) into supplied_count from corrected_object_slot_headings;
  if supplied_count <> expected_count then
    raise exception 'Expected % object headings, got %', expected_count, supplied_count;
  end if;

  select count(*) into missing_count
  from corrected_object_slot_headings corrected
  left join public.object_texture_slots existing using (slot_key)
  where existing.slot_key is null;
  if missing_count > 0 then
    raise exception '% object heading rows do not exist in object_texture_slots', missing_count;
  end if;
end;
$$;

update public.object_texture_slots existing
set camera_heading_deg = corrected.camera_heading_deg
from corrected_object_slot_headings corrected
where existing.slot_key = corrected.slot_key;
`;

fs.writeFileSync(outputPath, migration);
console.log(JSON.stringify({ slots: headings.length, headings: headings.filter((row) => row.camera_heading_deg !== null).length, outputPath }, null, 2));
