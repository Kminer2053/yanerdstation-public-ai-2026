import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const required = [
  "dist/client/index.html",
  "dist/client/catalog/index.html",
  "dist/client/app/index.html",
  "dist/server/index.js",
  "dist/client/data/station-one/csv/stores.csv",
  "dist/client/data/station-one/csv/zones.csv",
  "dist/client/data/station-one/json/realtime_snapshot.json",
];

for (const relativePath of required) {
  const stat = await fs.stat(path.join(root, relativePath));
  assert(stat.isFile(), `${relativePath} must be a file`);
  assert(stat.size > 0, `${relativePath} must not be empty`);
}

const files = await walk(path.join(root, "dist", "client"));
const catalogBundle = files.find((file) => /[/\\]catalog-[\w-]+\.js$/.test(file));
assert(catalogBundle, "catalog collaboration JavaScript bundle is missing");
const source = await fs.readFile(catalogBundle, "utf8");
const javascriptSource = (await Promise.all(
  files.filter((file) => file.endsWith(".js")).map((file) => fs.readFile(file, "utf8")),
)).join("\n");
assert(javascriptSource.includes("iogvmysclkzchurpffzb.supabase.co"), "Supabase project URL was not embedded in the build");
assert(javascriptSource.includes("vworld-catalog-replacements"), "replacement Storage integration is missing");
assert(javascriptSource.includes("signInAnonymously"), "anonymous public editing session is missing");
assert(javascriptSource.includes("object_texture_slots"), "object texture slot catalog integration is missing");
assert(source.includes("station-one:catalog-focus"), "persistent map focus messaging is missing");
const catalogHtml = await fs.readFile(path.join(root, "dist/client/catalog/index.html"), "utf8");
assert(!catalogHtml.includes("처음 사용자 등록"), "login registration UI must not remain in public-edit mode");
assert(catalogHtml.includes("PUBLIC COLLABORATION"), "public collaboration loading state is missing");
assert(catalogHtml.includes('id="stationMap"'), "persistent VWorld map iframe is missing");
assert(catalogHtml.includes('value="S201801"'), "Daejeon Station selector option is missing");
assert(catalogHtml.includes('id="management-target"'), "management-target catalog filter is missing");
const viewerHtml = await fs.readFile(path.join(root, "dist/client/app/index.html"), "utf8");
assert(viewerHtml.includes('id="station-switcher"'), "viewer station selector is missing");
assert(viewerHtml.includes('id="catalog-launch"'), "viewer catalog launch action is missing");

const catalogSource = await fs.readFile(path.join(root, "src/catalog-workbench.js"), "utf8");
const appSource = await fs.readFile(path.join(root, "app/app.js"), "utf8");
const supabaseSource = await fs.readFile(path.join(root, "src/supabase-client.js"), "utf8");
const restoreMigration = await fs.readFile(path.join(root, "supabase/migrations/202609070001_object_slot_original_restore.sql"), "utf8");
const informationZoneMigration = await fs.readFile(path.join(root, "supabase/migrations/202609110008_seoul_information_zone.sql"), "utf8");
const correctedInformationZoneMigration = await fs.readFile(path.join(root, "supabase/migrations/202609110009_correct_stair_front_information_zone.sql"), "utf8");
const rectifiedCanvasMigration = await fs.readFile(path.join(root, "supabase/migrations/202609100002_rectified_replacement_canvas.sql"), "utf8");
const f02wl015RectifiedCanvasMigration = await fs.readFile(path.join(root, "supabase/migrations/202609110002_f02wl015_rectified_replacement_canvas.sql"), "utf8");
const surfacePlacementsMigration = await fs.readFile(path.join(root, "supabase/migrations/202609100003_object_surface_placements.sql"), "utf8");
const f02wl072FrameMigration = await fs.readFile(path.join(root, "supabase/migrations/202609110001_f02wl072_upper_sign_frame.sql"), "utf8");
const facadeSurfaceMigration = await fs.readFile(path.join(root, "supabase/migrations/202609110003_facade_surface_rectification.sql"), "utf8");
const f02wl072S32SurfaceMigration = await fs.readFile(path.join(root, "supabase/migrations/202609110004_f02wl072_s32_exact_surface.sql"), "utf8");
const f02wl072S32OrientationMigration = await fs.readFile(path.join(root, "supabase/migrations/202609110005_f02wl072_s32_texture_orientation.sql"), "utf8");
const facadeOrientationMigration = await fs.readFile(path.join(root, "supabase/migrations/202609110006_facade_texture_orientation.sql"), "utf8");
const f02wl072S32HorizontalOrientationMigration = await fs.readFile(path.join(root, "supabase/migrations/202609110007_f02wl072_s32_horizontal_orientation.sql"), "utf8");
const f02wl072FrameSource = await fs.readFile(path.join(root, "app/f02wl072-frame.js"), "utf8");
const informationZoneSource = await fs.readFile(path.join(root, "app/seoul-information-zone.js"), "utf8");
const truedanSource = await fs.readFile(path.join(root, "app/seoul-truedan.js"), "utf8");
const seoulRetirementSource = await fs.readFile(path.join(root, "app/seoul-vworld-retirement.js"), "utf8");
const approvedSurfaceSource = await fs.readFile(path.join(root, "app/approved-replacement-surface.js"), "utf8");
const replacementSurfaceContract = await fs.readFile(path.join(root, "src/replacement-surface-contract.js"), "utf8");
const slotGenerator = await fs.readFile(path.join(root, "tools/build_object_texture_slots.mjs"), "utf8");
const surfaceCalibrations = JSON.parse(await fs.readFile(path.join(root, "tools/vworld-surface-calibrations.json"), "utf8"));
const surfacePlacements = JSON.parse(await fs.readFile(path.join(root, "tools/vworld-surface-placements.json"), "utf8"));
assert(!catalogSource.includes("if (!mapReady) return"), "map focus must not be blocked when the iframe load event was missed");
assert(catalogSource.includes("station-one:catalog-focus-applied"), "catalog must handle the map focus acknowledgement");
assert(catalogSource.includes('class="atlas-image-frame"'), "atlas UV highlight must be positioned against the rendered atlas image");
assert(catalogSource.includes("preferredSurfacePlacement(slot)"), "catalog focus must prefer a real surface placement over an aggregate centroid");
assert(catalogSource.includes("surfaceArea: Number(focusTarget.surface_width_m) * Number(focusTarget.surface_height_m)"), "catalog focus must use one placement's dimensions for adaptive camera distance");
assert(catalogSource.includes("targetAssetId: slot.target_asset_id"), "catalog focus must identify app-rendered assets");
assert(appSource.includes("station-one:catalog-map-ready"), "embedded map must announce readiness");
assert(appSource.includes("station-one:catalog-focus-applied"), "embedded map must acknowledge a received focus request");
assert(appSource.includes("catalogFocusCameraOffset"), "catalog focus camera offset is missing");
assert(appSource.includes("CATALOG_FOCUS?.cameraHeading"), "catalog focus camera must use the selected object's extracted facade heading");
assert(appSource.includes("catalogSurfaceNormalToViewHeading"), "catalog focus must convert the selected surface normal into a front-facing camera view");
assert(/surfaceNormalHeading\s*\+\s*180/.test(appSource), "catalog focus must look back toward the selected surface from its front side");
assert(appSource.includes("catalogFacadeCameraRange"), "facade focus must use an adaptive in-corridor camera distance");
assert(appSource.includes("catalogFocusCoordinates"), "catalog focus coordinates must remain observable for deployed QA");
assert(appSource.includes("catalogFocusHeading"), "catalog focus heading must remain observable for deployed QA");
assert(appSource.includes("STATION_ONE_APPROVED_IMAGE_OVERLAYS"), "approved replacement image overlay data source is missing");
assert(appSource.includes("loadToolkitOverlays"), "viewer must load approved replacement images from the public editor");
assert(!appSource.includes("supabase-client"), "the map viewer no longer depends on the retired Supabase workbench");
assert(appSource.includes("toolkit.yanerdstation.kr") && appSource.includes("/api/public/station?key="), "viewer must read the editor's public station overlays");
assert(appSource.includes("approvedOverlayDimensions"), "approved replacement images must use slot surface dimensions");
assert(appSource.includes("replacement_canvas_width_px"), "overlay fallback must use the rectified replacement aspect");
assert(appSource.includes("camera_heading_deg"), "approved replacement images must use the extracted surface heading");
assert(appSource.includes("APPROVED_REPLACEMENT_MASK_OFFSET_METERS"), "approved replacement images must have an opaque backing mask");
assert(appSource.includes("approved-replacement-mask:"), "each approved replacement must occlude the original VWorld facade");
assert(appSource.includes("approvedOverlayPlacements(slot)"), "approved replacements must resolve disconnected physical surface placements");
assert(appSource.includes("placements.forEach((placement, placementIndex)"), "approved replacements must render every physical placement");
assert(appSource.includes("surfacePlacementCount: placements.length"), "approved replacement entities must expose their placement count for QA");
assert(appSource.includes("createCoplanarReplacementPrimitives"), "inclined approved surfaces must use exact four-corner geometry");
assert(appSource.includes("prepareApprovedReplacementRenderImage"), "legacy replacement content corrections must be prepared before rendering");
assert(appSource.includes("approvedLegacyCropCount"), "legacy replacement corrections must remain observable for QA");
assert(appSource.includes('approvedReplacementMode = "replacement-only"'), "replacement-only rendering mode must remain observable for deployed QA");
assert(appSource.includes('S201801: Object.freeze'), "Daejeon Station VWorld configuration is missing");
assert(/createSeoulInformationZone\([\s\S]{0,180}maskManagedExternally: true/.test(appSource), "current Seoul information-zone renderer must use the shared mask");
assert(/createSeoulTruedan\([\s\S]{0,180}maskManagedExternally: true/.test(appSource), "TRUEDAN must remain attached without replacing the shared shader");
assert(appSource.includes("createSeoulVworldRetirementMask"), "one shared Seoul VWorld retirement mask must be attached");
assert(appSource.includes("vworld.informationZone?.setReplacements(informationFacilityReplacements)"), "approved facility images must route to the information-zone renderer");
assert(appSource.includes('vworld.renovation?.setFacadeImage(truedanFacade?.image_url || "")'), "TRUEDAN approved facade must remain routed to its renderer");
assert(!appSource.includes("isRetiredInformationZoneReplacement"), "TRUEDAN must not be filtered as a retired information-zone replacement");
assert(appSource.includes("isInformationFacilityReplacement(replacement)) continue"), "renderer-owned facility images must not also create generic VWorld overlays");
assert(appSource.includes("informationFacilityApprovedCount"), "facility approved/default state must remain observable for deployed QA");
assert(informationZoneSource.includes("positions: [left, right]"), "facility images must preserve ordinary left-to-right orientation");
assert(informationZoneSource.includes("request !== record.request"), "stale facility image loads must not overwrite the latest state");
assert(informationZoneSource.includes('targetModel: "F02WL054"'), "information facilities must target the stair-front F02WL054 shop");
assert(informationZoneSource.includes('referenceFacadeSlot: "F02WL072-S04"'), "the user-confirmed target must be S04");
assert(informationZoneSource.includes('referenceLogoSlot: "F02WL072-S03"'), "the target upper panel must be S03");
assert(informationZoneSource.includes("width: 7.986622404493558"), "the stair-front width must match the decoded S04 facade");
for (const bound of ["xMin: -8.04", "xMax: 0.02", "yMin: -3.89", "yMax: 0.02", "zMin: 9.025", "zMax: 12.20"]) {
  assert(informationZoneSource.includes(bound), `the tight stair-front retirement prism is missing ${bound}`);
}
assert(truedanSource.includes("maskManagedExternally"), "TRUEDAN must support the shared tileset mask");
assert(seoulRetirementSource.includes("u_truedanCurrentEnabled") && seoulRetirementSource.includes("u_informationZoneCurrentEnabled"), "shared mask must preserve both independent current-state groups");
assert.equal((seoulRetirementSource.match(/tileset\.customShader = shader/g) || []).length, 1, "shared mask module must have one tileset shader owner");
assert(appSource.includes("createF02wl072UpperFrame(Cesium, viewer, VWORLD_CONFIG.siteId)"), "F02WL072 upper frame renderer must be attached to the scene");
assert(appSource.includes("isF02wl072FrameReplacement(replacement)) continue"), "F02WL072 frame must not create a generic rectangular wall");
assert(appSource.includes("f02wl072Frame?.setReplacement"), "approved frame colour must route to the dedicated mesh renderer");
assert(appSource.includes("isF02wl072FrameCatalogFocus()"), "F02WL072 frame needs a dedicated top-view focus camera");
assert(f02wl072FrameSource.includes("Cesium.CoplanarPolygonGeometry"), "F02WL072 frame must preserve its six non-wall panels");
assert(f02wl072FrameSource.includes("F02WL072_FRAME.surfaces.map"), "one approved colour must render on every exact frame panel");
assert(approvedSurfaceSource.includes("Cesium.CoplanarPolygonGeometry"), "inclined replacement surfaces must use arbitrary coplanar geometry");
assert(approvedSurfaceSource.includes("textureCoordinates"), "inclined replacement surfaces must preserve explicit image orientation");
assert(replacementSurfaceContract.includes("matchingLegacyReplacementCrop"), "legacy blank-band corrections need a dimension-guarded contract");
const informationFocusBranch = appSource.indexOf("const informationFacility = catalogFocusedInformationFacility()");
const genericFocusPosition = appSource.indexOf("const center = catalogFocusPosition(Cesium)", informationFocusBranch);
assert(informationFocusBranch >= 0 && genericFocusPosition > informationFocusBranch, "facility focus must run before generic VWorld coordinate focus");
assert(appSource.slice(informationFocusBranch, genericFocusPosition).includes("vworld.informationZone.focusAsset(informationFacility.id, duration)"), "facility location action must use its renderer-owned target");
assert(/focusAsset\(informationFacility\.id, duration\);[\s\S]{0,220}return;/.test(appSource.slice(informationFocusBranch, genericFocusPosition)), "facility focus must return before the generic camera overwrites it");
assert(appSource.slice(informationFocusBranch, genericFocusPosition).includes("state.layers.renovation = true"), "facility location action must reveal the current-information layer");
assert(appSource.slice(informationFocusBranch, genericFocusPosition).includes("vworld.informationZone.setVisible(true)"), "information zone must be visible before its camera focus runs");
assert(appSource.includes("function catalogFocusNumber(value)"), "catalog focus must reject absent coordinates instead of coercing null to zero");
assert(supabaseSource.includes("source_kind,target_asset_id,target_surface_id,surface_width_m,surface_height_m"), "approved replacements must load renderer target metadata");
assert(supabaseSource.includes("replacement_canvas_width_px,replacement_canvas_height_px"), "approved replacements must load their rectified canvas metadata");
assert(supabaseSource.includes('.eq("slot.is_active", true)'), "inactive historical app-asset slots must not render approved overlays");
assert(/table: "object_texture_slots"/.test(supabaseSource.slice(supabaseSource.indexOf("function subscribeObjectWorkbench"))), "catalog must subscribe to slot insert/update/deactivation events");
assert(catalogSource.includes("loadObjectWorkbench(currentSiteId)"), "catalog data must load by selected station");
assert(catalogSource.includes("async function reloadWorkbenchDataset()"), "catalog must reload slot metadata without a page refresh");
assert(catalogSource.includes("toggle-management"), "per-slot management target control is missing");
assert(catalogSource.includes('class="slot-review-panel"'), "review-pending card actions are missing");
assert(catalogSource.includes('class="review-decision"'), "prominent replacement review decision panel is missing");
assert(catalogSource.includes("signedReplacement(latest.storage_path)"), "original/replacement comparison preview is missing");
assert(catalogSource.includes("catalogPreviewMarkup(slot)"), "catalog cards must render the active approved replacement image");
assert(catalogSource.includes("loadApprovedObjectSlotOverlays(currentSiteId)"), "catalog must load the same approved replacement set as the VWorld viewer");
assert(catalogSource.includes("collaboration.approved"), "catalog must keep approved replacements separate from the latest review attempt");
assert(catalogSource.includes("승인 확정"), "explicit approval action is missing");
assert(catalogSource.includes("인포메이션 부스 기본 화면"), "information-booth baseline copy is missing");
assert(catalogSource.includes("열차행선안내 디스플레이 화면을 교체·검수합니다"), "train-display guidance is missing");
assert(catalogSource.includes("좌측 첫 번째 세로 안내게시판"), "guide-board management guidance is missing");
assert(catalogSource.includes("인포메이션 TV 화면을 교체·검수합니다"), "information-TV guidance is missing");
assert(catalogSource.includes("TRUEDAN 전체 파사드"), "TRUEDAN facade management guidance must remain visible");
assert(catalogSource.includes("상단 간판의 위·좌·우 프레임 6개 면"), "upper frame colour-slot guidance is missing");
assert(catalogSource.includes("단색 컬러 샘플을 등록하세요"), "colour slots must explain their square swatch contract");
assert(catalogSource.includes("replacementCanvasDimensions"), "catalog must keep source UV and replacement canvas dimensions separate");
assert(catalogSource.includes("replacementMatchesCanvas"), "legacy pending replacements must not bypass the current canvas contract");
assert(catalogSource.includes("새 규격 재등록 필요"), "legacy pending replacements need a clear re-registration path");
assert(catalogSource.includes("기존 이미지 자동 보정"), "active legacy replacements must explain their automatic physical-aspect correction");
assert(catalogSource.includes("원본 UV 크롭"), "catalog must label the immutable source UV dimensions");
assert(catalogSource.includes("download-raw-crop"), "catalog must preserve a separate raw UV crop download");
assert(catalogSource.includes('data-action="restore-original"'), "approved replacement restore action is missing");
assert(javascriptSource.includes("restore_object_slot_original"), "original restore RPC integration is missing");
assert(restoreMigration.includes("where is_active"), "restore migration must track exactly one active approved replacement");
assert(restoreMigration.includes("deactivation_note"), "restore migration must preserve deactivation audit history");
assert(informationZoneMigration.includes("7afba516acfae10344297172e7c5c80368d4d3d43b140a71a14ccedc208852bc")
  && informationZoneMigration.includes("is_active = false"), "historical mistaken retirement migration must remain reproducible");
assert(correctedInformationZoneMigration.includes("set is_active = true")
  && correctedInformationZoneMigration.includes("SEOUL-2F-TRUEDAN"), "corrective migration must reactivate TRUEDAN");
assert(correctedInformationZoneMigration.includes("F02WL054")
  && correctedInformationZoneMigration.includes("F02WL072-S04"), "corrective migration must identify the user-confirmed S04 shell and facade");
for (const [alias, width, height] of [
  ["INFO-BOOTH-01-S01", 830, 1000],
  ["TIDS-01-S01", 960, 323],
  ["INFO-GUIDE-01-S01", 400, 900],
  ["INFO-GUIDE-02-S01", 400, 900],
  ["INFO-TV-01-S01", 1280, 720],
]) {
  assert(informationZoneMigration.includes(`"slot_alias": "${alias}"`), `${alias} app-asset slot is missing`);
  assert(informationZoneMigration.includes(`${width}`) && informationZoneMigration.includes(`${height}`), `${alias} replacement canvas contract is missing`);
}
assert(rectifiedCanvasMigration.includes("replacement_canvas_width_px = 870"), "F02FC092 rectified replacement canvas is missing");
assert(rectifiedCanvasMigration.includes("surface_width_m = 1.22925696"), "F02FC092 exact physical width is missing");
assert(rectifiedCanvasMigration.includes("surface_height_m = 0.36170862"), "F02FC092 exact physical height is missing");
assert(rectifiedCanvasMigration.includes("coalesce(expected.replacement_canvas_width_px, expected.crop_width_px)"), "replacement validation must prefer the rectified canvas contract");
assert(rectifiedCanvasMigration.includes("if tg_op = 'UPDATE'"), "legacy replacements must remain reviewable and restorable after calibration");
assert(rectifiedCanvasMigration.includes("to_jsonb(old)->>'is_active'"), "legacy dimension bypass must require an actual deactivation");
assert(rectifiedCanvasMigration.includes("<> 'approved'"), "legacy dimension bypass must not permit activation by approval");
assert(f02wl015RectifiedCanvasMigration.includes("'F02WL015-S01'"), "F02WL015 rectified facade target is missing");
assert(f02wl015RectifiedCanvasMigration.includes("replacement_canvas_width_px = 820"), "F02WL015 rectified replacement width is missing");
assert(f02wl015RectifiedCanvasMigration.includes("replacement_canvas_height_px = 512"), "F02WL015 rectified replacement height is missing");
assert(f02wl015RectifiedCanvasMigration.includes("surface_width_m = 5.88603119"), "F02WL015 exact physical width is missing");
assert(f02wl015RectifiedCanvasMigration.includes("surface_height_m = 3.67514453"), "F02WL015 exact physical height is missing");
for (const [alias, width, height] of [
  ["F02WL023-S01", 1764, 510],
  ["F02WL076-S01", 2006, 255],
  ["F02WL072-S25", 441, 512],
  ["F02WL072-S26", 1934, 512],
  ["F02WL072-S34", 1183, 512],
  ["F02WL072-S35", 214, 512],
  ["F02WL072-S37", 490, 512],
]) {
  assert(facadeSurfaceMigration.includes(`\"slot_alias\":\"${alias}\"`), `${alias} migration calibration is missing`);
  assert(surfaceCalibrations.calibrations.some((row) => row.slot_key && row.replacement_canvas_width_px === width
    && row.replacement_canvas_height_px === height
    && facadeSurfaceMigration.includes(`\"slot_key\":\"${row.slot_key}\"`)), `${alias} calibration fixture is missing`);
}
assert(facadeSurfaceMigration.includes('"render_kind":"coplanar_polygon"'), "F02WL076 inclined placement migration is missing");
assert(facadeSurfaceMigration.includes('"height_px":67'), "S26 legacy blank-band crop migration is missing");
assert(f02wl072S32SurfaceMigration.includes("'F02WL072-S32'"), "S32 exact-surface migration is missing");
assert(f02wl072S32SurfaceMigration.includes('"faces":[238,239]'), "S32 migration must target only its two decoded faces");
assert(f02wl072S32SurfaceMigration.includes('"render_kind":"coplanar_polygon"'), "S32 must render on its exact inclined quad");
assert(f02wl072S32SurfaceMigration.includes('"texture_coordinates":[[0,1],[1,1],[1,0],[0,0]]'), "S32 initial exact-surface migration must remain reproducible before its orientation follow-up");
assert(f02wl072S32OrientationMigration.includes("'[[0,0],[1,0],[1,1],[0,1]]'::jsonb"), "S32 intermediate orientation migration must remain reproducible");
assert(f02wl072S32OrientationMigration.includes("surface_placements #> '{0,texture_coordinates}' = '[[0,1],[1,1],[1,0],[0,0]]'::jsonb"), "S32 orientation follow-up must guard the exact preceding UV state");
assert(facadeOrientationMigration.includes("'[[1,1],[0,1],[0,0],[1,0]]'::jsonb"), "S32 intermediate two-axis orientation correction must remain reproducible");
assert(facadeOrientationMigration.includes("'[[1,1],[1,0],[0,0],[0,1]]'::jsonb"), "F02WL076 horizontal orientation correction is missing");
assert(facadeOrientationMigration.includes("surface_placements #> '{0,corners_wgs84}' = '[[126.970243342935"), "S32 orientation correction must guard its exact quad");
assert(facadeOrientationMigration.includes("surface_placements #> '{0,corners_wgs84}' = '[[126.9715541819266"), "F02WL076 orientation correction must guard its exact quad");
assert(facadeOrientationMigration.includes("replacement_canvas_width_px = 2006"), "F02WL076 orientation correction must guard its rectified canvas contract");
assert(f02wl072S32HorizontalOrientationMigration.includes("'[[0,1],[1,1],[1,0],[0,0]]'::jsonb"), "S32 final horizontal mirror correction is missing");
assert(f02wl072S32HorizontalOrientationMigration.includes("surface_placements #> '{0,texture_coordinates}' = '[[1,1],[0,1],[0,0],[1,0]]'::jsonb"), "S32 horizontal correction must guard the exact 006 UV state");
assert(f02wl072S32HorizontalOrientationMigration.includes("surface_placements #> '{0,corners_wgs84}' = '[[126.970243342935"), "S32 horizontal correction must guard its exact quad");
assert.equal((f02wl072S32HorizontalOrientationMigration.match(/update public\.object_texture_slots/g) || []).length, 1, "S32 horizontal correction must update exactly one slot statement");
assert(f02wl072S32HorizontalOrientationMigration.includes("40b474282ea960465a740aa908c1d1df083ada3a8275a67812fae0dccc3b3fe2"), "S32 horizontal correction must target its stable slot key");
assert(!f02wl072S32HorizontalOrientationMigration.includes("F02WL076-S01"), "S32 horizontal correction must not touch the Travel Center slot");
assert(f02wl072S32HorizontalOrientationMigration.includes("surface_placements #> '{0,faces}' = '[238,239]'::jsonb"), "S32 horizontal correction must guard its exact faces");
assert(f02wl072S32HorizontalOrientationMigration.includes("surface_placements #> '{0,normal_enu}' = '[0.31619758,0.92365093,-0.21653649]'::jsonb"), "S32 horizontal correction must guard its exact normal");
assert(f02wl072S32HorizontalOrientationMigration.includes("and surface_width_m = 23.1649939")
  && f02wl072S32HorizontalOrientationMigration.includes("and surface_height_m = 1.76935595")
  && f02wl072S32HorizontalOrientationMigration.includes("and surface_count = 1")
  && f02wl072S32HorizontalOrientationMigration.includes("and placement_count = 1"),
"S32 horizontal correction must guard its physical dimensions and counts");
assert(!f02wl072S32SurfaceMigration.includes("object_slot_replacement_versions")
  && !f02wl072S32OrientationMigration.includes("object_slot_replacement_versions")
  && !facadeOrientationMigration.includes("object_slot_replacement_versions")
  && !f02wl072S32HorizontalOrientationMigration.includes("object_slot_replacement_versions"),
  "S32 geometry corrections must not mutate the user's approved replacement history");
assert(surfacePlacementsMigration.includes("F02WL072-S22"), "S22 placement migration is missing");
assert(surfacePlacementsMigration.includes("surface_placements = jsonb_build_array"), "S22 migration must persist every physical surface placement");
assert(surfacePlacementsMigration.includes("placement_count = 2"), "S22 migration must record two physical placements");
assert(f02wl072FrameMigration.includes("'45021744d021f0f515143bb63e962060f8a91ed1287c05f13aeb128f9a3ea1cb'"), "stable F02WL072 frame slot is missing");
assert(f02wl072FrameMigration.includes("'F02WL072-FRAME-S01'"), "F02WL072 frame alias is missing");
assert(f02wl072FrameMigration.includes("'upper-sign-frame'"), "F02WL072 renderer target is missing");
assert(f02wl072FrameMigration.includes("64.907132"), "F02WL072 frame surface area is missing");
assert(f02wl072FrameMigration.includes('"render_kind":"coplanar_polygon"'), "exact F02WL072 frame polygons are missing");
assert(slotGenerator.includes("and source_kind = 'vworld_uv'"), "VWorld regeneration must preserve manual app-asset slots");
assert(slotGenerator.includes('source_kind: "vworld_uv"'), "generated VWorld slots must identify their renderer kind");
assert(slotGenerator.includes("replacement_canvas_width_px=coalesce"), "VWorld regeneration must preserve calibrated replacement canvases");
assert(slotGenerator.includes("Replacement canvas aspect does not match physical surface"), "surface calibration fixtures must validate canvas/physical aspect agreement");
assert(slotGenerator.includes("else object_texture_slots.placement_count end"), "VWorld regeneration must preserve manual placement counts together with placement JSON");
assert(surfaceCalibrations.calibrations.some((row) => row.slot_key === "1b1791647b8a6ff59f6c5bbaddea2104ce71be098dfed8d97221b01a13eafd0e" && row.replacement_canvas_width_px === 870 && row.replacement_canvas_height_px === 256), "F02FC092 surface calibration fixture is missing");
assert(surfaceCalibrations.calibrations.some((row) => row.slot_key === "2d02316d8183557e64f69a57063dd4d966342a6febb043c4102a70525bb2c7d5" && row.replacement_canvas_width_px === 820 && row.replacement_canvas_height_px === 512 && row.surface_width_m === 5.88603119 && row.surface_height_m === 3.67514453), "F02WL015 surface calibration fixture is missing");
const s22Placements = surfacePlacements.placements.find((row) => row.slot_key === "f01787e8cb1eaac8d79c4c1a58190af819fee12d7fd19928664c73cf7a1a6bd6");
assert(s22Placements?.surface_placements?.length === 2, "F02WL072-S22 placement fixture must contain both physical faces");
assert.equal(s22Placements.surface_placements.filter((placement) => placement.is_primary).length, 1, "S22 placement fixture must identify one map-focus face");
const s32Placement = surfacePlacements.placements.find((row) => row.slot_key === "40b474282ea960465a740aa908c1d1df083ada3a8275a67812fae0dccc3b3fe2");
assert.equal(s32Placement?.surface_placements?.[0]?.render_kind, "coplanar_polygon", "S32 placement fixture must preserve exact geometry");
assert.deepEqual(s32Placement.surface_placements[0].faces, [238, 239], "S32 placement fixture must not include its surrounding frame or shopfront");
assert.deepEqual(s32Placement.surface_placements[0].texture_coordinates, [[0, 1], [1, 1], [1, 0], [0, 0]], "S32 placement fixture must keep the sign readable and unmirrored");
const f02wl076Placement = surfacePlacements.placements.find((row) => row.slot_key === "740b513abfaddbff53414368d5c375ed586e175629abbdef09fc72f8d6c03883");
assert.equal(f02wl076Placement?.surface_placements?.[0]?.render_kind, "coplanar_polygon", "F02WL076 exact placement fixture is missing");
assert.deepEqual(f02wl076Placement.surface_placements[0].texture_coordinates, [[1, 1], [1, 0], [0, 0], [0, 1]], "F02WL076 placement fixture must not mirror the wordmark");
const f02wl072s26Placement = surfacePlacements.placements.find((row) => row.slot_key === "d3c9bc023df8a18de2075206cfff450096d883a2855bccc7bac207aed96afe4b");
assert.equal(f02wl072s26Placement?.surface_placements?.[0]?.legacy_replacement_crop?.height_px, 67, "S26 legacy blank-band crop fixture is missing");
assert(catalogSource.includes("visibleSlots = visibleSlots.filter((slot)"), "status filter must narrow the visible photo slots, not only their parent object");
assert(javascriptSource.includes("set_object_slot_management_target"), "shared management-target persistence is missing");
const geodeticFocusBranch = appSource.indexOf("Number.isFinite(CATALOG_FOCUS?.longitude)");
const enuFocusBranch = appSource.indexOf("Number.isFinite(CATALOG_FOCUS?.east)");
assert(geodeticFocusBranch >= 0 && enuFocusBranch > geodeticFocusBranch, "catalog focus must prefer source geodetic coordinates over a mismatched local ENU origin");
assert(!/catalog-focus:[\s\S]{0,900}disableDepthTestDistance:\s*Number\.POSITIVE_INFINITY/.test(appSource), "catalog marker must not render through unrelated geometry while the camera rotates");

console.log(`협업 배포 빌드 검증 완료: ${files.length} files`);

async function walk(directory) {
  const result = [];
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...await walk(target));
    else result.push(target);
  }
  return result;
}
