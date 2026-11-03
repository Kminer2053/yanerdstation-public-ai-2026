import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
  isCoplanarSurfacePlacement,
  matchingLegacyReplacementCrop,
} from "../src/replacement-surface-contract.js";

const [catalogDir, outputJson, outputMigration] = process.argv.slice(2);
if (!catalogDir || !outputJson || !outputMigration) {
  console.error("Usage: node tools/build_object_texture_slots.mjs <catalog-dir> <output.json> <migration.sql>");
  process.exit(1);
}

const occurrences = JSON.parse(fs.readFileSync(path.join(catalogDir, "image-catalog.json"), "utf8"));
const features = JSON.parse(fs.readFileSync(path.join(catalogDir, "feature-catalog.json"), "utf8"));
const manifest = JSON.parse(fs.readFileSync(path.join(catalogDir, "manifest.json"), "utf8"));
const calibrationDocument = JSON.parse(fs.readFileSync(new URL("./vworld-surface-calibrations.json", import.meta.url), "utf8"));
if (calibrationDocument.schema_version !== 1 || !Array.isArray(calibrationDocument.calibrations)) {
  throw new Error("Unsupported VWorld surface calibration document");
}
const placementDocument = JSON.parse(fs.readFileSync(new URL("./vworld-surface-placements.json", import.meta.url), "utf8"));
if (placementDocument.schema_version !== 1 || !Array.isArray(placementDocument.placements)) {
  throw new Error("Unsupported VWorld surface placement document");
}
const calibrations = calibrationDocument.calibrations;
const calibrationKeys = calibrations.map((row) => row.slot_key);
if (new Set(calibrationKeys).size !== calibrationKeys.length) throw new Error("Duplicate VWorld surface calibration slot_key");
for (const row of calibrations) {
  const numbers = [
    row.crop_width_px, row.crop_height_px,
    row.replacement_canvas_width_px, row.replacement_canvas_height_px,
    row.surface_width_m, row.surface_height_m,
  ].map(Number);
  if (![row.slot_key, row.site_id, row.object_key, row.source_feature_key, row.source_image_id, row.image_sha256].every(Boolean)
    || !numbers.every((value) => Number.isFinite(value) && value > 0)) {
    throw new Error(`Invalid VWorld surface calibration ${row.slot_key || "without slot_key"}`);
  }
  const canvasAspect = Number(row.replacement_canvas_width_px) / Number(row.replacement_canvas_height_px);
  const surfaceAspect = Number(row.surface_width_m) / Number(row.surface_height_m);
  if (Math.abs(canvasAspect / surfaceAspect - 1) > .01) {
    throw new Error(`Replacement canvas aspect does not match physical surface ${row.slot_key}`);
  }
}
const placementSets = placementDocument.placements;
const placementKeys = placementSets.map((row) => row.slot_key);
if (new Set(placementKeys).size !== placementKeys.length) throw new Error("Duplicate VWorld surface placement slot_key");
for (const row of placementSets) {
  const surfaces = row.surface_placements;
  const dimensions = [row.surface_width_m, row.surface_height_m].map(Number);
  if (![row.slot_key, row.site_id, row.object_key, row.source_feature_key, row.source_image_id, row.image_sha256].every(Boolean)
    || ![row.crop_width_px, row.crop_height_px].map(Number).every((value) => Number.isInteger(value) && value > 0)
    || !dimensions.every((value) => Number.isFinite(value) && value > 0)
    || !Array.isArray(surfaces) || surfaces.length < 1) {
    throw new Error(`Invalid VWorld surface placement set ${row.slot_key || "without slot_key"}`);
  }
  const surfaceIds = surfaces.map((surface) => surface.placement_id);
  if (surfaceIds.some((id) => !id) || new Set(surfaceIds).size !== surfaceIds.length
    || surfaces.filter((surface) => surface.is_primary === true).length !== 1) {
    throw new Error(`Invalid VWorld surface placement identities ${row.slot_key}`);
  }
  for (const surface of surfaces) {
    const numbers = [
      surface.longitude, surface.latitude, surface.height_m,
      surface.east_m, surface.north_m, surface.up_m,
      surface.camera_heading_deg, surface.surface_width_m, surface.surface_height_m,
    ].map(Number);
    if (typeof surface.is_primary !== "boolean"
      || !numbers.every(Number.isFinite)
      || Number(surface.longitude) < -180 || Number(surface.longitude) > 180
      || Number(surface.latitude) < -90 || Number(surface.latitude) > 90
      || Number(surface.camera_heading_deg) < 0 || Number(surface.camera_heading_deg) >= 360
      || Number(surface.surface_width_m) <= 0 || Number(surface.surface_height_m) <= 0) {
      throw new Error(`Invalid VWorld surface placement ${row.slot_key}:${surface.placement_id || "without placement_id"}`);
    }
    if (surface.render_kind && !isCoplanarSurfacePlacement(surface)) {
      throw new Error(`Invalid coplanar VWorld surface placement ${row.slot_key}:${surface.placement_id}`);
    }
    if (surface.legacy_replacement_crop) {
      const crop = surface.legacy_replacement_crop;
      const validCrop = matchingLegacyReplacementCrop(
        { surface_placements: [surface] },
        { replacement_width_px: crop.source_width_px, replacement_height_px: crop.source_height_px },
      );
      if (!validCrop) {
        throw new Error(`Invalid legacy replacement crop ${row.slot_key}:${surface.placement_id}`);
      }
    }
  }
}
const siteId = manifest.site_id || "S202103";
const sourceObservedAt = occurrences.map((row) => row.source_observed_at).filter(Boolean).sort().at(-1) || null;
const byImageId = new Map(occurrences.map((row) => [row.image_id, row]));
const groups = new Map();
const calibrationBySlotKey = new Map(calibrations.map((row) => [row.slot_key, row]));
const appliedCalibrationKeys = new Set();
const placementSetBySlotKey = new Map(placementSets.map((row) => [row.slot_key, row]));
const appliedPlacementKeys = new Set();

for (const feature of features) {
  if (!feature.image_regions?.length) continue;
  const sourceObjectKey = feature.td_id || feature.feature_key;
  const objectKey = siteId === "S202103" ? sourceObjectKey : `${siteId}:${sourceObjectKey}`;
  if (!groups.has(objectKey)) groups.set(objectKey, []);
  groups.get(objectKey).push(feature);
}

const slots = [];
for (const [objectKey, rows] of groups) {
  const candidates = rows.flatMap((feature) => feature.image_regions.map((region) => ({
    feature,
    region,
    occurrence: byImageId.get(region.image_id),
  }))).filter(({ occurrence }) => occurrence && !occurrence.placeholder);
  if (!candidates.length) continue;
  const maxDepth = Math.max(...candidates.map(({ occurrence }) => Number(occurrence.tile_depth ?? -1)));
  const best = candidates
    .filter(({ occurrence }) => Number(occurrence.tile_depth ?? -1) === maxDepth)
    .sort((a, b) => {
      const aPixels = Number(a.occurrence.width_px) * Number(a.occurrence.height_px);
      const bPixels = Number(b.occurrence.width_px) * Number(b.occurrence.height_px);
      return bPixels - aPixels || a.feature.feature_key.localeCompare(b.feature.feature_key);
    });
  const objectSlots = [];
  const sized = best.map((candidate) => {
    const cropWidth = Math.max(1, Math.round((candidate.region.u_max - candidate.region.u_min) * candidate.occurrence.width_px));
    const cropHeight = Math.max(1, Math.round((candidate.region.v_max - candidate.region.v_min) * candidate.occurrence.height_px));
    return { ...candidate, cropWidth, cropHeight };
  });
  const meaningful = sized.filter(({ cropWidth, cropHeight, region }) => cropWidth >= 8 && cropHeight >= 8 && Number(region.uv_fill_ratio ?? 1) >= .25);
  const splitIntoSurfacePhotos = rows.some((feature) => feature.class_code === "WL");
  let selected = meaningful.length ? meaningful : sized.sort((a, b) => b.cropWidth * b.cropHeight - a.cropWidth * a.cropHeight).slice(0, 1);
  if (!splitIntoSurfacePhotos) {
    const bySourceImage = new Map();
    for (const candidate of selected) {
      const key = candidate.occurrence.image_sha256;
      if (!bySourceImage.has(key)) {
        bySourceImage.set(key, { ...candidate, region: { ...candidate.region } });
        continue;
      }
      const aggregate = bySourceImage.get(key);
      aggregate.region.u_min = Math.min(aggregate.region.u_min, candidate.region.u_min);
      aggregate.region.v_min = Math.min(aggregate.region.v_min, candidate.region.v_min);
      aggregate.region.u_max = Math.max(aggregate.region.u_max, candidate.region.u_max);
      aggregate.region.v_max = Math.max(aggregate.region.v_max, candidate.region.v_max);
      aggregate.region.uv_vertex_count = Number(aggregate.region.uv_vertex_count || 0) + Number(candidate.region.uv_vertex_count || 0);
      aggregate.region.triangle_count = Number(aggregate.region.triangle_count || 0) + Number(candidate.region.triangle_count || 0);
      aggregate.region.surface_count = Number(aggregate.region.surface_count || 1) + Number(candidate.region.surface_count || 1);
      aggregate.region.surface_area_m2 = Number(aggregate.region.surface_area_m2 || 0) + Number(candidate.region.surface_area_m2 || 0);
    }
    selected = [...bySourceImage.values()].map((candidate) => ({
      ...candidate,
      cropWidth: Math.max(1, Math.round((candidate.region.u_max - candidate.region.u_min) * candidate.occurrence.width_px)),
      cropHeight: Math.max(1, Math.round((candidate.region.v_max - candidate.region.v_min) * candidate.occurrence.height_px)),
    }));
  }
  const unitCandidates = [];
  for (const candidate of selected) {
    const { region, occurrence } = candidate;
    const bounds = { u_min: region.u_min, v_min: region.v_min, u_max: region.u_max, v_max: region.v_max };
    const overlapRatio = (other) => {
      const width = Math.max(0, Math.min(other.region.u_max, bounds.u_max) - Math.max(other.region.u_min, bounds.u_min));
      const height = Math.max(0, Math.min(other.region.v_max, bounds.v_max) - Math.max(other.region.v_min, bounds.v_min));
      const intersection = width * height;
      const firstArea = (other.region.u_max - other.region.u_min) * (other.region.v_max - other.region.v_min);
      const secondArea = (bounds.u_max - bounds.u_min) * (bounds.v_max - bounds.v_min);
      return intersection / Math.max(firstArea, secondArea, 1e-12);
    };
    const existing = unitCandidates.find((other) => other.occurrence.image_sha256 === occurrence.image_sha256 && overlapRatio(other) >= .96);
    if (existing) {
      existing.placement_count += 1;
      existing.region.surface_count = Number(existing.region.surface_count || 1) + Number(region.surface_count || 1);
      existing.region.triangle_count = Number(existing.region.triangle_count || 0) + Number(region.triangle_count || 0);
      existing.region.surface_area_m2 = Number(existing.region.surface_area_m2 || 0) + Number(region.surface_area_m2 || 0);
      continue;
    }
    unitCandidates.push({ ...candidate, placement_count: 1, region: { ...region } });
  }
  for (const { feature, region, occurrence, cropWidth, cropHeight, placement_count } of unitCandidates) {
    const physicalEast = region.east_m ?? feature.east_m;
    const physicalNorth = region.north_m ?? feature.north_m;
    const physicalUp = region.up_m ?? feature.up_m;
    const regionSignature = [
      occurrence.image_sha256,
      Number(region.u_min).toFixed(6), Number(region.v_min).toFixed(6),
      Number(region.u_max).toFixed(6), Number(region.v_max).toFixed(6),
    ].join("|");
    const slotKey = crypto.createHash("sha256").update(`${objectKey}|uv-surface-v1|${regionSignature}`).digest("hex");
    const calibration = calibrationBySlotKey.get(slotKey);
    if (calibration) {
      const calibrationMatches = calibration.site_id === siteId
        && calibration.object_key === objectKey
        && calibration.source_feature_key === feature.feature_key
        && calibration.source_image_id === region.image_id
        && calibration.image_sha256 === occurrence.image_sha256
        && Number(calibration.crop_width_px) === cropWidth
        && Number(calibration.crop_height_px) === cropHeight;
      if (!calibrationMatches) throw new Error(`Surface calibration no longer matches slot ${slotKey}`);
      appliedCalibrationKeys.add(slotKey);
    }
    const placementSet = placementSetBySlotKey.get(slotKey);
    if (placementSet) {
      const placementMatches = placementSet.site_id === siteId
        && placementSet.object_key === objectKey
        && placementSet.source_feature_key === feature.feature_key
        && placementSet.source_image_id === region.image_id
        && placementSet.image_sha256 === occurrence.image_sha256
        && Number(placementSet.crop_width_px) === cropWidth
        && Number(placementSet.crop_height_px) === cropHeight
        && Number(region.surface_count || 1) === placementSet.surface_placements.length;
      if (!placementMatches) throw new Error(`Surface placements no longer match slot ${slotKey}`);
      appliedPlacementKeys.add(slotKey);
    }
    const primaryPlacement = placementSet?.surface_placements.find((surface) => surface.is_primary === true);
    const ocrLabel = String(occurrence.ocr_label_candidate || "").trim();
    const ocrText = String(occurrence.ocr_text || "").trim();
    const surfaceWidth = Number(placementSet?.surface_width_m ?? calibration?.surface_width_m ?? region.surface_width_m);
    const surfaceHeight = Number(placementSet?.surface_height_m ?? calibration?.surface_height_m ?? region.surface_height_m);
    const replacementCanvasWidth = Number(calibration?.replacement_canvas_width_px ?? region.replacement_canvas_width_px);
    const replacementCanvasHeight = Number(calibration?.replacement_canvas_height_px ?? region.replacement_canvas_height_px);
    objectSlots.push({
      slot_key: slotKey,
      site_id: siteId,
      object_key: objectKey,
      slot_alias: "",
      slot_level: splitIntoSurfacePhotos ? "uv_surface" : "texture_image",
      is_active: true,
      source_kind: "vworld_uv",
      target_asset_id: null,
      target_surface_id: null,
      surface_width_m: Number.isFinite(surfaceWidth) && surfaceWidth > 0 ? surfaceWidth : null,
      surface_height_m: Number.isFinite(surfaceHeight) && surfaceHeight > 0 ? surfaceHeight : null,
      replacement_canvas_width_px: Number.isFinite(replacementCanvasWidth) && replacementCanvasWidth > 0 ? Math.round(replacementCanvasWidth) : null,
      replacement_canvas_height_px: Number.isFinite(replacementCanvasHeight) && replacementCanvasHeight > 0 ? Math.round(replacementCanvasHeight) : null,
      source_feature_key: feature.feature_key,
      source_image_id: region.image_id,
      source_region_signature: region.subregion_signature || regionSignature,
      image_sha256: occurrence.image_sha256,
      slot_index: 0,
      floor: feature.floor || "미연결",
      td_id: feature.td_id || "",
      model_name: feature.model_name || "",
      class_code: feature.class_code || "",
      object_label: feature.model_name || ocrLabel || ocrText.split(/\r?\n/)[0] || `개체 ${objectKey.slice(-10)}`,
      replacement_priority: occurrence.replacement_priority || "REVIEW",
      mime_type: occurrence.mime_type,
      atlas_width_px: Number(occurrence.width_px),
      atlas_height_px: Number(occurrence.height_px),
      crop_width_px: cropWidth,
      crop_height_px: cropHeight,
      u_min: region.u_min,
      v_min: region.v_min,
      u_max: region.u_max,
      v_max: region.v_max,
      uv_vertex_count: region.uv_vertex_count || 0,
      triangle_count: region.triangle_count || 0,
      surface_count: region.surface_count || 1,
      placement_count: placementSet?.surface_placements.length ?? placement_count,
      surface_placements: placementSet?.surface_placements ?? [],
      uv_area: region.uv_area || 0,
      uv_fill_ratio: region.uv_fill_ratio ?? 1,
      surface_area_m2: region.surface_area_m2 || 0,
      longitude: primaryPlacement?.longitude ?? region.longitude ?? feature.longitude,
      latitude: primaryPlacement?.latitude ?? region.latitude ?? feature.latitude,
      height_m: primaryPlacement?.height_m ?? region.height_m ?? feature.height_m,
      east_m: primaryPlacement?.east_m ?? physicalEast,
      north_m: primaryPlacement?.north_m ?? physicalNorth,
      up_m: primaryPlacement?.up_m ?? physicalUp,
      camera_heading_deg: primaryPlacement?.camera_heading_deg ?? region.camera_heading_deg ?? feature.camera_heading_deg ?? null,
      _alias_sort_east_m: physicalEast,
      _alias_sort_north_m: physicalNorth,
      tile: feature.tile,
      tile_depth: occurrence.tile_depth,
      original_storage_path: `originals/${occurrence.image_sha256}${path.extname(occurrence.asset_path).toLowerCase() || (occurrence.mime_type === "image/ktx2" ? ".ktx2" : ".jpg")}`,
      preview_storage_path: `previews/${occurrence.image_sha256}.png`,
      ocr_text: ocrText,
      source_observed_at: occurrence.source_observed_at || sourceObservedAt,
    });
  }
  objectSlots.sort((a, b) => Number(a._alias_sort_north_m) - Number(b._alias_sort_north_m)
    || Number(a._alias_sort_east_m) - Number(b._alias_sort_east_m)
    || a.v_min - b.v_min || a.u_min - b.u_min);
  objectSlots.forEach((slot, index) => {
    delete slot._alias_sort_east_m;
    delete slot._alias_sort_north_m;
    slot.slot_index = index;
    slot.slot_alias = `${slot.model_name || `OBJ-${objectKey.slice(-8)}`}-S${String(index + 1).padStart(2, "0")}`;
  });
  slots.push(...objectSlots);
}

slots.sort((a, b) => a.floor.localeCompare(b.floor) || Number(a.north_m) - Number(b.north_m) || Number(a.east_m) - Number(b.east_m));
const missingCalibrations = calibrations
  .filter((row) => row.site_id === siteId && !appliedCalibrationKeys.has(row.slot_key));
if (missingCalibrations.length) {
  throw new Error(`Surface calibrations were not applied: ${missingCalibrations.map((row) => row.slot_key).join(", ")}`);
}
const missingPlacementSets = placementSets
  .filter((row) => row.site_id === siteId && !appliedPlacementKeys.has(row.slot_key));
if (missingPlacementSets.length) {
  throw new Error(`Surface placements were not applied: ${missingPlacementSets.map((row) => row.slot_key).join(", ")}`);
}
fs.writeFileSync(outputJson, `${JSON.stringify(slots, null, 2)}\n`);

const sqlJson = JSON.stringify(slots).replaceAll("$object_slots$", "");
const migration = `-- Object-scoped texture regions extracted from VWorld B3DM UV coordinates.
-- A shared atlas remains immutable; replacement versions belong to one object/UV slot.

alter table public.feature_placements
  add column if not exists image_regions jsonb not null default '[]'::jsonb;

create table if not exists public.object_texture_slots (
  slot_key text primary key check (slot_key ~ '^[0-9a-f]{64}$'),
  site_id text not null default 'S202103' references public.catalog_manifests(site_id) on delete cascade,
  object_key text not null,
  slot_alias text not null default '',
  slot_level text not null default 'uv_surface' check (slot_level in ('legacy_object','texture_image','uv_surface')),
  is_active boolean not null default true,
  source_kind text not null default 'vworld_uv' check (source_kind in ('vworld_uv','app_asset')),
  target_asset_id text,
  target_surface_id text,
  surface_width_m double precision,
  surface_height_m double precision,
  replacement_canvas_width_px integer,
  replacement_canvas_height_px integer,
  source_feature_key text not null,
  source_image_id text not null,
  source_region_signature text not null default '',
  image_sha256 text not null check (image_sha256 ~ '^[0-9a-f]{64}$'),
  slot_index integer not null default 0,
  floor text not null default '',
  td_id text not null default '',
  model_name text not null default '',
  class_code text not null default '',
  object_label text not null default '',
  replacement_priority text not null default 'REVIEW' check (replacement_priority in ('HIGH','MEDIUM','REVIEW','REFERENCE','EXCLUDE')),
  mime_type text not null,
  atlas_width_px integer not null check (atlas_width_px > 0),
  atlas_height_px integer not null check (atlas_height_px > 0),
  crop_width_px integer not null check (crop_width_px > 0),
  crop_height_px integer not null check (crop_height_px > 0),
  u_min double precision not null,
  v_min double precision not null,
  u_max double precision not null,
  v_max double precision not null,
  uv_vertex_count integer not null default 0,
  triangle_count integer not null default 0,
  surface_count integer not null default 1,
  placement_count integer not null default 1,
  surface_placements jsonb not null default '[]'::jsonb,
  uv_area double precision not null default 0,
  uv_fill_ratio double precision not null default 1,
  surface_area_m2 double precision not null default 0,
  longitude double precision,
  latitude double precision,
  height_m double precision,
  east_m double precision,
  north_m double precision,
  up_m double precision,
  camera_heading_deg double precision,
  tile text not null,
  tile_depth integer,
  original_storage_path text not null,
  preview_storage_path text not null,
  ocr_text text not null default '',
  source_observed_at date
);

alter table public.object_texture_slots
  add column if not exists site_id text not null default 'S202103' references public.catalog_manifests(site_id) on delete cascade,
  add column if not exists slot_alias text not null default '',
  add column if not exists slot_level text not null default 'legacy_object' check (slot_level in ('legacy_object','texture_image','uv_surface')),
  add column if not exists is_active boolean not null default true,
  add column if not exists source_kind text not null default 'vworld_uv' check (source_kind in ('vworld_uv','app_asset')),
  add column if not exists target_asset_id text,
  add column if not exists target_surface_id text,
  add column if not exists surface_width_m double precision,
  add column if not exists surface_height_m double precision,
  add column if not exists replacement_canvas_width_px integer,
  add column if not exists replacement_canvas_height_px integer,
  add column if not exists source_region_signature text not null default '',
  add column if not exists triangle_count integer not null default 0,
  add column if not exists surface_count integer not null default 1,
  add column if not exists placement_count integer not null default 1,
  add column if not exists surface_placements jsonb not null default '[]'::jsonb,
  add column if not exists uv_area double precision not null default 0,
  add column if not exists uv_fill_ratio double precision not null default 1,
  add column if not exists surface_area_m2 double precision not null default 0;

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

create index if not exists object_texture_slots_object_idx on public.object_texture_slots(object_key);
create index if not exists object_texture_slots_site_idx on public.object_texture_slots(site_id, is_active, floor, north_m, east_m);
create index if not exists object_texture_slots_floor_idx on public.object_texture_slots(floor);
create index if not exists object_texture_slots_location_idx on public.object_texture_slots(floor, north_m, east_m);
create index if not exists object_texture_slots_active_idx on public.object_texture_slots(is_active, floor, north_m, east_m);

create table if not exists public.object_slot_work_items (
  slot_key text primary key references public.object_texture_slots(slot_key) on delete cascade,
  status text not null default 'pending' check (status in ('pending','in_progress','review','approved','hold')),
  assignee_id uuid references public.profiles(id) on delete set null,
  current_store_name text not null default '',
  note text not null default '',
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.object_slot_replacement_versions (
  id uuid primary key default gen_random_uuid(),
  slot_key text not null references public.object_texture_slots(slot_key) on delete cascade,
  storage_path text not null unique,
  file_name text not null,
  replacement_width_px integer not null,
  replacement_height_px integer not null,
  replacement_mime_type text not null check (replacement_mime_type in ('image/png','image/jpeg','image/webp')),
  replacement_byte_length bigint not null default 0,
  current_store_name text not null default '',
  note text not null default '',
  review_status text not null default 'submitted' check (review_status in ('draft','submitted','approved','rejected')),
  created_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
  reviewed_by uuid references public.profiles(id) on delete set null,
  review_note text not null default '',
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists object_slot_replacements_slot_idx on public.object_slot_replacement_versions(slot_key, created_at desc);

create or replace function public.validate_object_slot_replacement_dimensions()
returns trigger language plpgsql set search_path = public as $$
declare
  expected public.object_texture_slots;
  expected_width integer;
  expected_height integer;
begin
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

drop trigger if exists validate_object_slot_replacement_dimensions on public.object_slot_replacement_versions;
create trigger validate_object_slot_replacement_dimensions before insert or update on public.object_slot_replacement_versions
for each row execute function public.validate_object_slot_replacement_dimensions();

drop trigger if exists object_slot_work_items_touch_updated_at on public.object_slot_work_items;
create trigger object_slot_work_items_touch_updated_at before update on public.object_slot_work_items
for each row execute function public.touch_updated_at();

create or replace function public.claim_object_slot_work(p_slot_key text)
returns public.object_slot_work_items language plpgsql security definer set search_path = public as $$
declare result public.object_slot_work_items;
begin
  if not public.is_active_member() then raise exception '공개 편집 세션이 필요합니다.'; end if;
  update public.object_slot_work_items
  set assignee_id = auth.uid(), status = case when status in ('review','approved') then status else 'in_progress' end, updated_by = auth.uid()
  where slot_key = p_slot_key returning * into result;
  if result.slot_key is null then raise exception '이미지 슬롯을 찾지 못했습니다.'; end if;
  return result;
end;
$$;

create or replace function public.set_object_slot_work_status(p_slot_key text, p_status text)
returns public.object_slot_work_items language plpgsql security definer set search_path = public as $$
declare result public.object_slot_work_items;
begin
  if p_status not in ('pending','in_progress','review','approved','hold') then raise exception '지원하지 않는 작업 상태입니다.'; end if;
  if not public.is_active_member() then raise exception '공개 편집 세션이 필요합니다.'; end if;
  update public.object_slot_work_items
  set status = p_status, assignee_id = case when p_status = 'pending' then null else coalesce(assignee_id, auth.uid()) end, updated_by = auth.uid()
  where slot_key = p_slot_key returning * into result;
  if result.slot_key is null then raise exception '이미지 슬롯을 찾지 못했습니다.'; end if;
  return result;
end;
$$;

create or replace function public.review_object_slot_replacement(p_version_id uuid, p_decision text, p_note text default '')
returns public.object_slot_replacement_versions language plpgsql security definer set search_path = public as $$
declare result public.object_slot_replacement_versions;
begin
  if not public.is_active_member() then raise exception '공개 편집 세션이 필요합니다.'; end if;
  if p_decision not in ('approved','rejected') then raise exception '승인 또는 반려만 가능합니다.'; end if;
  update public.object_slot_replacement_versions
  set review_status = p_decision, reviewed_by = auth.uid(), review_note = left(coalesce(p_note,''),600), reviewed_at = now()
  where id = p_version_id returning * into result;
  if result.id is null then raise exception '교체 버전을 찾지 못했습니다.'; end if;
  update public.object_slot_work_items
  set status = case when p_decision = 'approved' then 'approved' else 'in_progress' end, updated_by = auth.uid()
  where slot_key = result.slot_key;
  return result;
end;
$$;

alter table public.object_texture_slots enable row level security;
alter table public.object_slot_work_items enable row level security;
alter table public.object_slot_replacement_versions enable row level security;

drop policy if exists object_slots_read_active on public.object_texture_slots;
create policy object_slots_read_active on public.object_texture_slots for select to authenticated using (public.is_active_member());
drop policy if exists object_slot_work_read_active on public.object_slot_work_items;
create policy object_slot_work_read_active on public.object_slot_work_items for select to authenticated using (public.is_active_member());
drop policy if exists object_slot_work_update_active on public.object_slot_work_items;
create policy object_slot_work_update_active on public.object_slot_work_items for update to authenticated using (public.is_active_member()) with check (public.is_active_member());
drop policy if exists object_slot_replacements_read_active on public.object_slot_replacement_versions;
create policy object_slot_replacements_read_active on public.object_slot_replacement_versions for select to authenticated using (public.is_active_member());
drop policy if exists object_slot_replacements_insert_active on public.object_slot_replacement_versions;
create policy object_slot_replacements_insert_active on public.object_slot_replacement_versions for insert to authenticated with check (public.is_active_member() and created_by = auth.uid());
drop policy if exists object_slot_replacements_update_active on public.object_slot_replacement_versions;
create policy object_slot_replacements_update_active on public.object_slot_replacement_versions for update to authenticated using (public.is_active_member()) with check (public.is_active_member());

grant select on public.object_texture_slots to authenticated;
grant select, update on public.object_slot_work_items to authenticated;
grant select, insert, update on public.object_slot_replacement_versions to authenticated;
grant execute on function public.claim_object_slot_work(text) to authenticated;
grant execute on function public.set_object_slot_work_status(text,text) to authenticated;
grant execute on function public.review_object_slot_replacement(uuid,text,text) to authenticated;

update public.object_texture_slots set is_active = false
where is_active and site_id = '${siteId.replaceAll("'", "''")}' and source_kind = 'vworld_uv';

insert into public.object_texture_slots
select * from jsonb_populate_recordset(null::public.object_texture_slots, $object_slots$${sqlJson}$object_slots$::jsonb)
on conflict (slot_key) do update set
  site_id=excluded.site_id, object_key=excluded.object_key, slot_alias=excluded.slot_alias, slot_level=excluded.slot_level, is_active=true,
  source_kind=excluded.source_kind, target_asset_id=excluded.target_asset_id, target_surface_id=excluded.target_surface_id,
  surface_width_m=coalesce(excluded.surface_width_m, object_texture_slots.surface_width_m),
  surface_height_m=coalesce(excluded.surface_height_m, object_texture_slots.surface_height_m),
  replacement_canvas_width_px=coalesce(excluded.replacement_canvas_width_px, object_texture_slots.replacement_canvas_width_px),
  replacement_canvas_height_px=coalesce(excluded.replacement_canvas_height_px, object_texture_slots.replacement_canvas_height_px),
  source_feature_key=excluded.source_feature_key, source_image_id=excluded.source_image_id, source_region_signature=excluded.source_region_signature,
  image_sha256=excluded.image_sha256, slot_index=excluded.slot_index, floor=excluded.floor, td_id=excluded.td_id, model_name=excluded.model_name, class_code=excluded.class_code,
  object_label=excluded.object_label, replacement_priority=excluded.replacement_priority, mime_type=excluded.mime_type,
  atlas_width_px=excluded.atlas_width_px, atlas_height_px=excluded.atlas_height_px, crop_width_px=excluded.crop_width_px, crop_height_px=excluded.crop_height_px,
  u_min=excluded.u_min, v_min=excluded.v_min, u_max=excluded.u_max, v_max=excluded.v_max,
  uv_vertex_count=excluded.uv_vertex_count, triangle_count=excluded.triangle_count,
  surface_count=case when jsonb_array_length(excluded.surface_placements) > 0 or jsonb_array_length(object_texture_slots.surface_placements) = 0 then excluded.surface_count else object_texture_slots.surface_count end,
  placement_count=case when jsonb_array_length(excluded.surface_placements) > 0 or jsonb_array_length(object_texture_slots.surface_placements) = 0 then excluded.placement_count else object_texture_slots.placement_count end,
  surface_placements=case when jsonb_array_length(excluded.surface_placements) > 0 then excluded.surface_placements else object_texture_slots.surface_placements end,
  uv_area=excluded.uv_area, uv_fill_ratio=excluded.uv_fill_ratio, surface_area_m2=excluded.surface_area_m2,
  longitude=excluded.longitude, latitude=excluded.latitude, height_m=excluded.height_m, east_m=excluded.east_m, north_m=excluded.north_m, up_m=excluded.up_m,
  camera_heading_deg=excluded.camera_heading_deg, tile=excluded.tile, tile_depth=excluded.tile_depth,
  original_storage_path=excluded.original_storage_path, preview_storage_path=excluded.preview_storage_path,
  ocr_text=excluded.ocr_text, source_observed_at=excluded.source_observed_at;

insert into public.object_slot_work_items(slot_key)
select slot_key from public.object_texture_slots where is_active and site_id = '${siteId.replaceAll("'", "''")}' on conflict (slot_key) do nothing;

do $$ begin
  alter publication supabase_realtime add table public.object_slot_work_items;
exception when duplicate_object then null;
end $$;
do $$ begin
  alter publication supabase_realtime add table public.object_slot_replacement_versions;
exception when duplicate_object then null;
end $$;
`;

fs.writeFileSync(outputMigration, migration);
console.log(JSON.stringify({ objects: groups.size, slots: slots.length, outputJson, outputMigration }, null, 2));
