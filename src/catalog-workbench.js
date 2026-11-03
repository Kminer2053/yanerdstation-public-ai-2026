import { collabApi } from "./supabase-client.js";
import { legacyReplacementCropStyle } from "./replacement-surface-contract.js";

(async () => {
  "use strict";

  const floorOrder = ["B7", "B6", "B5", "B4", "B3", "B2", "B1", "1F", "2F", "3F", "4F", "RF", "미연결"];
  const priorityOrder = { HIGH: 0, MEDIUM: 1, REVIEW: 2, REFERENCE: 3, EXCLUDE: 4 };
  const statusLabels = { pending: "미배정", in_progress: "작업 중", review: "검수 대기", approved: "승인 완료", hold: "보류" };
  const reviewStatusLabels = { submitted: "검수 대기", approved: "승인 완료", rejected: "반려" };
  const $ = (selector) => document.querySelector(selector);
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[char]));
  const finite = (value) => Number.isFinite(Number(value));
  const isAppAssetSlot = (slot) => slot?.source_kind === "app_asset";
  const isF02wl072FrameSlot = (slot) => isAppAssetSlot(slot)
    && slot?.target_asset_id === "SEOUL-2F-F02WL072"
    && slot?.target_surface_id === "upper-sign-frame";
  const appAssetPresentationById = Object.freeze({
    "SEOUL-2F-TRUEDAN": Object.freeze({
      unit: "TRUEDAN 전체 파사드", baseline: "TRUEDAN 기본 파사드", panel: "전체 기본 파사드",
      application: "전면 전체", detail: "전면 파사드 전체를 한 장으로 교체·검수합니다.", action: "전체 파사드 교체",
    }),
    "SEOUL-2F-INFORMATION-BOOTH-01": Object.freeze({
      unit: "인포메이션 부스 전면", baseline: "인포메이션 부스 기본 화면", panel: "부스 기본 전면",
      application: "부스 전면 1개 면", detail: "현장 사진 기준 인포메이션 부스의 전면 화면을 교체·검수합니다.", action: "부스 전면 교체",
    }),
    "SEOUL-2F-TRAIN-DEPARTURE-DISPLAY-01": Object.freeze({
      unit: "열차행선안내 화면", baseline: "행선안내기 기본 화면", panel: "행선안내기 기본 화면",
      application: "상부 디스플레이 1개 면", detail: "인포메이션 부스 상부의 열차행선안내 디스플레이 화면을 교체·검수합니다.", action: "행선안내 화면 교체",
    }),
    "SEOUL-2F-GUIDE-BOARD-01": Object.freeze({
      unit: "좌측 세로 안내게시판 1", baseline: "안내게시판 1 기본 화면", panel: "안내게시판 1 기본 화면",
      application: "세로 게시판 1개 면", detail: "인포메이션 부스 좌측 첫 번째 세로 안내게시판 화면을 교체·검수합니다.", action: "게시판 1 화면 교체",
    }),
    "SEOUL-2F-GUIDE-BOARD-02": Object.freeze({
      unit: "좌측 세로 안내게시판 2", baseline: "안내게시판 2 기본 화면", panel: "안내게시판 2 기본 화면",
      application: "세로 게시판 1개 면", detail: "인포메이션 부스 좌측 두 번째 세로 안내게시판 화면을 교체·검수합니다.", action: "게시판 2 화면 교체",
    }),
    "SEOUL-2F-INFORMATION-TV-01": Object.freeze({
      unit: "인포메이션 우측 TV 화면", baseline: "우측 TV 기본 화면", panel: "우측 TV 기본 화면",
      application: "TV 화면 1개 면", detail: "현장 사진 오른쪽에 일부 보이는 인포메이션 TV 화면을 교체·검수합니다.", action: "TV 화면 교체",
    }),
  });
  const appAssetPresentation = (slot) => isAppAssetSlot(slot)
    ? appAssetPresentationById[slot?.target_asset_id] || null
    : null;
  const originalLabel = (slot) => isF02wl072FrameSlot(slot)
    ? "VWorld 기본 프레임 컬러"
    : appAssetPresentation(slot)?.baseline || (isAppAssetSlot(slot) ? "기본 이미지" : "VWorld 원본");
  const restoreDestination = (slot) => `${originalLabel(slot)}${isAppAssetSlot(slot) ? "로" : "으로"}`;
  const slotUnitLabel = (slot) => isF02wl072FrameSlot(slot)
    ? "상단 간판 프레임 컬러"
    : appAssetPresentation(slot)?.unit
      || (slot.slot_level === "uv_surface" ? "파사드 사진" : "원본 이미지");
  const slotBaselineLabel = (slot) => isF02wl072FrameSlot(slot)
    ? "기본 프레임 컬러"
    : appAssetPresentation(slot)?.baseline || (isAppAssetSlot(slot) ? "기본 이미지" : "현재 원본");
  const slotBaselinePanelLabel = (slot) => isF02wl072FrameSlot(slot)
    ? "기본 프레임 컬러 샘플"
    : appAssetPresentation(slot)?.panel || (isAppAssetSlot(slot) ? "기본 이미지" : "실제 면 비율 미리보기");
  const slotBaselineDestination = (slot) => isAppAssetSlot(slot)
    ? `${slotBaselineLabel(slot)}로`
    : "원본으로";
  const slotApplicationLabel = (slot) => isF02wl072FrameSlot(slot)
    ? `${Number(slot.surface_count || 1)}개 프레임 면 공동 적용`
    : appAssetPresentation(slot)?.application
      || (Number(slot.surface_count || 1) > 1 ? `${Number(slot.surface_count)}개 면에 공동 적용` : "1개 면");
  const slotDetailCopy = (slot) => isF02wl072FrameSlot(slot)
    ? "상단 간판의 위·좌·우 프레임 6개 면을 단색 이미지 한 장으로 함께 교체·검수합니다."
    : appAssetPresentation(slot)?.detail || "이 사진 영역만 교체·검수합니다.";
  const replacementActionLabel = (slot) => isF02wl072FrameSlot(slot)
    ? "프레임 컬러 교체"
    : appAssetPresentation(slot)?.action || "이 사진 교체";
  const replacementInstruction = (slot, width, height) => isF02wl072FrameSlot(slot)
    ? `${width} × ${height}px 단색 컬러 샘플을 등록하세요. 이미지 비율은 실제 면 크기와 무관합니다.`
    : `실제 면 비율에 맞춘 ${width} × ${height}px 파일을 등록하세요.`;
  const positive = (value) => Number.isFinite(Number(value)) && Number(value) > 0;
  const replacementCanvasDimensions = (slot) => {
    const hasReplacementCanvas = positive(slot?.replacement_canvas_width_px) && positive(slot?.replacement_canvas_height_px);
    return {
      width: hasReplacementCanvas ? Number(slot.replacement_canvas_width_px) : Number(slot?.crop_width_px),
      height: hasReplacementCanvas ? Number(slot.replacement_canvas_height_px) : Number(slot?.crop_height_px),
    };
  };
  const hasSeparateReplacementCanvas = (slot) => {
    const dimensions = replacementCanvasDimensions(slot);
    return dimensions.width !== Number(slot?.crop_width_px) || dimensions.height !== Number(slot?.crop_height_px);
  };
  const replacementMatchesCanvas = (slot, version) => {
    if (!version) return false;
    const dimensions = replacementCanvasDimensions(slot);
    return Number(version.replacement_width_px) === dimensions.width
      && Number(version.replacement_height_px) === dimensions.height;
  };
  const replacementAspect = (slot) => {
    const dimensions = replacementCanvasDimensions(slot);
    return `${dimensions.width}/${dimensions.height}`;
  };
  const hasExactSurfaceDimensions = (slot) => positive(slot?.surface_width_m) && positive(slot?.surface_height_m);
  const ui = {
    authGate: $("#authGate"), authMessage: $("#authMessage"), workspace: $("#workspace"),
    currentUser: $("#currentUser"), syncState: $("#syncState"), stats: $("#stats"),
    stationMap: $("#stationMap"), mapPane: $("#mapPane"), fullMapLink: $("#fullMapLink"), mapSelection: $("#mapSelection"), gallery: $("#gallery"),
    station: $("#station"), workbenchEyebrow: $("#workbenchEyebrow"), workbenchTitle: $("#workbenchTitle"),
    search: $("#search"), floor: $("#floor"), klass: $("#klass"), status: $("#replacement-status"), managementTarget: $("#management-target"), sort: $("#sort"),
    originalDialog: $("#originalDialog"), originalContent: $("#originalContent"), replaceDialog: $("#replaceDialog"),
    replaceOriginal: $("#replaceOriginal"), replaceOriginalSpec: $("#replaceOriginalSpec"),
    replacementFile: $("#replacementFile"), replacementPreview: $("#replacementPreview"), replacementEmpty: $("#replacementEmpty"),
    replacementSpec: $("#replacementSpec"), replacementStore: $("#replacementStore"), replacementNote: $("#replacementNote"),
    replacementMessage: $("#replacementMessage"), saveReplacement: $("#saveReplacement"), toast: $("#toast"),
  };

  let allSlots = [];
  let slots = [];
  let manifests = [];
  let objects = [];
  let objectByKey = new Map();
  let slotByKey = new Map();
  let manifest = {};
  let currentSiteId = new URLSearchParams(location.search).get("site") || "S202103";
  let currentProfile = null;
  let selectedSlot = null;
  let selectedFile = null;
  let selectedFileDimensions = null;
  let selectedObjectKey = "";
  let mapReady = false;
  let mapFocusRequestId = 0;
  let pendingMapFocusTimer = null;
  let toastTimer = null;
  let remoteRefreshTimer = null;
  const collaboration = { workItems: new Map(), replacements: [], latest: new Map(), approved: new Map(), counts: new Map(), profiles: new Map() };

  try {
    await collabApi.ensurePublicSession();
    currentProfile = await collabApi.loadProfile();
    if (currentProfile.membership_state !== "active") {
      await collabApi.ensurePublicSession(true);
      currentProfile = await collabApi.loadProfile();
    }
  } catch (error) {
    bootstrapError(`공개 작업대를 열지 못했습니다: ${error.message}`);
    return;
  }

  ui.authGate.hidden = true;
  ui.workspace.hidden = false;
  ui.currentUser.textContent = `${currentProfile.display_name || "공개 작업자"} · 자동 익명 편집`;
  setSync("Supabase 연결 중", "loading");

  try {
    const dataset = await collabApi.loadObjectWorkbench(currentSiteId);
    allSlots = dataset.slots;
    manifests = dataset.manifests || [dataset.manifest].filter(Boolean);
    configureStation(currentSiteId, false);
  } catch (error) {
    setSync("카탈로그 로드 실패", "error");
    ui.gallery.innerHTML = `<div class="empty">${esc(error.message)}</div>`;
    return;
  }

  populateFilters();
  bindEvents();
  await loadCollaboration();
  render();
  setSync("실시간 동기화", "ready");
  collabApi.subscribeObjectWorkbench(scheduleRemoteRefresh);

  function bootstrapError(message) {
    ui.authMessage.textContent = message;
    ui.authMessage.className = "error";
  }

  function setSync(message, state = "") {
    ui.syncState.textContent = message;
    ui.syncState.className = `sync-state ${state}`;
  }

  function buildObjects(rows) {
    const grouped = new Map();
    for (const slot of rows) {
      if (!grouped.has(slot.object_key)) grouped.set(slot.object_key, []);
      grouped.get(slot.object_key).push(slot);
    }
    return [...grouped.entries()].map(([key, objectSlots]) => {
      objectSlots.sort((a, b) => Number(a.slot_index) - Number(b.slot_index));
      const primary = objectSlots[0];
      const label = primary.object_label || primary.model_name || `개체 ${key.slice(-10)}`;
      return {
        key,
        label,
        primary,
        slots: objectSlots,
        floor: primary.floor || "미연결",
        model: primary.model_name || "",
        klass: primary.class_code || "",
        tdId: primary.td_id || "",
        priority: objectSlots.map((slot) => slot.replacement_priority).sort((a, b) => (priorityOrder[a] ?? 9) - (priorityOrder[b] ?? 9))[0],
        searchText: JSON.stringify([label, key, primary.td_id, primary.model_name, primary.class_code, ...objectSlots.flatMap((slot) => [slot.slot_alias, slot.ocr_text])]).toLowerCase(),
      };
    });
  }

  function populateFilters() {
    setOptions(ui.floor, "층 전체", [...new Set(objects.map((object) => object.floor))].sort(floorCompare));
    setOptions(ui.klass, "분류 전체", [...new Set(objects.map((object) => object.klass).filter(Boolean))].sort());
    const requestedFloor = new URLSearchParams(location.search).get("floor");
    if (requestedFloor && [...ui.floor.options].some((option) => option.value === requestedFloor)) ui.floor.value = requestedFloor;
  }

  function setOptions(element, label, values) {
    element.innerHTML = `<option value="">${label}</option>${values.map((value) => `<option value="${esc(value)}">${esc(value)}</option>`).join("")}`;
  }

  function floorCompare(a, b) {
    const ai = floorOrder.indexOf(a);
    const bi = floorOrder.indexOf(b);
    return (ai < 0 ? 98 : ai) - (bi < 0 ? 98 : bi) || String(a).localeCompare(String(b), "ko");
  }

  function bindEvents() {
    ui.station.addEventListener("change", () => {
      const url = new URL(location.href);
      url.searchParams.set("site", ui.station.value);
      location.assign(url);
    });
    for (const element of [ui.search, ui.floor, ui.klass, ui.status, ui.managementTarget, ui.sort]) {
      element.addEventListener(element === ui.search ? "input" : "change", render);
    }
    ui.gallery.addEventListener("click", handleAction);
    ui.originalContent.addEventListener("click", handleAction);
    ui.replacementFile.addEventListener("change", inspectReplacementFile);
    ui.saveReplacement.addEventListener("click", saveReplacement);
    window.addEventListener("message", (event) => {
      if (event.origin !== location.origin || event.source !== ui.stationMap.contentWindow) return;
      if (event.data?.type === "station-one:catalog-map-ready") {
        mapReady = true;
        if (selectedSlot) sendMapFocus(selectedSlot);
      }
      if (event.data?.type === "station-one:catalog-focus-applied") {
        mapReady = true;
        if (Number(event.data.requestId) !== mapFocusRequestId) return;
        clearTimeout(pendingMapFocusTimer);
        pendingMapFocusTimer = null;
        ui.mapSelection.classList.add("is-located");
        const detail = ui.mapSelection.querySelector("small");
        if (detail) detail.textContent = selectedSlot?.source_kind === "app_asset"
          ? "지도 이동 완료 · 등록된 구조물의 실제 위치로 이동했습니다."
          : "지도 이동 완료 · 선택 개체를 청록색으로 표시했습니다.";
      }
    });
    ui.stationMap.addEventListener("load", () => {
      mapReady = true;
      if (selectedSlot) focusMap(selectedSlot, false);
    });
    mapReady = Boolean(ui.stationMap.contentWindow && ui.stationMap.contentDocument?.readyState !== "loading");
    document.addEventListener("click", (event) => {
      const close = event.target.closest("[data-close-dialog]");
      if (close) document.getElementById(close.dataset.closeDialog)?.close();
    });
  }

  function configureStation(siteId, updateUrl = true) {
    currentSiteId = siteId === "S201801" ? "S201801" : "S202103";
    manifest = manifests.find((row) => row.site_id === currentSiteId) || {
      site_id: currentSiteId,
      site_name: currentSiteId === "S201801" ? "대전역KTX" : "서울역KTX",
    };
    slots = allSlots.filter((row) => (row.site_id || "S202103") === currentSiteId);
    objects = buildObjects(slots);
    objectByKey = new Map(objects.map((object) => [object.key, object]));
    slotByKey = new Map(slots.map((slot) => [slot.slot_key, slot]));
    selectedSlot = null;
    selectedObjectKey = "";
    mapReady = false;
    ui.station.value = currentSiteId;
    const displayName = currentSiteId === "S201801" ? "대전역" : "서울역";
    ui.workbenchEyebrow.textContent = `${currentSiteId} · OBJECT TEXTURE WORKBENCH`;
    ui.workbenchTitle.textContent = `${displayName} 공간 이미지 갱신`;
    ui.mapPane.setAttribute("aria-label", `VWorld ${displayName} 실내 3D 지도`);
    ui.stationMap.title = `VWorld ${displayName} 3D 위치 확인`;
    ui.stationMap.src = `/app/?embed=catalog&site=${encodeURIComponent(currentSiteId)}`;
    ui.fullMapLink.href = `/app/?site=${encodeURIComponent(currentSiteId)}`;
    ui.mapSelection.innerHTML = `<span>SELECT AN OBJECT</span><strong>${displayName} 개체를 선택하세요</strong><small>선택 즉시 해당 층·좌표로 이동합니다.</small>`;
    ui.mapSelection.className = "map-selection";
    if (updateUrl) {
      const url = new URL(location.href);
      url.searchParams.set("site", currentSiteId);
      history.replaceState(null, "", url);
      populateFilters();
      render();
    }
  }

  async function handleAction(event) {
    const action = event.target.closest("[data-action]");
    if (!action) return;
    const slot = slotByKey.get(action.dataset.slot);
    if (!slot) return;
    if (action.dataset.action === "focus") focusMap(slot);
    if (action.dataset.action === "toggle-management") {
      const isTarget = Boolean(action.checked);
      await runAction(
        () => collabApi.setObjectSlotManagementTarget(slot.slot_key, isTarget),
        isTarget ? "관리대상 사진으로 지정했습니다." : "관리대상에서 제외했습니다.",
      );
    }
    if (action.dataset.action === "original") await openOriginal(slot);
    if (action.dataset.action === "replace") {
      const work = collaboration.workItems.get(slot.slot_key);
      if (work?.assignee_id !== currentProfile.id) {
        try {
          await collabApi.claimObjectSlot(slot.slot_key);
          await loadCollaboration();
        } catch (error) {
          showToast(error.message);
          return;
        }
      }
      openReplacement(slot);
    }
    if (action.dataset.action === "claim") await runAction(() => collabApi.claimObjectSlot(slot.slot_key), "내 담당 사진으로 열었습니다.");
    if (action.dataset.action === "advance") {
      const work = collaboration.workItems.get(slot.slot_key);
      const next = work?.status === "in_progress" ? "review" : "in_progress";
      await runAction(() => collabApi.setObjectSlotStatus(slot.slot_key, next), `${statusLabels[next]} 상태로 변경했습니다.`);
    }
    if (action.dataset.action === "approve" || action.dataset.action === "reject") {
      const latest = collaboration.latest.get(slot.slot_key);
      if (!latest || latest.review_status !== "submitted") {
        showToast("현재 검수할 수 있는 교체본이 없습니다.");
        return;
      }
      const decision = action.dataset.action === "approve" ? "approved" : "rejected";
      if (decision === "approved" && !replacementMatchesCanvas(slot, latest)) {
        const expected = replacementCanvasDimensions(slot);
        showToast(`이전 규격 교체본입니다. ${expected.width} × ${expected.height}px로 다시 등록해 주세요.`);
        return;
      }
      let note = "";
      if (decision === "approved") {
        if (!window.confirm(`${slot.slot_alias || slot.object_label} 교체본을 승인 확정하시겠습니까?`)) return;
      } else {
        const reason = window.prompt("반려 사유를 입력해 주세요. (선택 사항)", "");
        if (reason === null) return;
        note = reason;
      }
      action.disabled = true;
      const succeeded = await runAction(
        () => collabApi.reviewObjectSlotReplacement(latest.id, decision, note),
        decision === "approved" ? "교체본을 승인 확정했습니다." : "교체본을 반려했습니다.",
      );
      if (succeeded && ui.originalDialog.open) ui.originalDialog.close();
      else action.disabled = false;
    }
    if (action.dataset.action === "restore-original") {
      const activeApproved = collaboration.approved.get(slot.slot_key);
      if (!activeApproved) {
        showToast("현재 적용 중인 승인 이미지가 없습니다.");
        return;
      }
      const label = slot.slot_alias || slot.object_label;
      const restoreTarget = originalLabel(slot);
      if (!window.confirm(`${label}에 적용된 승인 이미지를 해제하고 ${restoreDestination(slot)} 복원하시겠습니까?\n\n등록 이력과 파일은 삭제되지 않습니다.`)) return;
      action.disabled = true;
      const succeeded = await runAction(
        () => collabApi.restoreObjectSlotOriginal(slot.slot_key, `카탈로그에서 ${restoreTarget} 복원`),
        `승인 이미지를 해제하고 ${restoreDestination(slot)} 복원했습니다.`,
      );
      if (succeeded && ui.originalDialog.open) ui.originalDialog.close();
      else action.disabled = false;
    }
    if (action.dataset.action === "download-crop") await downloadCrop(slot, true);
    if (action.dataset.action === "download-raw-crop") await downloadCrop(slot, false);
  }

  async function runAction(operation, message) {
    try {
      setSync("저장 중", "loading");
      await operation();
      await loadCollaboration();
      showToast(message);
      return true;
    } catch (error) {
      showToast(error.message);
      return false;
    } finally {
      setSync("실시간 동기화", "ready");
    }
  }

  function filteredObjects() {
    const query = ui.search.value.trim().toLowerCase();
    return objects.flatMap((object) => {
      if (ui.floor.value && object.floor !== ui.floor.value) return [];
      if (ui.klass.value && object.klass !== ui.klass.value) return [];
      let visibleSlots = object.slots;
      if (ui.managementTarget.value) {
        const target = ui.managementTarget.value === "target";
        visibleSlots = visibleSlots.filter((slot) => Boolean(collaboration.workItems.get(slot.slot_key)?.is_management_target) === target);
        if (!visibleSlots.length) return [];
      }
      if (ui.status.value) {
        visibleSlots = visibleSlots.filter((slot) => {
          const work = collaboration.workItems.get(slot.slot_key) || { status: "pending", assignee_id: null };
          return ui.status.value === "mine" ? work.assignee_id === currentProfile.id : work.status === ui.status.value;
        });
        if (!visibleSlots.length) return [];
      }
      if (query && !object.searchText.includes(query)) return [];
      return [{ ...object, primary: visibleSlots[0], slots: visibleSlots }];
    });
  }

  function render() {
    const rows = sortObjects(filteredObjects());
    renderStats(rows);
    if (!rows.length) {
      ui.gallery.innerHTML = '<div class="empty">조건에 맞는 연결 개체가 없습니다.</div>';
      return;
    }
    const groups = new Map();
    for (const object of rows) {
      if (!groups.has(object.floor)) groups.set(object.floor, []);
      groups.get(object.floor).push(object);
    }
    ui.gallery.innerHTML = [...groups.entries()].sort(([a], [b]) => floorCompare(a, b)).map(([floor, floorObjects]) => `
      <section class="floor-section">
        <h2 class="floor-heading"><b>${esc(floor)}</b><span>실제 위치가 가까운 개체 순</span><em>${floorObjects.length.toLocaleString()}개 개체</em></h2>
        <div class="object-list">${floorObjects.map((object, index) => objectMarkup(object, index + 1)).join("")}</div>
      </section>`).join("");
  }

  function sortObjects(rows) {
    if (ui.sort.value === "name") return [...rows].sort((a, b) => a.label.localeCompare(b.label, "ko"));
    if (ui.sort.value === "priority") return [...rows].sort((a, b) => (priorityOrder[a.priority] ?? 9) - (priorityOrder[b.priority] ?? 9) || a.label.localeCompare(b.label, "ko"));
    return [...rows].sort((a, b) => floorCompare(a.floor, b.floor) || Number(a.primary.north_m) - Number(b.primary.north_m) || Number(a.primary.east_m) - Number(b.primary.east_m));
  }

  function renderStats(rows) {
    const visibleSlots = rows.flatMap((object) => object.slots);
    const review = visibleSlots.filter((slot) => collaboration.workItems.get(slot.slot_key)?.status === "review").length;
    const approved = visibleSlots.filter((slot) => collaboration.workItems.get(slot.slot_key)?.status === "approved").length;
    const managed = visibleSlots.filter((slot) => collaboration.workItems.get(slot.slot_key)?.is_management_target).length;
    ui.stats.innerHTML = [
      pill("표시 개체", rows.length), pill("사진 교체 단위", visibleSlots.length), pill("전체 개체", objects.length),
      pill("관리대상", managed), pill("검수 대기", review), pill("승인", approved, "saved"),
    ].join("");
  }

  function pill(label, value, className = "") {
    return `<span class="pill ${className}">${label} <b>${Number(value || 0).toLocaleString()}</b></span>`;
  }

  function objectMarkup(object, sequence) {
    const selected = object.key === selectedObjectKey;
    const slotStatuses = object.slots.map((slot) => collaboration.workItems.get(slot.slot_key)?.status || "pending");
    const summaryStatus = slotStatuses.includes("review") ? "review" : slotStatuses.includes("in_progress") ? "in_progress" : slotStatuses.every((status) => status === "approved") ? "approved" : "pending";
    return `<article class="object-card status-${summaryStatus} ${selected ? "is-selected" : ""}" data-object="${esc(object.key)}">
      <button class="object-head" type="button" data-action="focus" data-slot="${object.primary.slot_key}">
        <span class="sequence">${sequence}</span><span class="object-type">${esc(object.klass || "3D")}</span>
        <span><strong>${esc(object.label)}</strong><small>${esc(object.model || "모델명 없음")} · ${object.slots.length}개 사진 교체 단위</small></span>
        <span class="locate-label">지도에서 보기 <b>→</b></span>
      </button>
      <div class="slot-list">${object.slots.map((slot, index) => slotMarkup(slot, index + 1)).join("")}</div>
      <details class="technical"><summary>개체 메타데이터</summary><pre>${isAppAssetSlot(object.primary)
        ? `층          ${esc(object.floor)}\n대상 자산   ${esc(object.primary.target_asset_id || "-")}\n대상 면     ${esc(object.primary.target_surface_id || "-")}\n실제 크기   ${formatNumber(object.primary.surface_width_m)} × ${formatNumber(object.primary.surface_height_m)}m\n개체 키     ${esc(object.key)}\n좌표 ENU    E ${formatNumber(object.primary.east_m)} · N ${formatNumber(object.primary.north_m)} · U ${formatNumber(object.primary.up_m)}`
        : `층          ${esc(object.floor)}\nTD_ID       ${esc(object.tdId || "-")}\n개체 키     ${esc(object.key)}${hasExactSurfaceDimensions(object.primary) ? `\n실제 크기   ${formatNumber(object.primary.surface_width_m)} × ${formatNumber(object.primary.surface_height_m)}m` : ""}\n좌표 ENU    E ${formatNumber(object.primary.east_m)} · N ${formatNumber(object.primary.north_m)} · U ${formatNumber(object.primary.up_m)}\n원본 타일   ${esc(object.primary.tile)} · LOD ${esc(object.primary.tile_depth)}`}</pre></details>
    </article>`;
  }

  function slotMarkup(slot, index) {
    const work = collaboration.workItems.get(slot.slot_key) || { status: "pending", assignee_id: null };
    const latest = collaboration.latest.get(slot.slot_key);
    const activeApproved = collaboration.approved.get(slot.slot_key);
    const count = collaboration.counts.get(slot.slot_key) || 0;
    const assignee = collaboration.profiles.get(work.assignee_id);
    const isMine = work.assignee_id === currentProfile.id;
    const isManaged = Boolean(work.is_management_target);
    const canReview = latest?.review_status === "submitted";
    const needsCanvasReregistration = canReview && !replacementMatchesCanvas(slot, latest);
    const unitType = slotUnitLabel(slot);
    const replacementDimensions = replacementCanvasDimensions(slot);
    return `<section class="texture-slot ${latest ? "is-saved" : ""} ${isManaged ? "is-managed" : ""} ${canReview ? "is-reviewable" : ""}">
      <button class="slot-preview" type="button" data-action="focus" data-slot="${slot.slot_key}" title="왼쪽 지도에서 위치 확인">
        ${catalogPreviewMarkup(slot)}<span class="slot-number">${esc(slot.slot_alias || `SLOT ${index}`)}</span><span class="work-badge ${work.status}">${statusLabels[work.status] || work.status}</span>
      </button>
      <div class="slot-info">
        <div class="slot-title-row"><span class="slot-title-copy"><strong>${esc(slot.slot_alias || `SLOT ${index}`)}</strong><span>${unitType} · 교체 ${replacementDimensions.width} × ${replacementDimensions.height}px</span></span><label class="management-check"><input type="checkbox" data-action="toggle-management" data-slot="${slot.slot_key}" ${isManaged ? "checked" : ""}><span>${isManaged ? "관리대상" : "관리대상 지정"}</span></label></div>
        <dl><dt>적용</dt><dd>${slotApplicationLabel(slot)}</dd><dt>담당</dt><dd>${assignee ? esc(assignee.display_name || assignee.email) : "미배정"}${isMine ? ' <b class="mine">· 나</b>' : ""}</dd><dt>교체</dt><dd>${activeApproved ? `${count}판 · 승인 반영 중` : latest?.review_status === "approved" ? `${count}판 · ${slotBaselineLabel(slot)} 복원` : latest ? `${count}판 · ${esc(reviewStatusLabels[latest.review_status] || latest.review_status)}` : "등록 전"}</dd></dl>
        ${canReview ? `<div class="slot-review-panel"><span><b>${needsCanvasReregistration ? "새 규격 재등록 필요" : "검수 대기"}</b><small>${needsCanvasReregistration ? `이전 ${latest.replacement_width_px}×${latest.replacement_height_px}px 교체본은 현재 규격으로 승인할 수 없습니다.` : "교체본을 확인하고 승인 여부를 결정하세요."}</small></span><div><button type="button" data-action="original" data-slot="${slot.slot_key}">비교 검수</button><button class="approve-action" type="button" data-action="${needsCanvasReregistration ? "replace" : "approve"}" data-slot="${slot.slot_key}">${needsCanvasReregistration ? "새 규격 재등록" : "승인 확정"}</button><button class="reject-action" type="button" data-action="reject" data-slot="${slot.slot_key}">반려</button></div></div>` : ""}
        <div class="slot-actions">
          <button type="button" data-action="focus" data-slot="${slot.slot_key}">위치</button>
          <button type="button" data-action="original" data-slot="${slot.slot_key}">${canReview ? "검수 상세" : isAppAssetSlot(slot) ? "기본·검수" : "원본·검수"}</button>
          <button type="button" data-action="${isMine ? "advance" : "claim"}" data-slot="${slot.slot_key}">${isMine ? (work.status === "in_progress" ? "검수 요청" : "작업 재개") : "작업 열기"}</button>
          <button class="replace-action" type="button" data-action="replace" data-slot="${slot.slot_key}">교체 등록</button>
          ${activeApproved ? `<button class="restore-action" type="button" data-action="restore-original" data-slot="${slot.slot_key}">${slotBaselineDestination(slot)} 복원</button>` : ""}
        </div>
      </div>
    </section>`;
  }

  function cropMarkup(slot, extraClass = "", aspect = `${slot.crop_width_px}/${slot.crop_height_px}`) {
    const spanU = Math.max(.000001, Number(slot.u_max) - Number(slot.u_min));
    const spanV = Math.max(.000001, Number(slot.v_max) - Number(slot.v_min));
    const style = `width:${100 / spanU}%;height:${100 / spanV}%;left:${-100 * Number(slot.u_min) / spanU}%;top:${-100 * Number(slot.v_min) / spanV}%`;
    return `<span class="texture-crop ${extraClass}" style="--slot-aspect:${aspect}"><img loading="lazy" src="${esc(slot.preview_url)}" alt="${esc(slot.object_label)} 개체 이미지 영역" style="${style}"></span>`;
  }

  function surfaceCropMarkup(slot, extraClass = "") {
    return cropMarkup(slot, extraClass, replacementAspect(slot));
  }

  function catalogPreviewMarkup(slot, extraClass = "") {
    const approved = collaboration.approved.get(slot.slot_key);
    if (!approved?.image_url) return surfaceCropMarkup(slot, extraClass);
    const label = approved.current_store_name || slot.object_label || slot.slot_alias || "승인 교체 이미지";
    return `<span class="texture-crop approved-preview ${extraClass}" style="--slot-aspect:${replacementAspect(slot)}">${replacementPreviewImageMarkup(slot, approved, approved.image_url, `${label} 승인 반영 이미지`, true)}</span>`;
  }

  function replacementPreviewImageMarkup(slot, version, url, label, lazy = false) {
    const cropStyle = legacyReplacementCropStyle(slot, version);
    const image = `<img ${lazy ? 'loading="lazy" ' : ""}src="${esc(url)}" alt="${esc(label)}"${cropStyle ? ` style="${cropStyle}"` : ""}>`;
    return cropStyle ? `<span class="legacy-replacement-crop">${image}</span>` : image;
  }

  function focusMap(slot, scrollCard = true) {
    const replacementDimensions = replacementCanvasDimensions(slot);
    selectedSlot = slot;
    selectedObjectKey = slot.object_key;
    ui.mapSelection.innerHTML = `<span>SELECTED PHOTO · ${esc(slot.floor)}</span><strong>${esc(slot.slot_alias || slot.object_label)}</strong><small>${esc(slot.model_name)} · 교체 ${replacementDimensions.width} × ${replacementDimensions.height}px · ${esc(slotUnitLabel(slot))}</small>`;
    ui.mapSelection.classList.add("is-active");
    ui.mapSelection.classList.remove("is-located");
    document.querySelectorAll(".object-card.is-selected").forEach((card) => card.classList.remove("is-selected"));
    const card = [...document.querySelectorAll(".object-card")].find((element) => element.dataset.object === slot.object_key);
    card?.classList.add("is-selected");
    if (scrollCard) card?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    sendMapFocus(slot);
  }

  function sendMapFocus(slot) {
    clearTimeout(pendingMapFocusTimer);
    const requestId = ++mapFocusRequestId;
    const replacementDimensions = replacementCanvasDimensions(slot);
    const placement = preferredSurfacePlacement(slot);
    const focusTarget = placement ? { ...slot, ...placement } : slot;
    const message = { type: "station-one:catalog-focus", requestId, focus: {
      floor: slot.floor, east: focusTarget.east_m, north: focusTarget.north_m, up: focusTarget.up_m,
      longitude: focusTarget.longitude, latitude: focusTarget.latitude, height: focusTarget.height_m,
      cameraHeading: focusTarget.camera_heading_deg,
      surfaceArea: Number(focusTarget.surface_width_m) * Number(focusTarget.surface_height_m) || slot.surface_area_m2,
      cropWidth: replacementDimensions.width,
      cropHeight: replacementDimensions.height,
      label: slot.slot_alias || slot.object_label, imageId: `SLOT-${slot.slot_key.slice(0, 8).toUpperCase()}`,
      model: slot.model_name, tdId: slot.td_id,
      sourceKind: slot.source_kind || "vworld_uv",
      targetAssetId: slot.target_asset_id || "",
      targetSurfaceId: slot.target_surface_id || "",
      surfaceWidth: focusTarget.surface_width_m,
      surfaceHeight: focusTarget.surface_height_m,
    } };
    const post = () => ui.stationMap.contentWindow?.postMessage(message, location.origin);
    post();
    // 카탈로그 데이터 로딩 중 iframe load 이벤트를 놓쳤을 때 한 번 더 전달한다.
    if (!mapReady) pendingMapFocusTimer = setTimeout(post, 700);
  }

  function preferredSurfacePlacement(slot) {
    if (!Array.isArray(slot?.surface_placements)) return null;
    const placements = slot.surface_placements.filter((placement) => {
      const rawValues = [
        placement?.longitude, placement?.latitude, placement?.height_m,
        placement?.camera_heading_deg, placement?.surface_width_m, placement?.surface_height_m,
      ];
      const values = rawValues.map(Number);
      return rawValues.every((value) => value !== null && value !== undefined && value !== "")
        && values.every(Number.isFinite)
        && values[4] > 0 && values[5] > 0;
    });
    return placements.find((placement) => placement?.is_primary === true)
      || placements[0]
      || null;
  }

  async function openOriginal(slot) {
    focusMap(slot, false);
    const work = collaboration.workItems.get(slot.slot_key) || { status: "pending" };
    const latest = collaboration.latest.get(slot.slot_key);
    const activeApproved = collaboration.approved.get(slot.slot_key);
    const assignee = collaboration.profiles.get(work.assignee_id);
    const canReview = latest?.review_status === "submitted";
    const needsCanvasReregistration = canReview && !replacementMatchesCanvas(slot, latest);
    const appAsset = isAppAssetSlot(slot);
    const replacementDimensions = replacementCanvasDimensions(slot);
    const separateCanvas = hasSeparateReplacementCanvas(slot);
    const frameStyle = `--slot-aspect:${replacementAspect(slot)}`;
    const baselineLabel = slotBaselineLabel(slot);
    let originalUrl = "";
    let replacementUrl = "";
    const [originalResult, replacementResult] = await Promise.allSettled([
      collabApi.signedOriginal(slot.original_storage_path),
      latest?.storage_path ? collabApi.signedReplacement(latest.storage_path) : Promise.resolve(""),
    ]);
    if (originalResult.status === "fulfilled") originalUrl = originalResult.value;
    if (replacementResult.status === "fulfilled") replacementUrl = replacementResult.value;
    const uvLeft = Number(slot.u_min) * 100;
    const uvTop = Number(slot.v_min) * 100;
    const uvWidth = (Number(slot.u_max) - Number(slot.u_min)) * 100;
    const uvHeight = (Number(slot.v_max) - Number(slot.v_min)) * 100;
    ui.originalContent.innerHTML = `<div class="original-layout">
      <div class="original-visuals">
        ${latest ? `<div class="review-compare"><section><span class="panel-label">${baselineLabel}${isF02wl072FrameSlot(slot) ? " · 컬러 샘플" : " · 실제 면 비율"}</span><div class="review-image-frame surface-ratio-frame" style="${frameStyle}">${surfaceCropMarkup(slot, "original-crop surface-ratio-crop")}</div></section><section><span class="panel-label">등록 교체본 · ${esc(reviewStatusLabels[latest.review_status] || latest.review_status)}</span><div class="review-image-frame replacement-review-image surface-ratio-frame" style="${frameStyle}">${replacementUrl ? replacementPreviewImageMarkup(slot, latest, replacementUrl, "등록된 교체 이미지") : "<span>교체본 미리보기를 불러오지 못했습니다.</span>"}</div></section></div>` : `<section><span class="panel-label">${slotBaselinePanelLabel(slot)}</span>${surfaceCropMarkup(slot, "original-crop surface-ratio-crop")}</section>${separateCanvas && !appAsset ? `<section><span class="panel-label">원본 UV 크롭 · ${slot.crop_width_px} × ${slot.crop_height_px}px</span>${cropMarkup(slot, "original-crop raw-crop")}</section>` : ""}`}
        ${appAsset ? "" : `<section><span class="panel-label">공유 아틀라스 안의 위치</span><div class="atlas-context"><span class="atlas-image-frame"><img src="${esc(slot.preview_url)}" alt="공유 텍스처 아틀라스"><i style="left:${uvLeft}%;top:${uvTop}%;width:${uvWidth}%;height:${uvHeight}%"></i></span></div></section>`}
      </div>
      <section class="original-info"><span class="eyebrow">PHOTO REPLACEMENT UNIT</span><h2>${esc(slot.slot_alias || slot.object_label)}</h2><p>${esc(slot.model_name)} · ${esc(slot.floor)} · ${slotDetailCopy(slot)}</p>
        ${canReview ? `<div class="review-decision"><span>${needsCanvasReregistration ? "RE-REGISTRATION REQUIRED" : "REVIEW REQUIRED"}</span><strong>${needsCanvasReregistration ? "이전 픽셀 규격의 교체본입니다" : "이 교체본을 검수해 주세요"}</strong><p>${needsCanvasReregistration ? `${latest.replacement_width_px} × ${latest.replacement_height_px}px 파일은 이 면의 현재 교체 규격으로 승인할 수 없습니다. ${replacementDimensions.width} × ${replacementDimensions.height}px로 다시 등록해 주세요.` : `왼쪽에서 ${slotBaselineLabel(slot)}와 등록 이미지를 비교한 뒤 확정합니다.`}</p><div><button class="approve-action" type="button" data-action="${needsCanvasReregistration ? "replace" : "approve"}" data-slot="${slot.slot_key}">${needsCanvasReregistration ? "새 규격으로 재등록" : "승인 확정"}</button><button class="reject-action" type="button" data-action="reject" data-slot="${slot.slot_key}">반려</button></div></div>` : activeApproved ? `<div class="review-result approved"><b>승인 반영 중${replacementMatchesCanvas(slot, activeApproved) ? "" : " · 기존 이미지 자동 보정"}</b><span>${formatDate(activeApproved.reviewed_at || activeApproved.created_at)}</span></div>` : latest ? `<div class="review-result ${esc(latest.review_status)}"><b>${latest.review_status === "approved" ? `${slotBaselineLabel(slot)} 복원` : esc(reviewStatusLabels[latest.review_status] || latest.review_status)}</b><span>${formatDate(latest.reviewed_at || latest.created_at)}</span></div>` : ""}
        <dl class="info-list"><dt>협업 상태</dt><dd><b>${statusLabels[work.status] || work.status}</b> · ${assignee ? esc(assignee.display_name || assignee.email) : "미배정"}</dd><dt>교체 단위</dt><dd>${slotUnitLabel(slot)}${Number(slot.surface_count || 1) > 1 ? ` · ${Number(slot.surface_count)}개 면 공동 적용` : ""}</dd><dt>교체 규격</dt><dd><b>${replacementDimensions.width} × ${replacementDimensions.height}px</b>${isF02wl072FrameSlot(slot) ? " · 단색 컬러 샘플" : separateCanvas ? " · 실제 면 비율" : ""}</dd>${!appAsset ? `<dt>원본 UV 크롭</dt><dd>${slot.crop_width_px} × ${slot.crop_height_px}px${separateCanvas ? " · 압축 저장된 원본" : ""}</dd>` : ""}${isF02wl072FrameSlot(slot) ? `<dt>적용 면적</dt><dd><b>${formatNumber(slot.surface_area_m2)}㎡</b> · 상단 2면 + 좌우 4면</dd>` : hasExactSurfaceDimensions(slot) ? `<dt>실제 면 크기</dt><dd><b>${formatNumber(slot.surface_width_m)} × ${formatNumber(slot.surface_height_m)}m</b></dd>` : ""}${appAsset ? `<dt>대상 자산</dt><dd>${esc(slot.target_asset_id || "-")} · ${esc(slot.target_surface_id || "-")}</dd>` : `<dt>원본 아틀라스</dt><dd>${slot.atlas_width_px} × ${slot.atlas_height_px}px · ${esc(slot.mime_type)}</dd><dt>UV 영역</dt><dd>${formatNumber(slot.u_min, 4)}, ${formatNumber(slot.v_min, 4)} → ${formatNumber(slot.u_max, 4)}, ${formatNumber(slot.v_max, 4)}</dd><dt>TD_ID</dt><dd>${esc(slot.td_id || "-")}</dd>`}<dt>최신 교체</dt><dd>${latest ? `${esc(latest.current_store_name || "명칭 미입력")} · ${formatDate(latest.created_at)} · ${esc(reviewStatusLabels[latest.review_status] || latest.review_status)}` : "없음"}</dd></dl>
        <div class="original-downloads"><button type="button" data-action="focus" data-slot="${slot.slot_key}">왼쪽 지도에서 위치 확인</button><button type="button" data-action="download-crop" data-slot="${slot.slot_key}">${isF02wl072FrameSlot(slot) ? "기본 컬러 PNG 저장" : appAsset ? `${slotBaselineLabel(slot)} PNG 저장` : separateCanvas ? `교체용 ${replacementDimensions.width}×${replacementDimensions.height} PNG` : "사진 PNG 저장"}</button>${separateCanvas && !appAsset ? `<button type="button" data-action="download-raw-crop" data-slot="${slot.slot_key}">원본 UV ${slot.crop_width_px}×${slot.crop_height_px} PNG</button>` : ""}${originalUrl ? `<a href="${esc(originalUrl)}" download>${appAsset ? `${slotBaselineLabel(slot)} 저장` : "원본 아틀라스 저장"}</a>` : ""}<button type="button" data-action="replace" data-slot="${slot.slot_key}">${replacementActionLabel(slot)}</button>${activeApproved ? `<button class="restore-action" type="button" data-action="restore-original" data-slot="${slot.slot_key}">승인본 해제 · ${slotBaselineDestination(slot)} 복원</button>` : ""}</div>
      </section>
    </div>`;
    ui.originalDialog.showModal();
  }

  function openReplacement(slot) {
    selectedSlot = slot;
    selectedFile = null;
    selectedFileDimensions = null;
    ui.replacementFile.value = "";
    ui.replacementPreview.removeAttribute("src");
    ui.replacementEmpty.hidden = false;
    const approved = collaboration.approved.get(slot.slot_key);
    const replacementDimensions = replacementCanvasDimensions(slot);
    const replacementFrame = ui.replacementPreview.closest(".compare-image");
    for (const frame of [ui.replaceOriginal, replacementFrame]) {
      frame?.classList.add("surface-ratio-frame");
      frame?.style.setProperty("--slot-aspect", replacementAspect(slot));
    }
    ui.replaceOriginal.innerHTML = catalogPreviewMarkup(slot, "dialog-crop");
    ui.replaceOriginalSpec.textContent = `${slot.slot_alias || "사진 교체 단위"} · 교체 ${replacementDimensions.width} × ${replacementDimensions.height}px${hasSeparateReplacementCanvas(slot) && !isAppAssetSlot(slot) ? ` · 원본 UV ${slot.crop_width_px} × ${slot.crop_height_px}px` : ""} · ${approved ? "현재 승인 반영본" : isAppAssetSlot(slot) ? slotBaselinePanelLabel(slot) : "실제 면 비율 미리보기"}`;
    ui.replacementSpec.textContent = "파일을 선택하세요.";
    ui.replacementStore.value = collaboration.latest.get(slot.slot_key)?.current_store_name || slot.object_label;
    ui.replacementNote.value = "";
    setValidation(replacementInstruction(slot, replacementDimensions.width, replacementDimensions.height));
    ui.saveReplacement.disabled = true;
    ui.originalDialog.open && ui.originalDialog.close();
    ui.replaceDialog.showModal();
  }

  async function inspectReplacementFile() {
    const file = ui.replacementFile.files?.[0];
    selectedFile = file || null;
    selectedFileDimensions = null;
    ui.saveReplacement.disabled = true;
    if (!file || !selectedSlot) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) return setValidation("PNG, JPEG 또는 WebP 파일을 선택하세요.", "error");
    if (file.size > 18 * 1024 * 1024) return setValidation("파일이 18MB를 넘습니다.", "error");
    const objectUrl = URL.createObjectURL(file);
    try {
      const dimensions = await readImageDimensions(objectUrl);
      selectedFileDimensions = dimensions;
      ui.replacementPreview.src = objectUrl;
      ui.replacementEmpty.hidden = true;
      ui.replacementSpec.textContent = `새 파일 ${dimensions.width} × ${dimensions.height}px · ${file.type} · ${formatBytes(file.size)}`;
      const expected = replacementCanvasDimensions(selectedSlot);
      if (dimensions.width !== expected.width || dimensions.height !== expected.height) {
        return setValidation(`규격이 다릅니다. 교체 이미지는 ${expected.width} × ${expected.height}px이어야 합니다.`, "error");
      }
      setValidation(isF02wl072FrameSlot(selectedSlot)
        ? "규격이 정확히 일치합니다. 선택한 컬러를 6개 프레임 면에 함께 등록할 수 있습니다."
        : appAssetPresentation(selectedSlot)
          ? "규격이 정확히 일치합니다. 해당 관리 면의 새 이미지로 등록할 수 있습니다."
          : "규격이 정확히 일치합니다. 이 사진의 새 버전으로 저장할 수 있습니다.", "ok");
      ui.saveReplacement.disabled = false;
    } catch {
      URL.revokeObjectURL(objectUrl);
      setValidation("이미지 크기를 확인할 수 없습니다.", "error");
    }
  }

  function readImageDimensions(url) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
      image.onerror = reject;
      image.src = url;
    });
  }

  async function saveReplacement() {
    if (!selectedSlot || !selectedFile || !selectedFileDimensions) return;
    ui.saveReplacement.disabled = true;
    ui.saveReplacement.textContent = "저장 중…";
    try {
      await collabApi.saveObjectSlotReplacement({
        slot: selectedSlot, file: selectedFile, dimensions: selectedFileDimensions,
        currentStoreName: ui.replacementStore.value, note: ui.replacementNote.value,
      });
      await loadCollaboration();
      ui.replaceDialog.close();
      showToast(`${selectedSlot.slot_alias || selectedSlot.model_name} 교체본을 저장하고 검수를 요청했습니다.`);
    } catch (error) {
      setValidation(error.message, "error");
      ui.saveReplacement.disabled = false;
    } finally {
      ui.saveReplacement.textContent = "교체본 저장·검수 요청";
    }
  }

  async function downloadCrop(slot, forReplacement = true) {
    try {
      const image = await loadImage(slot.preview_url);
      const canvas = document.createElement("canvas");
      const dimensions = forReplacement ? replacementCanvasDimensions(slot) : {
        width: Number(slot.crop_width_px),
        height: Number(slot.crop_height_px),
      };
      canvas.width = dimensions.width;
      canvas.height = dimensions.height;
      const context = canvas.getContext("2d");
      context.drawImage(image,
        Number(slot.u_min) * image.naturalWidth, Number(slot.v_min) * image.naturalHeight,
        (Number(slot.u_max) - Number(slot.u_min)) * image.naturalWidth,
        (Number(slot.v_max) - Number(slot.v_min)) * image.naturalHeight,
        0, 0, canvas.width, canvas.height);
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${slot.floor}-${slot.slot_alias || slot.model_name || "photo"}${forReplacement && hasSeparateReplacementCanvas(slot) ? "-replacement" : forReplacement ? "" : "-raw-uv"}.png`;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      showToast(isAppAssetSlot(slot)
        ? `${slotBaselineLabel(slot)}를 저장하지 못했습니다. 원본 파일 링크를 이용해 주세요.`
        : "사진 영역을 저장하지 못했습니다. 원본 아틀라스를 이용해 주세요.");
    }
  }

  function loadImage(url) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.crossOrigin = "anonymous";
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = url;
    });
  }

  function setValidation(message, type = "") {
    ui.replacementMessage.textContent = message;
    ui.replacementMessage.className = `validation-message ${type}`;
  }

  async function loadCollaboration() {
    const [data, approvedReplacements] = await Promise.all([
      collabApi.loadObjectCollaborationState(),
      collabApi.loadApprovedObjectSlotOverlays(currentSiteId),
    ]);
    collaboration.replacements = data.replacements || [];
    collaboration.workItems = new Map((data.workItems || []).map((entry) => [entry.slot_key, entry]));
    collaboration.profiles = new Map((data.profiles || []).map((entry) => [entry.id, entry]));
    collaboration.approved = new Map((approvedReplacements || []).map((entry) => [entry.slot_key, entry]));
    collaboration.latest.clear();
    collaboration.counts.clear();
    for (const entry of collaboration.replacements) {
      collaboration.counts.set(entry.slot_key, (collaboration.counts.get(entry.slot_key) || 0) + 1);
      const current = collaboration.latest.get(entry.slot_key);
      if (!current || new Date(entry.created_at) > new Date(current.created_at)) collaboration.latest.set(entry.slot_key, entry);
    }
    render();
  }

  async function reloadWorkbenchDataset() {
    const selectedSlotKey = selectedSlot?.slot_key || "";
    const selectedFloor = ui.floor.value;
    const selectedClass = ui.klass.value;
    const dataset = await collabApi.loadObjectWorkbench(currentSiteId);
    allSlots = dataset.slots;
    manifests = dataset.manifests || [dataset.manifest].filter(Boolean);
    manifest = manifests.find((row) => row.site_id === currentSiteId) || manifest;
    slots = allSlots.filter((row) => (row.site_id || "S202103") === currentSiteId);
    objects = buildObjects(slots);
    objectByKey = new Map(objects.map((object) => [object.key, object]));
    slotByKey = new Map(slots.map((slot) => [slot.slot_key, slot]));
    selectedSlot = selectedSlotKey ? slotByKey.get(selectedSlotKey) || null : null;
    selectedObjectKey = selectedSlot?.object_key || "";
    populateFilters();
    if ([...ui.floor.options].some((option) => option.value === selectedFloor)) ui.floor.value = selectedFloor;
    if ([...ui.klass.options].some((option) => option.value === selectedClass)) ui.klass.value = selectedClass;
  }

  function scheduleRemoteRefresh() {
    clearTimeout(remoteRefreshTimer);
    remoteRefreshTimer = setTimeout(async () => {
      try {
        await reloadWorkbenchDataset();
        await loadCollaboration();
        showToast("동료의 변경사항을 반영했습니다.");
      } catch (error) {
        setSync("실시간 갱신 실패", "error");
        showToast(error.message);
      }
    }, 450);
  }

  function showToast(message) {
    clearTimeout(toastTimer);
    ui.toast.textContent = message;
    ui.toast.classList.add("show");
    toastTimer = setTimeout(() => ui.toast.classList.remove("show"), 2600);
  }

  function formatNumber(value, digits = 2) {
    return finite(value) ? Number(value).toFixed(digits) : "-";
  }

  function formatDate(value) {
    if (!value) return "-";
    return new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
  }

  function formatBytes(value) {
    const bytes = Number(value || 0);
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  }
})();
