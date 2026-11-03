import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const slots = JSON.parse(fs.readFileSync("outputs/20260831_vworld_seoul_image_catalog/object-texture-slots.json", "utf8"));
const tileIndex = JSON.parse(fs.readFileSync("tmp/vworld-seoul-full-catalog/tile-index.json", "utf8"));
const tileByName = new Map(tileIndex.map((row) => [row.uri.replace(/^.*\//, "").replace(/\.b3dm$/, ""), row]));
assert.equal(new Set(slots.map((slot) => slot.object_key)).size, 993, "all mapped objects must remain in the catalog");
assert(slots.length > 993, "facade texture atlases must split into independently editable UV surface slots");
assert.equal(new Set(slots.map((slot) => slot.slot_key)).size, slots.length, "slot keys must be unique");
assert.equal(new Set(slots.map((slot) => slot.slot_alias)).size, slots.length, "human-readable slot aliases must be unique");
assert(slots.every((slot) => ["texture_image", "uv_surface"].includes(slot.slot_level)), "every active slot needs a supported granularity");
assert(slots.every((slot) => slot.is_active === true), "generated slots must be active");
assert(slots.every((slot) => slot.crop_width_px > 0 && slot.crop_height_px > 0), "every slot needs a positive crop size");
assert(slots.every((slot) => slot.u_min >= 0 && slot.v_min >= 0 && slot.u_max <= 1 && slot.v_max <= 1), "UV regions must be normalized");
assert(slots.every((slot) => slot.u_max > slot.u_min && slot.v_max > slot.v_min), "UV regions must have area");
assert(slots.filter((slot) => slot.class_code === "WL").every((slot) => Number.isFinite(slot.camera_heading_deg)), "every wall/facade slot needs an extracted camera heading");

const shared = slots.filter((slot) => slot.image_sha256 === "374e5328b26894c0e2c131124bd305a627b44bc6fb4cbae9f9cf75d2fe596aeb");
assert.equal(new Set(shared.map((slot) => slot.object_key)).size, 3, "known shared atlas must remain connected to three independent objects");
assert(new Set(shared.map((slot) => `${slot.object_key}|${slot.u_min}|${slot.v_min}|${slot.u_max}|${slot.v_max}`)).size >= 3, "shared-atlas object regions must remain distinct");

const dingHouse = slots.filter((slot) => slot.model_name === "F02WL011");
assert.equal(dingHouse.length, 2, "two independently photographed F02WL011 facade faces must be separate slots");
assert(dingHouse.every((slot) => slot.slot_level === "uv_surface"), "facade photos must use UV surface granularity");
const largeFacadeAtlas = slots.filter((slot) => slot.model_name === "F02WL072");
assert(largeFacadeAtlas.length >= 40, "F02WL072 storefront atlas must expose its individual facade regions");
assert(largeFacadeAtlas.every((slot) => slot.crop_width_px < slot.atlas_width_px || slot.crop_height_px < slot.atlas_height_px), "F02WL072 slots must be subregions, not the whole atlas");
const nonFacadeFacility = slots.filter((slot) => slot.model_name === "F01FC004");
assert.equal(nonFacadeFacility.length, 1, "non-facade geometry should remain one source-image unit instead of fragmenting into mesh panels");

const horizontalToleranceRadians = 2e-6;
const verticalToleranceMeters = 3;
const coordinateOutliers = slots.filter((slot) => {
  const region = tileByName.get(slot.tile)?.region;
  if (!region || !Number.isFinite(slot.longitude) || !Number.isFinite(slot.latitude) || !Number.isFinite(slot.height_m)) return true;
  const lon = slot.longitude * Math.PI / 180;
  const lat = slot.latitude * Math.PI / 180;
  return lon < region[0] - horizontalToleranceRadians
    || lon > region[2] + horizontalToleranceRadians
    || lat < region[1] - horizontalToleranceRadians
    || lat > region[3] + horizontalToleranceRadians
    || slot.height_m < region[4] - verticalToleranceMeters
    || slot.height_m > region[5] + verticalToleranceMeters;
});
assert.deepEqual(coordinateOutliers.map((slot) => `${slot.model_name}@${slot.tile}`), [], "slot coordinates must remain inside their source tile bounds");

const knownSecondFloorObjects = new Map([
  ["F02WL011", [35, 45]],
  ["F02WL058", [35, 45]],
  ["F02WL021", [35, 45]],
  ["F02WL056", [35, 45]],
]);
for (const [modelName, [minimumHeight, maximumHeight]] of knownSecondFloorObjects) {
  const slot = slots.find((candidate) => candidate.model_name === modelName);
  assert(slot, `${modelName} must exist`);
  assert(slot.height_m >= minimumHeight && slot.height_m <= maximumHeight, `${modelName} height must be on Seoul Station 2F`);
  assert(Number.isFinite(slot.camera_heading_deg), `${modelName} must have an extracted facade heading`);
}

const generatedDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "station-one-object-slots-"));
let rectifiedSlot;
let f02wl015RectifiedSlot;
let repeatedSurfaceSlot;
let exactF02wl072s32;
let calibratedFacadeSlots;
let regeneratedSlots = [];
let regeneratedMigration = "";
try {
  const generatedJson = path.join(generatedDirectory, "object-texture-slots.json");
  const generatedMigration = path.join(generatedDirectory, "object-texture-slots.sql");
  execFileSync(process.execPath, [
    "tools/build_object_texture_slots.mjs",
    "outputs/20260831_vworld_seoul_image_catalog",
    generatedJson,
    generatedMigration,
  ], { stdio: "pipe" });
  regeneratedSlots = JSON.parse(fs.readFileSync(generatedJson, "utf8"));
  regeneratedMigration = fs.readFileSync(generatedMigration, "utf8");
  rectifiedSlot = regeneratedSlots.find((slot) => slot.slot_key === "1b1791647b8a6ff59f6c5bbaddea2104ce71be098dfed8d97221b01a13eafd0e");
  f02wl015RectifiedSlot = regeneratedSlots.find((slot) => slot.slot_key === "2d02316d8183557e64f69a57063dd4d966342a6febb043c4102a70525bb2c7d5");
  repeatedSurfaceSlot = regeneratedSlots.find((slot) => slot.slot_key === "f01787e8cb1eaac8d79c4c1a58190af819fee12d7fd19928664c73cf7a1a6bd6");
  exactF02wl072s32 = regeneratedSlots.find((slot) => slot.slot_key === "40b474282ea960465a740aa908c1d1df083ada3a8275a67812fae0dccc3b3fe2");
  calibratedFacadeSlots = new Map(regeneratedSlots
    .filter((slot) => [
      "F02WL023-S01", "F02WL076-S01", "F02WL072-S25", "F02WL072-S26",
      "F02WL072-S34", "F02WL072-S35", "F02WL072-S37",
    ].includes(slot.slot_alias))
    .map((slot) => [slot.slot_alias, slot]));
} finally {
  fs.rmSync(generatedDirectory, { recursive: true, force: true });
}
assert(rectifiedSlot, "F02FC092-S01 calibrated slot must survive a clean regeneration");
assert.equal(regeneratedSlots.length, slots.length, "surface calibration must not change the global slot count");
assert.deepEqual(regeneratedSlots.map((slot) => slot.slot_key).sort(), slots.map((slot) => slot.slot_key).sort(), "surface calibration must not change the global slot key set");
assert.deepEqual([rectifiedSlot.crop_width_px, rectifiedSlot.crop_height_px], [256, 256], "F02FC092 source UV crop must remain immutable");
assert.deepEqual([rectifiedSlot.replacement_canvas_width_px, rectifiedSlot.replacement_canvas_height_px], [870, 256], "F02FC092 replacement canvas must use the physical facade aspect");
assert.equal(rectifiedSlot.surface_width_m, 1.22925696, "F02FC092 exact physical width must survive regeneration");
assert.equal(rectifiedSlot.surface_height_m, 0.36170862, "F02FC092 exact physical height must survive regeneration");
assert(f02wl015RectifiedSlot, "F02WL015-S01 calibrated slot must survive a clean regeneration");
assert.equal(f02wl015RectifiedSlot.slot_alias, "F02WL015-S01", "F02WL015 calibration must remain attached to S01");
assert.deepEqual(
  [f02wl015RectifiedSlot.crop_width_px, f02wl015RectifiedSlot.crop_height_px],
  [512, 512],
  "F02WL015 source UV crop must remain immutable",
);
assert.deepEqual(
  [f02wl015RectifiedSlot.replacement_canvas_width_px, f02wl015RectifiedSlot.replacement_canvas_height_px],
  [820, 512],
  "F02WL015 replacement canvas must use the physical facade aspect",
);
assert.equal(f02wl015RectifiedSlot.surface_width_m, 5.88603119, "F02WL015 exact physical width must survive regeneration");
assert.equal(f02wl015RectifiedSlot.surface_height_m, 3.67514453, "F02WL015 exact physical height must survive regeneration");
const expectedFacadeCalibrations = [
  ["F02WL023-S01", 1764, 510, 13.23843887, 3.82843188],
  ["F02WL076-S01", 2006, 255, 10.60067322, 1.3472132],
  ["F02WL072-S25", 441, 512, 3.16073886, 3.67189244],
  ["F02WL072-S26", 1934, 512, 13.8722784, 3.67189072],
  ["F02WL072-S34", 1183, 512, 8.84533226, 3.8281269],
  ["F02WL072-S35", 214, 512, 1.53532017, 3.67991276],
  ["F02WL072-S37", 490, 512, 3.51966955, 3.67991823],
];
assert.equal(calibratedFacadeSlots.size, expectedFacadeCalibrations.length, "all audited facade calibrations must survive regeneration");
for (const [alias, canvasWidth, canvasHeight, surfaceWidth, surfaceHeight] of expectedFacadeCalibrations) {
  const slot = calibratedFacadeSlots.get(alias);
  assert(slot, `${alias} calibrated slot is missing`);
  assert.deepEqual(
    [slot.replacement_canvas_width_px, slot.replacement_canvas_height_px],
    [canvasWidth, canvasHeight],
    `${alias} replacement canvas must match its physical facade aspect`,
  );
  assert.deepEqual(
    [slot.surface_width_m, slot.surface_height_m],
    [surfaceWidth, surfaceHeight],
    `${alias} exact physical dimensions must survive regeneration`,
  );
}
const f02wl023 = calibratedFacadeSlots.get("F02WL023-S01");
assert.equal(f02wl023.surface_placements.length, 1, "F02WL023 must preserve its corrected facade center");
assert.deepEqual(
  [f02wl023.longitude, f02wl023.latitude, f02wl023.height_m, f02wl023.east_m, f02wl023.north_m, f02wl023.up_m, f02wl023.camera_heading_deg],
  [
    f02wl023.surface_placements[0].longitude,
    f02wl023.surface_placements[0].latitude,
    f02wl023.surface_placements[0].height_m,
    f02wl023.surface_placements[0].east_m,
    f02wl023.surface_placements[0].north_m,
    f02wl023.surface_placements[0].up_m,
    f02wl023.surface_placements[0].camera_heading_deg,
  ],
  "F02WL023 top-level map metadata must use the primary corrected placement",
);
assert(Math.hypot(
  f02wl023.surface_placements[0].east_m - (-68.93972573),
  f02wl023.surface_placements[0].north_m - 70.51467287,
) < 1e-8, "F02WL023 placement must not regress to the triangle-density-biased centroid");
const f02wl076 = calibratedFacadeSlots.get("F02WL076-S01");
assert.equal(f02wl076.surface_placements[0].render_kind, "coplanar_polygon", "F02WL076 must use its inclined four-corner plane");
assert.deepEqual(f02wl076.surface_placements[0].corners_wgs84, [
  [126.9715541819266, 37.554079058358035, 39.70628804],
  [126.97155714319126, 37.5540751163405, 38.45628149],
  [126.97145277314063, 37.55402778587916, 38.45632269],
  [126.97145014902237, 37.55403172599876, 39.70635074],
], "F02WL076 must retain its exact inclined quad");
assert.deepEqual(f02wl076.surface_placements[0].texture_coordinates, [[1, 1], [1, 0], [0, 0], [0, 1]], "F02WL076 must keep the Travel Center wordmark readable");
assert(exactF02wl072s32, "F02WL072-S32 exact surface must survive a clean regeneration");
assert.equal(exactF02wl072s32.slot_alias, "F02WL072-S32", "the exact inclined sign fixture must remain attached to S32");
assert.deepEqual([exactF02wl072s32.crop_width_px, exactF02wl072s32.crop_height_px], [340, 29], "S32 source image dimensions must remain unchanged");
assert.deepEqual([exactF02wl072s32.surface_width_m, exactF02wl072s32.surface_height_m], [23.1649939, 1.76935595], "S32 exact physical dimensions must survive regeneration");
assert.equal(exactF02wl072s32.surface_placements.length, 1, "S32 must have one exact facade placement");
assert.equal(exactF02wl072s32.surface_placements[0].render_kind, "coplanar_polygon", "S32 must not regress to a vertical wall approximation");
assert.deepEqual(exactF02wl072s32.surface_placements[0].faces, [238, 239], "S32 must remain bound only to its own two mesh faces");
assert.deepEqual(
  [exactF02wl072s32.longitude, exactF02wl072s32.latitude, exactF02wl072s32.height_m],
  [126.970120077936, 37.553951334264, 40.619431],
  "S32 map focus must use the center of the exact four-corner quad",
);
assert.deepEqual(exactF02wl072s32.surface_placements[0].corners_wgs84, [
  [126.970243342935, 37.553915946792, 39.750717],
  [126.969995437996, 37.553983448021, 39.760842],
  [126.969996693203, 37.553986827304, 41.483221],
  [126.970244837611, 37.553919114939, 41.482944],
], "S32 must preserve the decoded inclined sign perimeter");
assert.deepEqual(exactF02wl072s32.surface_placements[0].texture_coordinates, [[0, 1], [1, 1], [1, 0], [0, 0]], "S32 image must remain readable and unmirrored on its bottom-first quad");
const f02wl072s26 = calibratedFacadeSlots.get("F02WL072-S26");
assert.deepEqual(
  f02wl072s26.surface_placements[0].legacy_replacement_crop,
  { source_width_px: 340, source_height_px: 86, left_px: 0, top_px: 0, width_px: 340, height_px: 67 },
  "S26 must remove the accidental 19-row blank band from its legacy approval",
);
assert(repeatedSurfaceSlot, "F02WL072-S22 repeated-surface slot must survive a clean regeneration");
assert.equal(repeatedSurfaceSlot.slot_alias, "F02WL072-S22", "the repeated-surface fixture must remain attached to S22");
assert.equal(repeatedSurfaceSlot.surface_count, 2, "S22 must keep its two disconnected physical surfaces");
assert.equal(repeatedSurfaceSlot.placement_count, 2, "S22 must render at both physical placements");
assert.deepEqual(
  [repeatedSurfaceSlot.surface_width_m, repeatedSurfaceSlot.surface_height_m],
  [1.5026416, 2.813382],
  "S22 must use one physical face's dimensions rather than dimensions derived from the summed area",
);
assert.equal(repeatedSurfaceSlot.surface_placements.length, 2, "S22 must keep two explicit placement records");
assert.equal(repeatedSurfaceSlot.surface_placements.filter((placement) => placement.is_primary).length, 1, "S22 must have one primary map-focus placement");
assert.deepEqual(
  repeatedSurfaceSlot.surface_placements.map((placement) => placement.camera_heading_deg),
  [174.969833, 354.970071],
  "S22 opposite faces must retain their independent headings",
);
assert(
  Math.hypot(
    repeatedSurfaceSlot.surface_placements[0].east_m - repeatedSurfaceSlot.surface_placements[1].east_m,
    repeatedSurfaceSlot.surface_placements[0].north_m - repeatedSurfaceSlot.surface_placements[1].north_m,
  ) > 3.9,
  "S22 placements must remain physically separated instead of collapsing to their centroid",
);
assert(regeneratedMigration.includes("surface_placements jsonb not null default '[]'::jsonb"), "generated schema must persist surface placements");
assert(regeneratedMigration.includes("object_texture_slots_surface_placements_array_check"), "generated schema must constrain surface placements to a JSON array");

console.log(JSON.stringify({ passed: true, objects: new Set(slots.map((slot) => slot.object_key)).size, slots: slots.length, sharedAtlasSlots: shared.length, coordinateOutliers: coordinateOutliers.length, rectifiedReplacementCanvas: "870x256", f02wl015ReplacementCanvas: "820x512", auditedFacadeCalibrations: calibratedFacadeSlots.size, repeatedSurfacePlacements: repeatedSurfaceSlot.surface_placements.length }));
