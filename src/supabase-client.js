import { createClient } from "@supabase/supabase-js";

const supabaseUrl = String(import.meta.env.VITE_SUPABASE_URL || "").trim();
const publishableKey = String(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "").trim();

if (!supabaseUrl || !publishableKey) {
  throw new Error("Supabase 연결 환경값이 없습니다. .env.local을 확인하세요.");
}

const supabase = createClient(supabaseUrl, publishableKey, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

const PAGE_SIZE = 700;
const PREVIEW_BUCKET = "vworld-catalog-previews";
const ORIGINAL_BUCKET = "vworld-catalog-originals";
const REPLACEMENT_BUCKET = "vworld-catalog-replacements";

async function fetchAll(table, columns = "*", order = null, filters = {}) {
  const rows = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    let query = supabase.from(table).select(columns).range(from, from + PAGE_SIZE - 1);
    for (const [column, value] of Object.entries(filters)) query = query.eq(column, value);
    if (order) query = query.order(order, { ascending: true });
    const { data, error } = await query;
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < PAGE_SIZE) return rows;
  }
}

async function signPaths(bucket, paths, expiresIn = 3600) {
  const uniquePaths = [...new Set(paths.filter(Boolean))];
  const signed = new Map();
  for (let index = 0; index < uniquePaths.length; index += 80) {
    const batch = uniquePaths.slice(index, index + 80);
    const { data, error } = await supabase.storage.from(bucket).createSignedUrls(batch, expiresIn);
    if (error) throw error;
    for (const row of data || []) {
      if (row.error) continue;
      signed.set(row.path, row.signedUrl);
    }
  }
  return signed;
}

function safeFileName(name) {
  return String(name || "replacement")
    .normalize("NFKC")
    .replace(/[^0-9A-Za-z가-힣._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100) || "replacement";
}

async function getSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session || null;
}

function publicEditorName() {
  const bytes = crypto.getRandomValues(new Uint8Array(3));
  const suffix = [...bytes].map((value) => value.toString(16).padStart(2, "0")).join("").toUpperCase();
  return `공개 작업자 ${suffix}`;
}

async function ensurePublicSession(forceNew = false) {
  const existing = await getSession();
  if (existing?.user?.is_anonymous && !forceNew) return existing;
  if (existing) {
    const { error: signOutError } = await supabase.auth.signOut({ scope: "local" });
    if (signOutError) throw signOutError;
  }
  const { data, error } = await supabase.auth.signInAnonymously({
    options: { data: { display_name: publicEditorName(), public_editor: true } },
  });
  if (error) throw error;
  return data.session;
}

async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

async function signUp(email, password, displayName) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { display_name: String(displayName || "").trim().slice(0, 80) } },
  });
  if (error) throw error;
  return data;
}

async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

async function loadProfile() {
  const session = await getSession();
  if (!session?.user?.id) throw new Error("익명 작업자 세션이 없습니다.");
  const { data, error } = await supabase.from("profiles").select("id,email,display_name,role,membership_state,created_at").eq("id", session.user.id).single();
  if (error) throw error;
  return data;
}

async function loadCatalog() {
  const [occurrences, features, manifests] = await Promise.all([
    fetchAll("image_occurrences", "*", "image_id"),
    fetchAll("feature_placements", "*", "feature_key"),
    fetchAll("catalog_manifests", "*", "site_id"),
  ]);
  const previewUrls = await signPaths(PREVIEW_BUCKET, occurrences.map((row) => row.preview_storage_path));
  return {
    occurrences: occurrences.map((row) => ({
      ...row,
      asset_path: row.asset_storage_path,
      preview_path: row.preview_storage_path,
      asset_url: "",
      preview_url: previewUrls.get(row.preview_storage_path) || "",
    })),
    features,
    manifest: manifests[0] || {
      site_id: "S202103",
      site_name: "서울역KTX",
      image_occurrence_count: occurrences.length,
      feature_count: features.length,
    },
  };
}

async function loadObjectWorkbench(siteId = "S202103") {
  const [allSlots, manifests] = await Promise.all([
    fetchAll("object_texture_slots", "*", "floor", { site_id: siteId, is_active: true }),
    fetchAll("catalog_manifests", "*", "site_id"),
  ]);
  const slots = allSlots;
  const previewUrls = await signPaths(PREVIEW_BUCKET, slots.map((row) => row.preview_storage_path));
  return {
    slots: slots.map((row) => ({
      ...row,
      preview_url: previewUrls.get(row.preview_storage_path) || "",
    })),
    manifests,
    manifest: manifests[0] || { site_id: "S202103", site_name: "서울역KTX" },
  };
}

async function signedOriginal(path) {
  const { data, error } = await supabase.storage.from(ORIGINAL_BUCKET).createSignedUrl(path, 900);
  if (error) throw error;
  return data.signedUrl;
}

async function signedReplacement(path) {
  const { data, error } = await supabase.storage.from(REPLACEMENT_BUCKET).createSignedUrl(path, 900);
  if (error) throw error;
  return data.signedUrl;
}

async function loadApprovedObjectSlotOverlays(siteId = "S202103") {
  const { data, error } = await supabase
    .from("object_slot_replacement_versions")
    .select(`
      id,slot_key,storage_path,file_name,replacement_width_px,replacement_height_px,
      replacement_mime_type,current_store_name,review_status,is_active,reviewed_at,created_at,
      slot:object_texture_slots!inner(
        site_id,is_active,object_key,slot_alias,floor,td_id,model_name,object_label,
        source_kind,target_asset_id,target_surface_id,surface_width_m,surface_height_m,
        replacement_canvas_width_px,replacement_canvas_height_px,
        longitude,latitude,height_m,camera_heading_deg,surface_area_m2,
        crop_width_px,crop_height_px,surface_count,placement_count,surface_placements
      )
    `)
    .eq("review_status", "approved")
    .eq("is_active", true)
    .eq("slot.site_id", siteId)
    .eq("slot.is_active", true)
    .order("created_at", { ascending: false });
  if (error) throw error;

  // 승인 이력은 보존하되 지도에는 슬롯별 최신 승인본 한 장만 표시한다.
  const latestBySlot = new Map();
  for (const row of data || []) {
    if (!latestBySlot.has(row.slot_key)) latestBySlot.set(row.slot_key, row);
  }
  const rows = [...latestBySlot.values()];
  const signedUrls = await signPaths(REPLACEMENT_BUCKET, rows.map((row) => row.storage_path), 6 * 60 * 60);
  return rows
    .map((row) => ({
      ...row,
      slot: Array.isArray(row.slot) ? row.slot[0] : row.slot,
      image_url: signedUrls.get(row.storage_path) || "",
    }))
    .filter((row) => row.slot && row.image_url);
}

function subscribeApprovedObjectSlotOverlays(onChange) {
  return supabase
    .channel("station-one-approved-object-overlays")
    .on("postgres_changes", { event: "*", schema: "public", table: "object_slot_replacement_versions" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "object_texture_slots" }, onChange)
    .subscribe();
}

async function loadCollaborationState() {
  const [workItems, replacements, profiles] = await Promise.all([
    fetchAll("catalog_work_items", "*", "image_sha256"),
    fetchAll("replacement_versions", "*", "created_at"),
    fetchAll("profiles", "id,email,display_name,role,membership_state", "display_name"),
  ]);
  return { workItems, replacements, profiles };
}

async function loadObjectCollaborationState() {
  const [workItems, replacements, profiles] = await Promise.all([
    fetchAll("object_slot_work_items", "*", "slot_key"),
    fetchAll("object_slot_replacement_versions", "*", "created_at"),
    fetchAll("profiles", "id,email,display_name,role,membership_state", "display_name"),
  ]);
  return { workItems, replacements, profiles };
}

async function claimObjectSlot(slotKey) {
  const { data, error } = await supabase.rpc("claim_object_slot_work", { p_slot_key: slotKey });
  if (error) throw error;
  return data;
}

async function setObjectSlotStatus(slotKey, status) {
  const { data, error } = await supabase.rpc("set_object_slot_work_status", {
    p_slot_key: slotKey,
    p_status: status,
  });
  if (error) throw error;
  return data;
}

async function setObjectSlotManagementTarget(slotKey, isTarget) {
  const { data, error } = await supabase.rpc("set_object_slot_management_target", {
    p_slot_key: slotKey,
    p_is_target: Boolean(isTarget),
  });
  if (error) throw error;
  return data;
}

async function saveObjectSlotReplacement({ slot, file, dimensions, currentStoreName, note }) {
  const versionId = crypto.randomUUID();
  const extension = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const storagePath = `object-slots/${slot.slot_key}/${versionId}-${safeFileName(file.name).replace(/\.[^.]+$/, "")}.${extension}`;
  const upload = await supabase.storage.from(REPLACEMENT_BUCKET).upload(storagePath, file, {
    cacheControl: "3600",
    contentType: file.type,
    upsert: false,
  });
  if (upload.error) throw upload.error;

  const payload = {
    id: versionId,
    slot_key: slot.slot_key,
    storage_path: storagePath,
    file_name: file.name,
    replacement_width_px: dimensions.width,
    replacement_height_px: dimensions.height,
    replacement_mime_type: file.type,
    replacement_byte_length: file.size,
    current_store_name: String(currentStoreName || "").trim().slice(0, 120),
    note: String(note || "").trim().slice(0, 600),
    review_status: "submitted",
  };
  const { data, error } = await supabase.from("object_slot_replacement_versions").insert(payload).select().single();
  if (error) {
    await supabase.storage.from(REPLACEMENT_BUCKET).remove([storagePath]);
    throw error;
  }
  await setObjectSlotStatus(slot.slot_key, "review");
  return data;
}

async function reviewObjectSlotReplacement(versionId, decision, note = "") {
  const { data, error } = await supabase.rpc("review_object_slot_replacement", {
    p_version_id: versionId,
    p_decision: decision,
    p_note: String(note || "").slice(0, 600),
  });
  if (error) throw error;
  return data;
}

async function restoreObjectSlotOriginal(slotKey, note = "") {
  const { data, error } = await supabase.rpc("restore_object_slot_original", {
    p_slot_key: slotKey,
    p_note: String(note || "").slice(0, 600),
  });
  if (error) throw error;
  return data;
}

function subscribeObjectWorkbench(onChange) {
  return supabase
    .channel("station-one-object-workbench")
    .on("postgres_changes", { event: "*", schema: "public", table: "object_texture_slots" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "object_slot_work_items" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "object_slot_replacement_versions" }, onChange)
    .subscribe();
}

async function claimWork(imageSha256) {
  const { data, error } = await supabase.rpc("claim_catalog_work", { p_image_sha256: imageSha256 });
  if (error) throw error;
  return data;
}

async function setWorkStatus(imageSha256, status) {
  const { data, error } = await supabase.rpc("set_catalog_work_status", {
    p_image_sha256: imageSha256,
    p_status: status,
  });
  if (error) throw error;
  return data;
}

async function saveReplacement({ item, usage, file, dimensions, currentStoreName, note }) {
  const versionId = crypto.randomUUID();
  const extension = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const storagePath = `${item.sha}/${versionId}-${safeFileName(file.name).replace(/\.[^.]+$/, "")}.${extension}`;
  const upload = await supabase.storage.from(REPLACEMENT_BUCKET).upload(storagePath, file, {
    cacheControl: "3600",
    contentType: file.type,
    upsert: false,
  });
  if (upload.error) throw upload.error;

  const payload = {
    id: versionId,
    image_sha256: item.sha,
    image_id: item.primary.image_id,
    storage_path: storagePath,
    file_name: file.name,
    original_width_px: Number(item.primary.width_px),
    original_height_px: Number(item.primary.height_px),
    replacement_width_px: dimensions.width,
    replacement_height_px: dimensions.height,
    replacement_mime_type: file.type,
    replacement_byte_length: file.size,
    current_store_name: String(currentStoreName || "").trim().slice(0, 120),
    note: String(note || "").trim().slice(0, 600),
    usage_floor: usage.floorList?.[0] || "",
    usage_model: usage.model_names || "",
    usage_td_id: usage.td_ids || "",
    review_status: "submitted",
  };
  const { data, error } = await supabase.from("replacement_versions").insert(payload).select().single();
  if (error) {
    await supabase.storage.from(REPLACEMENT_BUCKET).remove([storagePath]);
    throw error;
  }
  await setWorkStatus(item.sha, "review");
  return { ...data, replacement_file: storagePath, replacement_url: null };
}

async function reviewReplacement(versionId, decision, note = "") {
  const { data, error } = await supabase.rpc("review_replacement", {
    p_version_id: versionId,
    p_decision: decision,
    p_note: String(note || "").slice(0, 600),
  });
  if (error) throw error;
  return data;
}

function subscribe(onChange) {
  return supabase
    .channel("station-one-catalog-collaboration")
    .on("postgres_changes", { event: "*", schema: "public", table: "catalog_work_items" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "replacement_versions" }, onChange)
    .subscribe();
}

export const collabApi = {
  getSession,
  ensurePublicSession,
  signIn,
  signUp,
  signOut,
  loadProfile,
  loadCatalog,
  loadObjectWorkbench,
  signedOriginal,
  signedReplacement,
  loadApprovedObjectSlotOverlays,
  subscribeApprovedObjectSlotOverlays,
  loadCollaborationState,
  loadObjectCollaborationState,
  claimWork,
  setWorkStatus,
  saveReplacement,
  reviewReplacement,
  subscribe,
  claimObjectSlot,
  setObjectSlotStatus,
  setObjectSlotManagementTarget,
  saveObjectSlotReplacement,
  reviewObjectSlotReplacement,
  restoreObjectSlotOriginal,
  subscribeObjectWorkbench,
};
