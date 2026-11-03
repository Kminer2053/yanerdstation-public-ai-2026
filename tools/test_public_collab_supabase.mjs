import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { createClient } from "@supabase/supabase-js";

const root = path.resolve(import.meta.dirname, "..");
const envText = await fs.readFile(path.join(root, ".env.local"), "utf8");
const env = Object.fromEntries(envText
  .split(/\r?\n/)
  .filter((line) => line && !line.trimStart().startsWith("#"))
  .map((line) => {
    const split = line.indexOf("=");
    return [line.slice(0, split), line.slice(split + 1)];
  }));

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

const { data: authData, error: authError } = await supabase.auth.signInAnonymously({
  options: { data: { display_name: "공개 연결 검증", public_editor: true } },
});
if (authError) throw authError;
if (!authData.user?.is_anonymous) throw new Error("익명 작업자 세션이 생성되지 않았습니다.");

const facadeSlotKey = "7afba516acfae10344297172e7c5c80368d4d3d43b140a71a14ccedc208852bc";
const f02wl072FrameSlotKey = "45021744d021f0f515143bb63e962060f8a91ed1287c05f13aeb128f9a3ea1cb";
const f02wl072S32SlotKey = "40b474282ea960465a740aa908c1d1df083ada3a8275a67812fae0dccc3b3fe2";
const f02wl076SlotKey = "740b513abfaddbff53414368d5c375ed586e175629abbdef09fc72f8d6c03883";
const rectifiedSlotKey = "1b1791647b8a6ff59f6c5bbaddea2104ce71be098dfed8d97221b01a13eafd0e";
const f02wl015RectifiedSlotKey = "2d02316d8183557e64f69a57063dd4d966342a6febb043c4102a70525bb2c7d5";
const [
  { data: profile, error: profileError },
  { count: imageCount, error: imageError },
  { data: sampleImage, error: sampleError },
  { count: activeSlotCount, error: activeSlotError },
  { count: activeVworldSlotCount, error: activeVworldSlotError },
  { count: daejeonImageCount, error: daejeonImageError },
  { count: daejeonSlotCount, error: daejeonSlotError },
  { data: facadeSlots, error: facadeSlotsError },
  { count: daejeonFacadeCount, error: daejeonFacadeError },
  { data: facadeWork, error: facadeWorkError },
  { data: rectifiedSlot, error: rectifiedSlotError },
  { data: f02wl015RectifiedSlot, error: f02wl015RectifiedSlotError },
  { data: f02wl072FrameSlots, error: f02wl072FrameSlotsError },
  { data: f02wl072FrameWork, error: f02wl072FrameWorkError },
] = await Promise.all([
  supabase.from("profiles").select("role,membership_state").eq("id", authData.user.id).single(),
  supabase.from("image_occurrences").select("image_id", { count: "exact", head: true }),
  supabase.from("image_occurrences").select("preview_storage_path").limit(1).single(),
  supabase.from("object_texture_slots").select("slot_key", { count: "exact", head: true }).eq("is_active", true),
  supabase.from("object_texture_slots").select("slot_key", { count: "exact", head: true }).eq("is_active", true).eq("source_kind", "vworld_uv"),
  supabase.from("image_occurrences").select("image_id", { count: "exact", head: true }).eq("site_id", "S201801"),
  supabase.from("object_texture_slots").select("slot_key", { count: "exact", head: true }).eq("site_id", "S201801").eq("is_active", true),
  supabase.from("object_texture_slots")
    .select("slot_key,source_kind,target_asset_id,target_surface_id,surface_width_m,surface_height_m,crop_width_px,crop_height_px,original_storage_path,preview_storage_path")
    .eq("site_id", "S202103")
    .eq("source_kind", "app_asset")
    .eq("target_asset_id", "SEOUL-2F-TRUEDAN")
    .eq("target_surface_id", "front-facade")
    .eq("is_active", true),
  supabase.from("object_texture_slots").select("slot_key", { count: "exact", head: true })
    .eq("site_id", "S201801").eq("target_asset_id", "SEOUL-2F-TRUEDAN").eq("is_active", true),
  supabase.from("object_slot_work_items").select("slot_key,is_management_target,current_store_name").eq("slot_key", facadeSlotKey).single(),
  supabase.from("object_texture_slots")
    .select("slot_key,crop_width_px,crop_height_px,replacement_canvas_width_px,replacement_canvas_height_px,surface_width_m,surface_height_m")
    .eq("slot_key", rectifiedSlotKey)
    .eq("site_id", "S202103")
    .eq("is_active", true)
    .single(),
  supabase.from("object_texture_slots")
    .select("slot_key,slot_alias,crop_width_px,crop_height_px,replacement_canvas_width_px,replacement_canvas_height_px,surface_width_m,surface_height_m")
    .eq("slot_key", f02wl015RectifiedSlotKey)
    .eq("site_id", "S202103")
    .eq("is_active", true)
    .single(),
  supabase.from("object_texture_slots")
    .select("slot_key,slot_alias,source_kind,target_asset_id,target_surface_id,replacement_canvas_width_px,replacement_canvas_height_px,surface_count,placement_count,surface_area_m2,surface_placements,original_storage_path,preview_storage_path")
    .eq("site_id", "S202103")
    .eq("source_kind", "app_asset")
    .eq("target_asset_id", "SEOUL-2F-F02WL072")
    .eq("target_surface_id", "upper-sign-frame")
    .eq("is_active", true),
  supabase.from("object_slot_work_items")
    .select("slot_key,is_management_target,current_store_name")
    .eq("slot_key", f02wl072FrameSlotKey)
    .single(),
]);
if (profileError) throw profileError;
if (imageError) throw imageError;
if (sampleError) throw sampleError;
if (activeSlotError) throw activeSlotError;
if (activeVworldSlotError) throw activeVworldSlotError;
if (daejeonImageError) throw daejeonImageError;
if (daejeonSlotError) throw daejeonSlotError;
if (facadeSlotsError) throw facadeSlotsError;
if (daejeonFacadeError) throw daejeonFacadeError;
if (facadeWorkError) throw facadeWorkError;
if (rectifiedSlotError) throw rectifiedSlotError;
if (f02wl015RectifiedSlotError) throw f02wl015RectifiedSlotError;
if (f02wl072FrameSlotsError) throw f02wl072FrameSlotsError;
if (f02wl072FrameWorkError) throw f02wl072FrameWorkError;
if (profile.membership_state !== "active" || profile.role !== "editor") {
  throw new Error(`익명 작업자 권한이 올바르지 않습니다: ${profile.role}/${profile.membership_state}`);
}
if (imageCount !== 4063) throw new Error(`예상 이미지 발생 수와 다릅니다: ${imageCount}`);
if (activeVworldSlotCount !== 3608) throw new Error(`기존 VWorld 사진 교체 단위 수와 다릅니다: ${activeVworldSlotCount}`);
if (activeSlotCount !== activeVworldSlotCount + 2) throw new Error(`전체 사진 교체 단위 수와 다릅니다: ${activeSlotCount}`);
if (daejeonImageCount !== 2101) throw new Error(`대전역 이미지 발생 수와 다릅니다: ${daejeonImageCount}`);
if (daejeonSlotCount !== 1379) throw new Error(`대전역 사진 교체 단위 수와 다릅니다: ${daejeonSlotCount}`);
if (facadeSlots.length !== 1 || facadeSlots[0].slot_key !== facadeSlotKey) {
  throw new Error(`TRUEDAN 전체 파사드 슬롯이 정확히 1개가 아닙니다: ${JSON.stringify(facadeSlots)}`);
}
const facadeSlot = facadeSlots[0];
if (facadeSlot.crop_width_px !== 1920 || facadeSlot.crop_height_px !== 1004) {
  throw new Error(`TRUEDAN 파사드 픽셀 규격이 다릅니다: ${facadeSlot.crop_width_px}x${facadeSlot.crop_height_px}`);
}
if (Math.abs(facadeSlot.surface_width_m - 6) > 1e-8 || Math.abs(facadeSlot.surface_height_m - 3.1378) > 1e-8) {
  throw new Error(`TRUEDAN 파사드 물리 규격이 다릅니다: ${facadeSlot.surface_width_m}x${facadeSlot.surface_height_m}`);
}
if (daejeonFacadeCount !== 0) throw new Error(`대전역에 TRUEDAN 파사드 슬롯이 생겼습니다: ${daejeonFacadeCount}`);
if (!facadeWork.is_management_target || facadeWork.current_store_name !== "TRUEDAN") {
  throw new Error(`TRUEDAN 파사드 작업 항목이 올바르지 않습니다: ${JSON.stringify(facadeWork)}`);
}
if (f02wl072FrameSlots.length !== 1 || f02wl072FrameSlots[0].slot_key !== f02wl072FrameSlotKey) {
  throw new Error(`F02WL072 상단 프레임 슬롯이 정확히 1개가 아닙니다: ${JSON.stringify(f02wl072FrameSlots)}`);
}
const f02wl072FrameSlot = f02wl072FrameSlots[0];
if (f02wl072FrameSlot.slot_alias !== "F02WL072-FRAME-S01"
  || f02wl072FrameSlot.replacement_canvas_width_px !== 256
  || f02wl072FrameSlot.replacement_canvas_height_px !== 256
  || f02wl072FrameSlot.surface_count !== 6
  || f02wl072FrameSlot.placement_count !== 6
  || f02wl072FrameSlot.surface_placements?.length !== 6
  || Math.abs(f02wl072FrameSlot.surface_area_m2 - 64.907132) > 1e-8) {
  throw new Error(`F02WL072 상단 프레임 계약이 올바르지 않습니다: ${JSON.stringify(f02wl072FrameSlot)}`);
}
if (f02wl072FrameSlot.surface_placements.filter((placement) => placement.is_primary).length !== 1
  || f02wl072FrameSlot.surface_placements.some((placement) => placement.render_kind !== "coplanar_polygon")) {
  throw new Error(`F02WL072 상단 프레임 배치 정보가 올바르지 않습니다: ${JSON.stringify(f02wl072FrameSlot.surface_placements)}`);
}
if (!f02wl072FrameWork.is_management_target || f02wl072FrameWork.current_store_name !== "중소기업명품마루") {
  throw new Error(`F02WL072 상단 프레임 작업 항목이 올바르지 않습니다: ${JSON.stringify(f02wl072FrameWork)}`);
}
if (rectifiedSlot.crop_width_px !== 256 || rectifiedSlot.crop_height_px !== 256) {
  throw new Error(`F02FC092 원본 UV 규격이 보존되지 않았습니다: ${rectifiedSlot.crop_width_px}x${rectifiedSlot.crop_height_px}`);
}
if (rectifiedSlot.replacement_canvas_width_px !== 870 || rectifiedSlot.replacement_canvas_height_px !== 256) {
  throw new Error(`F02FC092 교체 캔버스 규격이 다릅니다: ${rectifiedSlot.replacement_canvas_width_px}x${rectifiedSlot.replacement_canvas_height_px}`);
}
if (Math.abs(rectifiedSlot.surface_width_m - 1.22925696) > 1e-8 || Math.abs(rectifiedSlot.surface_height_m - 0.36170862) > 1e-8) {
  throw new Error(`F02FC092 실제 면 규격이 다릅니다: ${rectifiedSlot.surface_width_m}x${rectifiedSlot.surface_height_m}`);
}
if (f02wl015RectifiedSlot.slot_alias !== "F02WL015-S01"
  || f02wl015RectifiedSlot.crop_width_px !== 512
  || f02wl015RectifiedSlot.crop_height_px !== 512
  || f02wl015RectifiedSlot.replacement_canvas_width_px !== 820
  || f02wl015RectifiedSlot.replacement_canvas_height_px !== 512
  || Math.abs(f02wl015RectifiedSlot.surface_width_m - 5.88603119) > 1e-8
  || Math.abs(f02wl015RectifiedSlot.surface_height_m - 3.67514453) > 1e-8) {
  throw new Error(`F02WL015-S01 교체 계약이 올바르지 않습니다: ${JSON.stringify(f02wl015RectifiedSlot)}`);
}

const { data: signedPreview, error: previewError } = await supabase.storage
  .from("vworld-catalog-previews")
  .createSignedUrl(sampleImage.preview_storage_path, 60);
if (previewError) throw previewError;
if (!signedPreview.signedUrl) throw new Error("비공개 미리보기의 서명 URL이 생성되지 않았습니다.");

const [{ data: signedFacadeOriginal, error: facadeOriginalError }, { data: signedFacadePreview, error: facadePreviewError }] = await Promise.all([
  supabase.storage.from("vworld-catalog-originals").createSignedUrl(facadeSlot.original_storage_path, 60),
  supabase.storage.from("vworld-catalog-previews").createSignedUrl(facadeSlot.preview_storage_path, 60),
]);
if (facadeOriginalError) throw facadeOriginalError;
if (facadePreviewError) throw facadePreviewError;
if (!signedFacadeOriginal.signedUrl || !signedFacadePreview.signedUrl) {
  throw new Error("TRUEDAN 기준 파사드 Storage 파일에 접근할 수 없습니다.");
}

const [{ data: signedFrameOriginal, error: frameOriginalError }, { data: signedFramePreview, error: framePreviewError }] = await Promise.all([
  supabase.storage.from("vworld-catalog-originals").createSignedUrl(f02wl072FrameSlot.original_storage_path, 60),
  supabase.storage.from("vworld-catalog-previews").createSignedUrl(f02wl072FrameSlot.preview_storage_path, 60),
]);
if (frameOriginalError) throw frameOriginalError;
if (framePreviewError) throw framePreviewError;
if (!signedFrameOriginal.signedUrl || !signedFramePreview.signedUrl) {
  throw new Error("F02WL072 상단 프레임 기준 컬러 Storage 파일에 접근할 수 없습니다.");
}

const { error: writeProbeError } = await supabase.rpc("claim_catalog_work", {
  p_image_sha256: "0".repeat(64),
});
if (!writeProbeError?.message.includes("작업 항목을 찾지 못했습니다")) {
  throw new Error(`공개 편집 RPC 권한 검증에 실패했습니다: ${writeProbeError?.message || "오류 없음"}`);
}

const { error: managementProbeError } = await supabase.rpc("set_object_slot_management_target", {
  p_slot_key: "0".repeat(64),
  p_is_target: true,
});
if (!managementProbeError?.message.includes("이미지 슬롯을 찾지 못했습니다")) {
  throw new Error(`관리대상 RPC 권한 검증에 실패했습니다: ${managementProbeError?.message || "오류 없음"}`);
}

const expectedSecondFloorModels = ["F02WL011", "F02WL058", "F02WL021", "F02WL056"];
const { data: positionedSlots, error: positionedSlotsError } = await supabase
  .from("object_texture_slots")
  .select("model_name,slot_alias,slot_level,is_active,longitude,latitude,height_m,camera_heading_deg,tile")
  .eq("is_active", true)
  .in("model_name", expectedSecondFloorModels);
if (positionedSlotsError) throw positionedSlotsError;
for (const modelName of expectedSecondFloorModels) {
  const slot = positionedSlots.find((candidate) => candidate.model_name === modelName);
  if (!slot) throw new Error(`${modelName} 교정 좌표가 원격 DB에 없습니다.`);
  if (slot.height_m < 35 || slot.height_m > 45) {
    throw new Error(`${modelName} 원격 높이가 서울역 2층 범위를 벗어났습니다: ${slot.height_m}`);
  }
  if (!Number.isFinite(slot.camera_heading_deg)) {
    throw new Error(`${modelName} 원격 파사드 카메라 방위가 없습니다.`);
  }
}

const f02wl011 = positionedSlots.filter((slot) => slot.model_name === "F02WL011");
if (f02wl011.length !== 2 || f02wl011.some((slot) => slot.slot_level !== "uv_surface" || !slot.slot_alias)) {
  throw new Error(`F02WL011 사진 단위가 2개로 분리되지 않았습니다: ${JSON.stringify(f02wl011)}`);
}
const { count: f02wl072Count, error: f02wl072Error } = await supabase
  .from("object_texture_slots")
  .select("slot_key", { count: "exact", head: true })
  .eq("is_active", true)
  .eq("source_kind", "vworld_uv")
  .eq("model_name", "F02WL072");
if (f02wl072Error) throw f02wl072Error;
if (f02wl072Count !== 49) throw new Error(`F02WL072 세부 사진 단위가 49개가 아닙니다: ${f02wl072Count}`);

const [
  { data: f02wl072S32Slot, error: f02wl072S32SlotError },
  { data: f02wl072S32Versions, error: f02wl072S32VersionsError },
  { data: f02wl076Versions, error: f02wl076VersionsError },
] = await Promise.all([
  supabase
    .from("object_texture_slots")
    .select("slot_alias,crop_width_px,crop_height_px,longitude,latitude,height_m,surface_width_m,surface_height_m,surface_count,placement_count,surface_placements")
    .eq("slot_key", f02wl072S32SlotKey)
    .eq("site_id", "S202103")
    .eq("is_active", true)
    .single(),
  supabase
    .from("object_slot_replacement_versions")
    .select("id,replacement_width_px,replacement_height_px,review_status,is_active")
    .eq("slot_key", f02wl072S32SlotKey)
    .eq("review_status", "approved")
    .eq("is_active", true),
  supabase
    .from("object_slot_replacement_versions")
    .select("id,replacement_width_px,replacement_height_px,review_status,is_active")
    .eq("slot_key", f02wl076SlotKey)
    .eq("review_status", "approved")
    .eq("is_active", true),
]);
if (f02wl072S32SlotError) throw f02wl072S32SlotError;
if (f02wl072S32VersionsError) throw f02wl072S32VersionsError;
if (f02wl076VersionsError) throw f02wl076VersionsError;
const f02wl072S32Surface = f02wl072S32Slot.surface_placements?.[0];
if (f02wl072S32Slot.slot_alias !== "F02WL072-S32"
  || f02wl072S32Slot.crop_width_px !== 340
  || f02wl072S32Slot.crop_height_px !== 29
  || Math.abs(f02wl072S32Slot.longitude - 126.970120077936) > 1e-10
  || Math.abs(f02wl072S32Slot.latitude - 37.553951334264) > 1e-10
  || Math.abs(f02wl072S32Slot.height_m - 40.619431) > 1e-8
  || Math.abs(f02wl072S32Slot.surface_width_m - 23.1649939) > 1e-8
  || Math.abs(f02wl072S32Slot.surface_height_m - 1.76935595) > 1e-8
  || f02wl072S32Slot.surface_count !== 1
  || f02wl072S32Slot.placement_count !== 1
  || f02wl072S32Slot.surface_placements?.length !== 1
  || f02wl072S32Surface?.render_kind !== "coplanar_polygon"
  || JSON.stringify(f02wl072S32Surface.faces) !== "[238,239]"
  || JSON.stringify(f02wl072S32Surface.corners_wgs84) !== "[[126.970243342935,37.553915946792,39.750717],[126.969995437996,37.553983448021,39.760842],[126.969996693203,37.553986827304,41.483221],[126.970244837611,37.553919114939,41.482944]]"
  || JSON.stringify(f02wl072S32Surface.texture_coordinates) !== "[[0,1],[1,1],[1,0],[0,0]]") {
  throw new Error(`F02WL072-S32 실제 경사면 계약이 올바르지 않습니다: ${JSON.stringify(f02wl072S32Slot)}`);
}
if (f02wl072S32Versions.length !== 1
  || f02wl072S32Versions[0].replacement_width_px !== 340
  || f02wl072S32Versions[0].replacement_height_px !== 29) {
  throw new Error(`F02WL072-S32 기존 승인 이미지가 유지되지 않았습니다: ${JSON.stringify(f02wl072S32Versions)}`);
}
if (f02wl076Versions.length !== 1
  || f02wl076Versions[0].replacement_width_px !== 256
  || f02wl076Versions[0].replacement_height_px !== 255) {
  throw new Error(`F02WL076-S01 기존 승인 이미지가 유지되지 않았습니다: ${JSON.stringify(f02wl076Versions)}`);
}

const { data: repeatedSurfaceSlot, error: repeatedSurfaceSlotError } = await supabase
  .from("object_texture_slots")
  .select("slot_alias,surface_count,placement_count,surface_width_m,surface_height_m,surface_placements")
  .eq("slot_key", "f01787e8cb1eaac8d79c4c1a58190af819fee12d7fd19928664c73cf7a1a6bd6")
  .single();
if (repeatedSurfaceSlotError) throw repeatedSurfaceSlotError;
if (repeatedSurfaceSlot.slot_alias !== "F02WL072-S22"
  || repeatedSurfaceSlot.surface_count !== 2
  || repeatedSurfaceSlot.placement_count !== 2
  || repeatedSurfaceSlot.surface_width_m !== 1.5026416
  || repeatedSurfaceSlot.surface_height_m !== 2.813382
  || repeatedSurfaceSlot.surface_placements?.length !== 2) {
  throw new Error(`F02WL072-S22 다중 면 배치가 원격 DB에 올바르지 않습니다: ${JSON.stringify(repeatedSurfaceSlot)}`);
}

const expectedFacadeCalibrations = new Map([
  ["F02WL023-S01", [1764, 510, 13.23843887, 3.82843188]],
  ["F02WL076-S01", [2006, 255, 10.60067322, 1.3472132]],
  ["F02WL072-S25", [441, 512, 3.16073886, 3.67189244]],
  ["F02WL072-S26", [1934, 512, 13.8722784, 3.67189072]],
  ["F02WL072-S34", [1183, 512, 8.84533226, 3.8281269]],
  ["F02WL072-S35", [214, 512, 1.53532017, 3.67991276]],
  ["F02WL072-S37", [490, 512, 3.51966955, 3.67991823]],
]);
const { data: calibratedFacades, error: calibratedFacadesError } = await supabase
  .from("object_texture_slots")
  .select("slot_alias,replacement_canvas_width_px,replacement_canvas_height_px,surface_width_m,surface_height_m,placement_count,surface_placements")
  .eq("site_id", "S202103")
  .eq("is_active", true)
  .in("slot_alias", [...expectedFacadeCalibrations.keys()]);
if (calibratedFacadesError) throw calibratedFacadesError;
if (calibratedFacades.length !== expectedFacadeCalibrations.size) {
  throw new Error(`교정 파사드 수가 다릅니다: ${calibratedFacades.length}`);
}
for (const slot of calibratedFacades) {
  const [canvasWidth, canvasHeight, surfaceWidth, surfaceHeight] = expectedFacadeCalibrations.get(slot.slot_alias) || [];
  if (slot.replacement_canvas_width_px !== canvasWidth
    || slot.replacement_canvas_height_px !== canvasHeight
    || Math.abs(slot.surface_width_m - surfaceWidth) > 1e-8
    || Math.abs(slot.surface_height_m - surfaceHeight) > 1e-8) {
    throw new Error(`${slot.slot_alias} 파사드 교정 계약이 다릅니다: ${JSON.stringify(slot)}`);
  }
}
const f02wl076Surface = calibratedFacades.find((slot) => slot.slot_alias === "F02WL076-S01")?.surface_placements?.[0];
if (f02wl076Surface?.render_kind !== "coplanar_polygon"
  || JSON.stringify(f02wl076Surface.corners_wgs84) !== "[[126.9715541819266,37.554079058358035,39.70628804],[126.97155714319126,37.5540751163405,38.45628149],[126.97145277314063,37.55402778587916,38.45632269],[126.97145014902237,37.55403172599876,39.70635074]]"
  || JSON.stringify(f02wl076Surface.texture_coordinates) !== "[[1,1],[1,0],[0,0],[0,1]]") {
  throw new Error(`F02WL076 경사면 계약이 올바르지 않습니다: ${JSON.stringify(f02wl076Surface)}`);
}
const f02wl072s26Surface = calibratedFacades.find((slot) => slot.slot_alias === "F02WL072-S26")?.surface_placements?.[0];
if (f02wl072s26Surface?.legacy_replacement_crop?.height_px !== 67) {
  throw new Error(`F02WL072-S26 기존 승인본 여백 제거 계약이 올바르지 않습니다: ${JSON.stringify(f02wl072s26Surface)}`);
}

await supabase.auth.signOut({ scope: "local" });
console.log(JSON.stringify({
  passed: true,
  anonymousSession: true,
  profileRole: profile.role,
  membershipState: profile.membership_state,
  imageOccurrences: imageCount,
  activePhotoUnits: activeSlotCount,
  activeVworldPhotoUnits: activeVworldSlotCount,
  truedanFacadePhotoUnits: facadeSlots.length,
  f02wl072FramePhotoUnits: f02wl072FrameSlots.length,
  rectifiedReplacementCanvas: `${rectifiedSlot.replacement_canvas_width_px}x${rectifiedSlot.replacement_canvas_height_px}`,
  f02wl015ReplacementCanvas: `${f02wl015RectifiedSlot.replacement_canvas_width_px}x${f02wl015RectifiedSlot.replacement_canvas_height_px}`,
  daejeonImageOccurrences: daejeonImageCount,
  daejeonPhotoUnits: daejeonSlotCount,
  privatePreviewAccess: true,
  publicEditRpcAccess: true,
  correctedObjectPositions: positionedSlots.length,
  representativePhotoUnits: { F02WL011: f02wl011.length, F02WL072: f02wl072Count },
  f02wl072S32ExactSurface: true,
  calibratedFacadeUnits: calibratedFacades.length,
}));
