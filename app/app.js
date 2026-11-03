import { createPointReviewLayer } from './point-review-layer.js';
import { withDeadline, firstVisibleTile } from './map-load-lifecycle.js';
import { REVIEW_FLOORS } from '../src/route-review-core.js';
import { TRAIN_MATES, TRAIN_MATES_SURFACES, buildTrainMates, isTrainMatesSlot } from './seoul-train-mates.js';
import {
  createSeoulInformationZone,
  INFORMATION_FACILITIES,
  INFORMATION_FACILITY_IDS,
  INFORMATION_ZONE,
  RETIRED_INFORMATION_SHOP_SLOTS,
  informationFacilitySurfaceCenter,
  isInformationFacilityReplacement,
} from "./seoul-information-zone.js";
import { feedbackRetirementStyleConditions } from "./seoul-feedback-retirement.js";
import { isRetiredS38Slot } from "./seoul-s38-retirement.js";
import { pergolaRetirementStyleConditions, isRetiredPergolaSlot } from "./seoul-pergola-retirement.js";
import { loungeRetirementStyleConditions, isRetiredLoungeSlot } from "./seoul-lounge-retirement.js";
import { OPENING_GUARDRAIL, createOpeningGuardrail } from './seoul-opening-guardrail.js';
import { GTX_WALL_PHOTO, createGtxWallPhoto, gtxBarricadeRetirementStyleConditions } from './seoul-gtx-wall-photo.js';
import { loungeSignRetirementStyleConditions, isRetiredLoungeSignBodySlot } from './seoul-lounge-sign-retirement.js';
import { PHOTOBOOTH, createPhotobooth, photoboothSurface, isPhotoboothSlot } from './seoul-photobooth.js';
import { INFORMATION_CENTER, INFORMATION_CENTER_SURFACES, createInformationCenter,
  informationCenterSurface, informationCenterRetirementStyleConditions,
  isInformationCenterSlot, isRetiredInformationCenterSlot } from './seoul-information-center.js';
import { PLATFORM111, PLATFORM111_WINDOW, PLATFORM111_SURFACES, createPlatform111, createPlatform111Window, platform111VisibleOnFloor, platform111Surface, isPlatform111Slot } from './seoul-platform111.js';
import { isRetiredPlatform111Replacement } from './seoul-platform111-retirement.js';
import { createSeoulTruedan, TRUEDAN, TRUEDAN_FACADE } from "./seoul-truedan.js";
import { createSeoulVworldRetirementMask } from "./seoul-vworld-retirement.js";
import { createS11Booths, S11_ZONE, S11_SHOPS, S11_RETIRED_SIGN, s11ShopForSlot, s11ShopCenter } from './seoul-s11-booths.js';
import {
  createF02wl072UpperFrame,
  F02WL072_FRAME,
  isF02wl072FrameReplacement,
} from "./f02wl072-frame.js";
import { createCoplanarReplacementPrimitives } from "./approved-replacement-surface.js";
import FACADE_VIEW_CORRECTIONS from './facade-view-corrections.json' with { type: 'json' };
import { matchingLegacyReplacementCrop } from "../src/replacement-surface-contract.js";
import { toolkitMapData, mergeApprovedReplacements, addAssetEntities } from './toolkit-approved-layer.js';

const STATION_CONFIGS = Object.freeze({
  S202103: Object.freeze({
    siteId: "S202103", siteName: "서울역KTX", displayName: "서울역 KTX", englishName: "SEOUL STATION",
    stationCode: "SEOUL_KTX", dataDirectory: "station-one", mockVersion: "MOCK-2026.08-v1",
    defaultFloor: "1F", defaultZoneId: "Z-1F-01", defaultDate: "2026-07-18", defaultScenarioId: "SCN-KTX-25",
    tilesetUrl: "https://cdn.vworld.kr/TDServer/services/map4/7Iuk64K0/S202103/tileset.json",
    sourceUrl: "https://map.vworld.kr/map/dtkmap.do?mode=MAPD100",
    centerLongitudeRad: (2.2160299206408793 + 2.2161012304874745) / 2,
    centerLatitudeRad: (0.6553940761125844 + 0.6555059931687236) / 2,
    floorHeightMeters: { B2: 10, B1: 17, "1F": 27, "2F": 35, "3F": 42 },
    overlayTransform: { originX: 48, originY: 28, eastScale: 1.9, northScale: 3.05 },
    floorCamera: { centerX: 48, centerY: 29, radius: 170, range: 300 },
  }),
  S201801: Object.freeze({
    siteId: "S201801", siteName: "대전역KTX", displayName: "대전역 KTX", englishName: "DAEJEON STATION",
    stationCode: "DAEJEON_KTX", dataDirectory: "station-one-daejeon", mockVersion: "DJ-MOCK-2026.09-v1",
    defaultFloor: "2F", defaultZoneId: "DJ-Z-2F-01", defaultDate: "2026-09-02", defaultScenarioId: "DJ-SCN-KTX-20",
    tilesetUrl: "https://cdn.vworld.kr/TDServer/services/map4/7Iuk64K0/S201801/tileset.json",
    sourceUrl: "https://map.vworld.kr/map/dtkmap.do?mode=MAPD100",
    centerLongitudeRad: 127.43459 * Math.PI / 180,
    centerLatitudeRad: 36.33223 * Math.PI / 180,
    floorHeightMeters: { "1F": 55.69, "2F": 60.34, "3F": 63.48, "4F": 68.37, "5F": 71.66, RF: 74.33 },
    overlayTransform: { originX: 50, originY: 50, eastScale: 3.2, northScale: 4.5 },
    floorCamera: { centerX: 50, centerY: 48, radius: 225, range: 390 },
  }),
});
const REQUESTED_SITE_ID = new URLSearchParams(window.location.search).get("site") || "S202103";
const VWORLD_CONFIG = STATION_CONFIGS[REQUESTED_SITE_ID] || STATION_CONFIGS.S202103;
const SHOW_TRAIN_MATES = VWORLD_CONFIG.siteId === "S202103";
const TRAIN_MATES_ENTRY = SHOW_TRAIN_MATES && new URLSearchParams(window.location.search).get('asset') === 'train-mates';
const PLATFORM111_ENTRY = SHOW_TRAIN_MATES && new URLSearchParams(window.location.search).get('asset') === 'platform111';
const GTX_WALL_PHOTO_ENTRY = SHOW_TRAIN_MATES && new URLSearchParams(window.location.search).get('asset') === 'gtx-wall-photo';
const TRUEDAN_ENTRY = SHOW_TRAIN_MATES && new URLSearchParams(window.location.search).get("asset") === "truedan";
const INFORMATION_ZONE_ENTRY = SHOW_TRAIN_MATES
  && new URLSearchParams(window.location.search).get("asset") === "information-zone";
const S11_ENTRY = SHOW_TRAIN_MATES && new URLSearchParams(window.location.search).get('asset') === 's11-booths';
const APPROVED_REPLACEMENT_MASK_OFFSET_METERS = .055;
const APPROVED_REPLACEMENT_IMAGE_OFFSET_METERS = .065;
const DATA_BASE = location.port === "4173"
  ? `../public/data/${VWORLD_CONFIG.dataDirectory}`
  : `/data/${VWORLD_CONFIG.dataDirectory}`;

const EMBED_MODE = new URLSearchParams(window.location.search).get("embed") === "catalog";
const LOCAL_SCENE = new URLSearchParams(location.search).get('scene')==='local';
const EXPERIENCE = new URLSearchParams(location.search).get('experience')==='1';
const TOOLKIT = new URLSearchParams(location.search).get('toolkit')==='1';
// Consumer chrome must not depend on a successful upstream map connection.
if(EXPERIENCE||TOOLKIT)document.documentElement.dataset.experience='true';
let experienceFloors=null;
// Manager demo facade preview: in-memory only, never written to the jury snapshot.
let DEMO_FACADE=null;
if (EMBED_MODE) document.documentElement.dataset.embed = "catalog";
let CATALOG_FOCUS = readCatalogFocus();

// Keep the old v6 local trial placement intact; the photo revision starts at the
// verified stair-side default, not a stale per-browser conceptual placement.
const TRAIN_MATES_PLACEMENT_KEY = `station-one:train-mates-placement:${VWORLD_CONFIG.siteId}:escalator-flush-v8`;
let trainMatesPlacement = loadTrainMatesPlacement();
const trainMatesPlacementCamera = { east: -5, north: 5.5, headingDeg: 285, pitchDeg: -25, range: 42 };

const vworld = {
  viewer: null,
  tileset: null,
  overlays: null,
  assets: null,
  renovation: null,
  informationZone: null,
  s11Booths: null,
  informationCenter: null,
  photobooth: null,
  platform111: null,
  platform111Window: null,
  openingGuardrail: null,
  gtxWallPhoto: null,
  seoulRetirementMask: null,
  f02wl072Frame: null,
  catalogFocus: null,
  pointReview: null,
  replacementOverlays: null,
  approvedReportAssets: null,
  toolkitMapData: {assets: [], replacements: []},
  toolkitScene: null,
  replacementOverlayPrimitives: null,
  replacementOverlayPrimitiveRecords: [],
  approvedReplacements: [],
  replacementOverlaySubscription: null,
  replacementOverlayRefreshTimer: null,
  replacementOverlayError: null,
  localFrame: null,
  clickHandler: null,
  ready: false,
  lastFloor: null,
  rotating: false,
  rotateFrame: null,
  heading: 5.62,
  trainMatesBuilt: false,
  placingTrainMates: false,
  catalogFocusBuilt: false,
  catalogFocusApplied: false,
};
window.__STATION_ONE_VWORLD__ = vworld;
window.__STATION_ONE_VWORLD_CONFIG__ = VWORLD_CONFIG;
// Dev-only read access for tools/audit-facade-views.mjs (stripped from production builds).
if (import.meta.env.DEV) window.__STATION_ONE_FOCUS_AUDIT__ = {
  focus: () => CATALOG_FOCUS,
  center: () => catalogFocusPosition(window.Cesium),
  offset: () => catalogFocusCameraOffset(window.Cesium),
};

const state = {
  mode: "operations",
  floor: CATALOG_FOCUS?.floor || (REVIEW_FLOORS.includes(new URLSearchParams(location.search).get('floor')) ? new URLSearchParams(location.search).get('floor') : null)
    || (GTX_WALL_PHOTO_ENTRY ? GTX_WALL_PHOTO.floor : PLATFORM111_ENTRY ? PLATFORM111.floor : TRAIN_MATES_ENTRY ? TRAIN_MATES.floor : TRUEDAN_ENTRY ? TRUEDAN.floor : S11_ENTRY ? S11_ZONE.floor : INFORMATION_ZONE_ENTRY ? INFORMATION_ZONE.floor : VWORLD_CONFIG.defaultFloor),
  zoneId: VWORLD_CONFIG.defaultZoneId,
  date: VWORLD_CONFIG.defaultDate,
  hour: 18,
  scenarioId: VWORLD_CONFIG.defaultScenarioId,
  demandPct: 128,
  storyIndex: 0,
  playing: false,
  playTimer: null,
  layers: { crowd: true, shops: true, facilities: true, labels: true, renovation: true },
};

const STORY_STEPS_BY_SITE = Object.freeze({
  S202103: [
    { title: "01 · 공간을 공통 언어로", copy: "서울역의 층·구역 키에 열차, 유동, 시설, 점포 데이터를 연결합니다.", floor: "1F", zoneId: "Z-1F-01" },
    { title: "02 · 문제가 생기기 전에", copy: "KTX 지연과 환승 수요가 겹치는 시점을 찾아 1F 병목을 미리 보여줍니다.", floor: "1F", zoneId: "Z-1F-02" },
    { title: "03 · 대안을 비교하고 실행", copy: "2F 대기공간 분산과 안내인력 배치안을 적용해 예상 혼잡 변화를 비교합니다.", floor: "2F", zoneId: "Z-2F-02" },
    { title: "04 · 운영효과를 사업효과로", copy: "혼잡 완화와 함께 상권 기회, 시설 대응시간, 확산 가능성을 하나의 성과로 설명합니다.", floor: "2F", zoneId: "Z-2F-03" },
  ],
  S201801: [
    { title: "01 · 대전역 공간을 데이터 키로", copy: "VWorld 대전역 1F~RF 공간에 가상 구역·열차·시설·상권 데이터를 연결합니다.", floor: "2F", zoneId: "DJ-Z-2F-01" },
    { title: "02 · 환승 병목을 먼저 발견", copy: "도시철도 환승 수요와 KTX 대기 수요가 겹치는 2F·3F 혼잡을 미리 보여줍니다.", floor: "2F", zoneId: "DJ-Z-2F-03" },
    { title: "03 · 열차 지연을 공간 대응으로", copy: "경부선 열차 지연 시 3F 게이트 안내와 2F 맞이방 분산 효과를 비교합니다.", floor: "3F", zoneId: "DJ-Z-3F-02" },
    { title: "04 · 이동을 지역상권 기회로", copy: "환승 흐름과 가상 점포 매출을 함께 보고 로컬상품 공동행사 효과를 설명합니다.", floor: "2F", zoneId: "DJ-Z-2F-02" },
  ],
});
const storySteps = STORY_STEPS_BY_SITE[VWORLD_CONFIG.siteId] || STORY_STEPS_BY_SITE.S202103;

const ui = Object.fromEntries(
  [
    "app", "loading", "data-status", "data-version", "floor-list", "stage-kicker", "stage-title", "stage-subtitle",
    "freshness-badge", "zone-layer", "route-layer", "marker-layer", "zone-card-title", "zone-card-copy",
    "zone-card-crowd", "zone-card-occupancy", "zone-card-dwell", "timeline-play", "date-select", "hour-range",
    "time-output", "right-kicker", "right-context", "hero-value", "hero-label", "hero-delta", "metric-grid",
    "scenario-panel", "scenario-select", "demand-range", "demand-output", "scenario-result", "list-title",
    "list-count", "signal-list", "decision-copy", "decision-button", "story-step", "story-copy", "story-next", "toast",
    "cesium-container", "vworld-loading", "vworld-status-title", "vworld-status-copy", "vworld-source-state",
    "camera-home", "camera-trainmates", "place-trainmates", "rotate-trainmates-left", "rotate-trainmates-right",
    "camera-rotate", "placement-nav", "catalog-focus", "catalog-focus-title", "catalog-focus-meta", "catalog-focus-return",
    "brand-station-name", "station-card-icon", "station-card-title", "station-card-meta", "station-switcher", "catalog-launch", "data-provenance-copy", "vworld-source-meta", "loading-station-copy", "virtual-data-badge",
  ].map((id) => [id, document.getElementById(id)]),
);

let db;

function configureStationIdentity() {
  document.title = `STATION ONE · ${VWORLD_CONFIG.englishName}`;
  document.querySelector("meta[name='description']")?.setAttribute("content", `VWorld ${VWORLD_CONFIG.siteName} 실내 3D 공간 뷰어`);
  ui["brand-station-name"].textContent = `${VWORLD_CONFIG.englishName} · EXECUTIVE TWIN`;
  ui["station-card-icon"].textContent = VWORLD_CONFIG.siteId === "S201801" ? "D" : "S";
  ui["station-card-title"].textContent = VWORLD_CONFIG.displayName;
  ui["station-card-meta"].textContent = `VWORLD SITE · ${VWORLD_CONFIG.siteId}`;
  ui["station-switcher"].value = VWORLD_CONFIG.siteId;
  ui["catalog-launch"].href = `/catalog/?site=${encodeURIComponent(VWORLD_CONFIG.siteId)}`;
  ui["data-provenance-copy"].innerHTML = `공간: VWorld ${VWORLD_CONFIG.siteName} 실내 3D Tiles<br>운영·상권 수치: ${VWORLD_CONFIG.mockVersion} · 가상 데이터<br>개인·영상 원본: 미사용`;
  ui["vworld-source-meta"].textContent = `${VWORLD_CONFIG.siteName} · ${VWORLD_CONFIG.siteId} · 3D TILES`;
  ui["virtual-data-badge"].textContent = "가상 데이터 오버레이";
  document.querySelector(".stage")?.setAttribute("aria-label", `${VWORLD_CONFIG.siteName} 공간 의사결정 화면`);
  ui["cesium-container"]?.setAttribute("aria-label", `VWorld ${VWORLD_CONFIG.siteName} 실내 3D 지도`);
  const fallbackTitle = document.getElementById("map-title");
  const fallbackDescription = document.getElementById("map-description");
  if (fallbackTitle) fallbackTitle.textContent = `VWorld 연결 실패 시 표시되는 ${VWORLD_CONFIG.siteName} 대체 공간도`;
  if (fallbackDescription) fallbackDescription.textContent = `VWorld 3D Tiles를 불러오지 못했을 때 표시되는 ${VWORLD_CONFIG.siteName} 가상 데이터 기반 대체 화면`;
  const loadingCopy = ui.loading.querySelector("span");
  if (loadingCopy) loadingCopy.textContent = `VWorld ${VWORLD_CONFIG.siteName} 3D · 공간 이미지 카탈로그`;
  for (const id of ["camera-trainmates", "place-trainmates", "rotate-trainmates-left", "rotate-trainmates-right"]) {
    ui[id].hidden = !SHOW_TRAIN_MATES || new URLSearchParams(location.search).get('pointReview') === '1';
  }
}

init().catch((error) => {
  console.error(error);
  ui.loading.classList.add("is-error");
  ui.loading.querySelector("strong").textContent = "데이터를 불러오지 못했습니다";
  ui.loading.querySelector("span").textContent = `${error.message} · npm start로 실행했는지 확인하세요.`;
});

async function init() {
  configureStationIdentity();
  const [snapshot, floors, zones, adjacency, stores, sales, footfall, trains, facilities, alerts, scenarios] = await Promise.all([
    loadJson("json/realtime_snapshot.json"),
    loadCsv("csv/floors.csv"),
    loadCsv("csv/zones.csv"),
    loadCsv("csv/zone_adjacency.csv"),
    loadCsv("csv/stores.csv"),
    loadCsv("csv/monthly_sales.csv"),
    loadCsv("csv/hourly_footfall.csv"),
    loadCsv("csv/train_events.csv"),
    loadCsv("csv/facilities.csv"),
    loadCsv("csv/alerts.csv"),
    loadCsv("csv/scenarios.csv"),
  ]);

  db = {
    snapshot,
    floors,
    zones,
    adjacency,
    stores,
    sales,
    footfall,
    trains,
    facilities,
    alerts,
    scenarios,
    zoneById: new Map(zones.map((row) => [row.zone_id, row])),
    storeById: new Map(stores.map((row) => [row.store_id, row])),
    dates: [...new Set(footfall.map((row) => row.date))].sort(),
    periods: [...new Set(sales.map((row) => row.period))].sort(),
  };

  if (snapshot.meta.station_code !== VWORLD_CONFIG.stationCode) {
    throw new Error(`${VWORLD_CONFIG.siteId} 데이터팩과 역사 코드가 일치하지 않습니다.`);
  }
  if (!db.dates.includes(state.date)) state.date = db.dates.at(-1);
  if (!db.scenarios.some((scenario) => scenario.scenario_id === state.scenarioId)) state.scenarioId = db.scenarios[0]?.scenario_id;
  state.demandPct = Math.round((getScenario()?.demand_multiplier || 1) * 100);

  populateDateSelect();
  populateScenarioSelect();
  bindEvents();
  announceCatalogMapReady();
  render();
  configureCatalogFocusUi();

  ui["data-status"].textContent = "DATA READY";
  ui["data-version"].textContent = `${snapshot.meta.mock_version} · ${formatInt(footfall.length + sales.length)} rows`;
  ui["freshness-badge"].textContent = "VWORLD CONNECTING";
  requestAnimationFrame(() => ui.loading.classList.add("is-hidden"));
  initVWorldScene().catch(handleVWorldError);
  initializeApprovedReplacementOverlays();
}

async function loadJson(relativePath) {
  const response = await fetch(`${DATA_BASE}/${relativePath}`, { cache: "no-store" });
  if (!response.ok) throw new Error(`${relativePath} (${response.status})`);
  return response.json();
}

async function loadCsv(relativePath) {
  const response = await fetch(`${DATA_BASE}/${relativePath}`, { cache: "no-store" });
  if (!response.ok) throw new Error(`${relativePath} (${response.status})`);
  return parseCsv(await response.text());
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  const source = text.replace(/^\uFEFF/, "");

  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    if (quoted) {
      if (char === '"' && source[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell.replace(/\r$/, ""));
      if (row.some((value) => value !== "")) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }

  const headers = rows.shift() || [];
  return rows.map((values) => Object.fromEntries(headers.map((key, index) => [key, parseScalar(values[index] ?? "")])));
}

function parseScalar(value) {
  if (value === "") return null;
  if (/^-?\d+(\.\d+)?$/.test(value)) return Number(value);
  return value;
}

async function initVWorldScene() {
  if(LOCAL_SCENE&&!import.meta.env.DEV)throw Error('로컬 원본 모드는 개발 서버 전용입니다.');
  setMapLoadStage('renderer');
  ui["vworld-status-title"].textContent = `VWorld ${VWORLD_CONFIG.siteName} 3D 연결 중`;
  ui["vworld-status-copy"].textContent = `${VWORLD_CONFIG.siteId} · Cesium 3D Tiles 렌더러 초기화`;
  const Cesium = await withDeadline(waitForCesium(), 'renderer', 22000);

  const viewer = new Cesium.Viewer(ui["cesium-container"], {
    animation: false,
    timeline: false,
    baseLayerPicker: false,
    geocoder: false,
    homeButton: false,
    sceneModePicker: false,
    navigationHelpButton: false,
    fullscreenButton: false,
    infoBox: false,
    selectionIndicator: false,
    shouldAnimate: true,
    baseLayer: false,
    contextOptions: { webgl: { alpha: true, antialias: true } },
  });
  vworld.viewer = viewer;

  viewer.imageryLayers.removeAll();
  viewer.scene.globe.show = false;
  viewer.scene.skyBox.show = false;
  viewer.scene.sun.show = false;
  viewer.scene.moon.show = false;
  viewer.scene.skyAtmosphere.show = false;
  viewer.scene.fog.enabled = false;
  viewer.scene.backgroundColor = Cesium.Color.fromCssColorString("#02080e");
  viewer.scene.screenSpaceCameraController.minimumZoomDistance = 12;
  viewer.scene.screenSpaceCameraController.maximumZoomDistance = 1800;

  if(EXPERIENCE&&new URLSearchParams(location.search).get('map')==='schematic'){
    const {createSchematicScene}=await import('./schematic-scene.js');
    const hooks=await createSchematicScene(Cesium,viewer,state.floor);
    ui.app.dataset.vworldStatus='ready';
    const {createExperienceScene}=await import('./experience-scene.js');
    vworld.experience=createExperienceScene(Cesium,viewer,hooks);
    window.parent.postMessage({type:'station-one:catalog-map-ready',vworldReady:true,source:'schematic'},location.origin);
    return;
  }

  ui["vworld-status-copy"].textContent = `${VWORLD_CONFIG.siteId} · tileset.json과 FLOOR 속성 로딩`;
  setMapLoadStage('metadata');
  const tileOptions={
    maximumScreenSpaceError: 12,
    dynamicScreenSpaceError: true,
    preloadWhenHidden: false,
    cacheBytes: 256 * 1024 * 1024,
    maximumCacheOverflowBytes: 64 * 1024 * 1024,
  };
  const openTiles=url=>withDeadline(Cesium.Cesium3DTileset.fromUrl(url,tileOptions),'metadata',15000,late=>{if(!late.isDestroyed())late.destroy();});
  let tileset;
  try{tileset=await openTiles(LOCAL_SCENE?'/__local_scene/tileset.json':VWORLD_CONFIG.tilesetUrl);}
  catch(error){
    if(LOCAL_SCENE)throw error;
    ui['vworld-status-copy'].textContent='현재 네트워크에서 직접 연결 지연 · 서버 연결 경로 확인 중';
    tileset=await openTiles('/api/map-source/'+VWORLD_CONFIG.siteId+'/tileset.json');
  }
  tileset.showCreditsOnScreen = true;
  viewer.scene.primitives.add(tileset);
  vworld.tileset = tileset;

  const origin = Cesium.Cartesian3.fromRadians(
    VWORLD_CONFIG.centerLongitudeRad,
    VWORLD_CONFIG.centerLatitudeRad,
    0,
  );
  vworld.localFrame = Cesium.Transforms.eastNorthUpToFixedFrame(origin);
  vworld.overlays = new Cesium.CustomDataSource("STATION_ONE_SYNTHETIC_OVERLAYS");
  await viewer.dataSources.add(vworld.overlays);
  vworld.assets = new Cesium.CustomDataSource("STATION_ONE_REALISTIC_ASSETS");
  await viewer.dataSources.add(vworld.assets);
  vworld.catalogFocus = new Cesium.CustomDataSource("STATION_ONE_CATALOG_FOCUS");
  await viewer.dataSources.add(vworld.catalogFocus);
  vworld.replacementOverlays = new Cesium.CustomDataSource("STATION_ONE_APPROVED_IMAGE_OVERLAYS");
  await viewer.dataSources.add(vworld.replacementOverlays);
  vworld.approvedReportAssets = new Cesium.CustomDataSource('STATION_ONE_APPROVED_REPORT_ASSETS');
  await viewer.dataSources.add(vworld.approvedReportAssets);
  vworld.replacementOverlayPrimitives = viewer.scene.primitives.add(new Cesium.PrimitiveCollection());
  vworld.seoulRetirementMask = createSeoulVworldRetirementMask(Cesium, viewer, tileset, VWORLD_CONFIG.siteId);
  vworld.renovation = await createSeoulTruedan(
    Cesium, viewer, tileset, VWORLD_CONFIG.siteId, { maskManagedExternally: true },
  );
  vworld.informationZone = await createSeoulInformationZone(
    Cesium, viewer, tileset, VWORLD_CONFIG.siteId, { maskManagedExternally: true },
  );
  vworld.s11Booths = await createS11Booths(Cesium, viewer, VWORLD_CONFIG.siteId);
  vworld.informationCenter = await createInformationCenter(Cesium, viewer, VWORLD_CONFIG.siteId);
  vworld.photobooth = await createPhotobooth(Cesium, viewer, VWORLD_CONFIG.siteId);
  vworld.platform111 = await createPlatform111(Cesium, viewer, VWORLD_CONFIG.siteId);
  vworld.platform111Window = await createPlatform111Window(Cesium, viewer, VWORLD_CONFIG.siteId);
  vworld.openingGuardrail = await createOpeningGuardrail(Cesium, viewer, VWORLD_CONFIG.siteId);
  vworld.gtxWallPhoto = createGtxWallPhoto(Cesium, viewer, VWORLD_CONFIG.siteId);
  vworld.f02wl072Frame = createF02wl072UpperFrame(Cesium, viewer, VWORLD_CONFIG.siteId);
  document.getElementById("renovation-layer").hidden = VWORLD_CONFIG.siteId !== INFORMATION_ZONE.site;
  buildTrainMatesAsset(Cesium);
  buildCatalogFocusMarker(Cesium);
  rebuildApprovedReplacementOverlays(Cesium);
  rebuildApprovedReportAssets(Cesium);
  bindVWorldPicking(Cesium);

  vworld.pointReview = await createPointReviewLayer(Cesium, viewer, {
    site: VWORLD_CONFIG.siteId,
    getFloor: () => state.floor,
    setFloor: (floor, overview) => { state.floor = floor; render(); if (overview) flyToVWorldFloor(floor); },
  });

  setMapLoadStage('first-tile');
  // Subscribe BEFORE moving the camera; keep parent point traffic out until visible.
  const firstTile = firstVisibleTile(tileset);
  vworld.ready = true;
  renderVWorldScene();
  ui["vworld-status-copy"].textContent = `${VWORLD_CONFIG.siteId} · 첫 실내 모델 렌더링 대기`;
  await firstTile;
  vworld.mapVisible = true;
  setMapLoadStage('visible');
  ui.app.dataset.vworldStatus = "ready";
  ui["vworld-source-state"].textContent = `VWORLD LIVE · ${state.floor}`;
  ui["data-status"].textContent = "VWORLD + DATA READY";
  ui["data-version"].textContent = `${VWORLD_CONFIG.siteId} · ${db.snapshot.meta.mock_version}`;
  ui["freshness-badge"].textContent = "LIVE 3D · 가상 데이터";
  renderVWorldScene();
  announceCatalogMapReady();
  if(TOOLKIT){
    const {createToolkitScene}=await import('./toolkit-scene.js');
    vworld.toolkitScene=createToolkitScene(Cesium,viewer,{
      hasApprovedAsset(id){return vworld.toolkitMapData.assets.some(a=>a.id===id);},
      setFloor(floor){state.floor=floor;vworld.lastFloor=null;renderVWorldScene(true);},
      overview(){stopVWorldRotation();flyToVWorldFloor(state.floor);},
      // 야!너두 report review: a proposed facade shown on its slot (not saved), and the slot's front view.
      previewFacade(v){DEMO_FACADE=v;refreshApprovedReplacementOverlays();},
      focusFacade(f){applyCatalogFocus({...f,sourceKind:'catalog'});},
    });
  }
  if(EXPERIENCE){
    document.documentElement.dataset.experience='true';
    const {createExperienceScene}=await import('./experience-scene.js');
    vworld.experience=createExperienceScene(Cesium,viewer,{
      setFloor(floor){if(!experienceFloors&&state.floor===floor)return;experienceFloors=null;state.floor=floor;vworld.lastFloor=null;renderVWorldScene(true);},
      showFloors(floors){if(JSON.stringify(experienceFloors)===JSON.stringify(floors))return;experienceFloors=floors;vworld.lastFloor=null;renderVWorldScene(true);},
      overview(){experienceFloors=null;vworld.lastFloor=null;renderVWorldScene(true);stopVWorldRotation();flyToVWorldFloor(state.floor);},
      renderedFloors(){return experienceFloors||[state.floor];},
    });
  }
}

function setMapLoadStage(stage) {
  vworld.loadStage = stage;
  if (window.parent !== window) window.parent.postMessage({type:'station-one:map-load-stage',stage}, location.origin);
}

async function waitForCesium(timeoutMs = 20000) {
  const startedAt = Date.now();
  while (!window.Cesium) {
    if (Date.now() - startedAt > timeoutMs) throw new Error("CesiumJS 로더 시간 초과");
    await new Promise((resolve) => setTimeout(resolve, 80));
  }
  return window.Cesium;
}

function handleVWorldError(error) {
  console.error("VWorld 3D connection failed", error);
  stopVWorldRotation();
  vworld.ready = false;
  vworld.mapVisible = false;
  vworld.loadError = {stage:error.stage || vworld.loadStage || 'scene',message:error.message};
  if (window.parent !== window) window.parent.postMessage({type:'station-one:catalog-map-error',...vworld.loadError},location.origin);
  ui.app.dataset.vworldStatus = "fallback";
  ui["vworld-status-title"].textContent = "VWorld 연결 실패 · 대체 공간도 표시";
  if (EMBED_MODE) ui["vworld-status-title"].textContent = '3D 지도 연결 실패 · 실제 위치를 표시하지 못했습니다';
  ui["vworld-status-copy"].textContent = `${vworld.loadError.stage}: ${error.message}`;
  const retry = document.createElement('button');
  retry.type='button';retry.textContent='지도 다시 연결';retry.addEventListener('click',()=>location.reload());
  ui['vworld-loading'].append(retry);
  ui["vworld-source-state"].textContent = "VWORLD OFFLINE · FALLBACK";
  ui["data-status"].textContent = "MOCK DATA READY";
  ui["freshness-badge"].textContent = "VWORLD OFFLINE";
  ui["data-version"].textContent = `${db?.snapshot?.meta?.mock_version || "SYNTHETIC"} · fallback`;
  showToast("VWorld 3D를 불러오지 못해 대체 공간도를 표시합니다. 네트워크 연결을 확인하세요.");
}

function bindVWorldPicking(Cesium) {
  vworld.clickHandler?.destroy();
  vworld.clickHandler = new Cesium.ScreenSpaceEventHandler(vworld.viewer.scene.canvas);
  vworld.clickHandler.setInputAction((movement) => {
    if (vworld.placingTrainMates) {
      placeTrainMatesAtScreenPoint(Cesium, movement.position);
      return;
    }
    const picked = vworld.viewer.scene.pick(movement.position);
    if (picked?.id?.properties?.renovationId?.getValue(Cesium.JulianDate.now()) === TRUEDAN.id) {
      showToast(vworld.renovation?.hasFacadeImage()
        ? "TRUEDAN · 승인된 전체 파사드 이미지 반영 중"
        : "TRUEDAN · 사진 기준 현황 모델");
      return;
    }
    const facilityAssetId = picked?.id?.properties?.facilityAssetId?.getValue(Cesium.JulianDate.now());
    if (facilityAssetId === GTX_WALL_PHOTO.id) {
      showToast(`${GTX_WALL_PHOTO.label} · ${GTX_WALL_PHOTO.wallSlot} · 기존 벽 유지 / 사진 표시`);
      return;
    }
    if (facilityAssetId === PHOTOBOOTH.id) {
      showToast(`${PHOTOBOOTH.label} · ${PHOTOBOOTH.surface.alias} · 현장 사진 기준 / 크기 추정`);
      return;
    }
    if (facilityAssetId === PLATFORM111.id) {
      showToast(`${PLATFORM111.label} · 연속 111m · 현장사진 참고 정지 화면 / 실시간 아님`);
      return;
    }
    if (facilityAssetId === INFORMATION_CENTER.id) {
      showToast(`${INFORMATION_CENTER.label} · 현장 사진 4면 · 경계·높이 추정치`);
      return;
    }
    if (INFORMATION_FACILITY_IDS.includes(facilityAssetId)) {
      const facility = INFORMATION_FACILITIES.find((item) => item.id === facilityAssetId);
      showToast(vworld.informationZone?.hasReplacement(facilityAssetId)
        ? `${facility?.label || facilityAssetId} · 승인 교체 이미지 반영 중`
        : `${facility?.label || facilityAssetId} · 현장 사진 기준 배치`);
      return;
    }
    const assetIdProperty = picked?.id?.properties?.assetId;
    const assetId = assetIdProperty?.getValue(Cesium.JulianDate.now());
    if (assetId === TRAIN_MATES.id) {
      state.floor = TRAIN_MATES.floor;
      state.zoneId = TRAIN_MATES.zoneId;
      render();
      showToast("TRAIN MATES 서울역점 · 첨부 투시도 기반 1차 3D 배치");
      return;
    }
    const zoneIdProperty = picked?.id?.properties?.zoneId;
    const zoneId = zoneIdProperty?.getValue(Cesium.JulianDate.now());
    const replacementSlotProperty = picked?.id?.properties?.replacementSlot;
    const replacementSlot = replacementSlotProperty?.getValue(Cesium.JulianDate.now());
    if (replacementSlot) {
      showToast(`${replacementSlot} · 승인된 교체 이미지`);
      return;
    }
    if (!zoneId || !db.zoneById.has(zoneId)) return;
    state.zoneId = zoneId;
    render();
  }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
}

function renderVWorldScene(preserveCamera = false) {
  if (!vworld.ready || !db || !window.Cesium) return;
  const Cesium = window.Cesium;
  const visibleFloor = floor => EXPERIENCE && experienceFloors ? experienceFloors.includes(floor) : floor === state.floor;
  const floorChanged = vworld.lastFloor !== state.floor;
  const initialFloor = vworld.lastFloor === null;
  if (floorChanged) {
    vworld.lastFloor = state.floor;
    const styleDefinition = {
      show: { conditions: [...gtxBarricadeRetirementStyleConditions(VWORLD_CONFIG.siteId), ...pergolaRetirementStyleConditions(VWORLD_CONFIG.siteId), ...feedbackRetirementStyleConditions(VWORLD_CONFIG.siteId), ...informationCenterRetirementStyleConditions(VWORLD_CONFIG.siteId), ...loungeRetirementStyleConditions(VWORLD_CONFIG.siteId), ...loungeSignRetirementStyleConditions(VWORLD_CONFIG.siteId), ...((EXPERIENCE&&experienceFloors)||[state.floor]).map(floor=>[`\${FLOOR} === '${floor}'`,true]), ["true", false]] },
    };
    if(EXPERIENCE&&experienceFloors?.length>1)styleDefinition.color="color('white', 0.38)";
    const focusTdId = CATALOG_FOCUS?.tdId?.split("|")[0]?.trim();
    if (focusTdId && /^[0-9A-Za-z_-]+$/.test(focusTdId)) {
      styleDefinition.color = {
        conditions: [
          [`\${TD_ID} === '${focusTdId}'`, "color('#b8f7ff', 1.0)"],
          ["true", "color('white', 1.0)"],
        ],
      };
    }
    vworld.tileset.style = new Cesium.Cesium3DTileStyle(styleDefinition);
    ui["vworld-source-state"].textContent = `VWORLD LIVE · ${state.floor}`;
  }
  renderVWorldOverlays(Cesium);
  const informationZoneVisible = visibleFloor(INFORMATION_ZONE.floor) && state.layers.renovation;
  const truedanVisible = visibleFloor(TRUEDAN.floor) && state.layers.renovation;
  vworld.renovation?.setVisible(truedanVisible);
  vworld.informationZone?.setVisible(informationZoneVisible);
  vworld.s11Booths?.setVisible(informationZoneVisible);
  vworld.informationCenter?.setVisible(informationZoneVisible);
  const platform111Visible = (visibleFloor(PLATFORM111.floor) || visibleFloor(PLATFORM111_WINDOW.floor)) && state.layers.renovation && !vworld.placingTrainMates;
  vworld.platform111?.setVisible(platform111Visible && visibleFloor(PLATFORM111.floor));
  vworld.platform111Window?.setVisible(platform111Visible && visibleFloor(PLATFORM111_WINDOW.floor) && !visibleFloor(PLATFORM111.floor));
  const photoboothVisible = visibleFloor(PHOTOBOOTH.floor) && state.layers.renovation && !vworld.placingTrainMates;
  vworld.photobooth?.setVisible(photoboothVisible);
  ui.app.dataset.photobooth = vworld.photobooth && photoboothVisible ? 'visible' : 'hidden';
  ui.app.dataset.photoboothSlot = PHOTOBOOTH.surface.alias;
  ui.app.dataset.platform111 = vworld.platform111 && platform111Visible ? 'visible' : 'hidden';
  ui.app.dataset.platform111Length = String(PLATFORM111.length);
  ui.app.dataset.platform111Presentation = platform111Visible ? (state.floor === PLATFORM111_WINDOW.floor ? 'window-3F' : 'original-2F') : 'hidden';
  ui.app.dataset.platform111Surfaces = PLATFORM111_SURFACES.map(s=>s.alias).join(',');
  const openingGuardrailVisible = visibleFloor(OPENING_GUARDRAIL.floor) && !vworld.placingTrainMates;
  vworld.openingGuardrail?.setVisible(openingGuardrailVisible);
  const gtxPhotoVisible = visibleFloor(GTX_WALL_PHOTO.floor) && !vworld.placingTrainMates;
  vworld.gtxWallPhoto?.setVisible(gtxPhotoVisible);
  ui.app.dataset.gtxWallPhoto = vworld.gtxWallPhoto && gtxPhotoVisible ? 'visible' : 'hidden';
  ui.app.dataset.gtxMode = GTX_WALL_PHOTO.mode;
  ui.app.dataset.openingGuardrail = vworld.openingGuardrail && openingGuardrailVisible ? 'visible' : 'hidden';
  ui.app.dataset.informationCenter = vworld.informationCenter && informationZoneVisible ? 'visible' : 'hidden';
  ui.app.dataset.informationCenterSurfaces = INFORMATION_CENTER_SURFACES.map(s=>s.alias).join(',');
  ui.app.dataset.s11Booths = vworld.s11Booths && informationZoneVisible ? 'visible' : 'hidden';
  ui.app.dataset.s11ShiftMeters = String(S11_ZONE.shift);
  vworld.seoulRetirementMask?.setVisible({ truedan: truedanVisible, informationZone: informationZoneVisible, platform111: platform111Visible });
  ui.app.dataset.truedanStatus = vworld.renovation && truedanVisible ? "visible" : "hidden";
  ui.app.dataset.informationZoneStatus = vworld.informationZone && informationZoneVisible ? "visible" : "hidden";
  ui.app.dataset.informationFacilityCount = String(INFORMATION_FACILITIES.length);
  if (vworld.assets) vworld.assets.show = SHOW_TRAIN_MATES && visibleFloor(TRAIN_MATES.floor) && state.layers.shops && !vworld.placingTrainMates;
  vworld.trainMatesFacades?.setVisible(vworld.assets?.show);
  if (vworld.overlays) vworld.overlays.show = !TOOLKIT && !EXPERIENCE && !CATALOG_FOCUS && !vworld.placingTrainMates && new URLSearchParams(location.search).get('pointReview')!=='1';
  if (vworld.catalogFocus) vworld.catalogFocus.show = Boolean(!vworld.pointReview?.active && CATALOG_FOCUS && state.floor === CATALOG_FOCUS.floor);
  vworld.pointReview?.setFloor(state.floor);
  if (vworld.replacementOverlays) {
    vworld.replacementOverlays.show = !vworld.placingTrainMates;
    for (const entity of vworld.replacementOverlays.entities.values) {
      const overlayFloor = entity.properties?.floor?.getValue(Cesium.JulianDate.now());
      entity.show = visibleFloor(overlayFloor);
    }
  }
  if (vworld.approvedReportAssets) {
    vworld.approvedReportAssets.show = !vworld.placingTrainMates;
    for (const entity of vworld.approvedReportAssets.entities.values) {
      entity.show = visibleFloor(entity.properties.floor.getValue(Cesium.JulianDate.now()));
    }
  }
  if (vworld.replacementOverlayPrimitives) {
    vworld.replacementOverlayPrimitives.show = !vworld.placingTrainMates;
    for (const record of vworld.replacementOverlayPrimitiveRecords) {
      record.primitive.show = visibleFloor(record.floor);
    }
  }
  vworld.f02wl072Frame?.setVisible(visibleFloor(F02WL072_FRAME.floor) && !vworld.placingTrainMates);
  const trainMatesMarker = vworld.assets?.entities.getById(`asset:${TRAIN_MATES.id}:marker`);
  if (trainMatesMarker?.label) trainMatesMarker.label.show = state.layers.labels && ["commerce", "story"].includes(state.mode);
  ui.app.dataset.trainmatesStatus = vworld.assets?.show ? "visible" : "hidden";
  ui.app.dataset.trainmatesPlacement = `${trainMatesPlacement.centerEast.toFixed(2)},${trainMatesPlacement.centerNorth.toFixed(2)},${trainMatesPlacement.baseUp.toFixed(2)}`;
  ui.app.dataset.trainmatesGeometry = `${(TRAIN_MATES.width * TRAIN_MATES.scaleX).toFixed(2)}x${(TRAIN_MATES.depth * TRAIN_MATES.scaleY).toFixed(2)}m@${trainMatesPlacement.headingDeg.toFixed(1)}deg`;
  if (floorChanged && !preserveCamera) {
    if (initialFloor && GTX_WALL_PHOTO_ENTRY && !CATALOG_FOCUS) vworld.gtxWallPhoto?.focus(0);
    else if (initialFloor && PLATFORM111_ENTRY && !CATALOG_FOCUS) activePlatform111()?.focus(new URLSearchParams(window.location.search).get('surface'), 0);
    else if (initialFloor && TRAIN_MATES_ENTRY && !CATALOG_FOCUS) vworld.trainMatesFacades?.focus(new URLSearchParams(window.location.search).get('surface'), 0);
    else if (initialFloor && TRUEDAN_ENTRY && !CATALOG_FOCUS) vworld.renovation?.focus(0);
    else if (initialFloor && S11_ENTRY && !CATALOG_FOCUS) vworld.s11Booths?.focus(null, 0);
    else if (initialFloor && INFORMATION_ZONE_ENTRY && !CATALOG_FOCUS) vworld.informationZone?.focus(0);
    else if (CATALOG_FOCUS && !vworld.catalogFocusApplied) flyToCatalogFocus(initialFloor ? 0 : .85);
    else flyToVWorldFloor(state.floor, initialFloor ? 0 : .85);
  }
  vworld.viewer.scene.requestRender();
}

// Approved changes come from the public editor (its own D1/R2), not the retired
// Supabase workbench. The editor's public reads and images are open to other sites (CORS *), cookie-free.
const TOOLKIT_ORIGIN = ['localhost', '127.0.0.1'].includes(location.hostname) ? 'http://127.0.0.1:4197' : 'https://toolkit.yanerdstation.kr';
function rebuildApprovedReportAssets(Cesium) {
  if (!vworld.approvedReportAssets) return;
  vworld.approvedReportAssets.entities.removeAll();
  for (const asset of vworld.toolkitMapData.assets) addAssetEntities(Cesium, vworld.approvedReportAssets.entities, asset);
}
async function loadToolkitChanges(siteId) {
  const response = await fetch(TOOLKIT_ORIGIN + '/api/public/station?key=' + encodeURIComponent(siteId), { signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error('편집기 승인 파사드를 불러오지 못했습니다.');
  return toolkitMapData(await response.json(), siteId, TOOLKIT_ORIGIN);
}

async function initializeApprovedReplacementOverlays() {
  try {
    await refreshApprovedReplacementOverlays();
    // The public editor has no push channel: look again every few minutes while the map is open.
    clearInterval(vworld.replacementOverlayRefreshTimer);
    vworld.replacementOverlayRefreshTimer = setInterval(refreshApprovedReplacementOverlays, 5 * 60 * 1000);
  } catch (error) {
    handleReplacementOverlayError(error);
  }
}

async function refreshApprovedReplacementOverlays() {
  try {
    const baseline = VWORLD_CONFIG.siteId === 'S202103'
      ? await fetch('/data/jury-frozen/approved-facades.json').then(r => {if(!r.ok)throw Error('서울역 기준 파사드를 불러오지 못했습니다.');return r.json();}).then(v => v.replacements)
      : [];
    try {
      vworld.toolkitMapData = await loadToolkitChanges(VWORLD_CONFIG.siteId);
      ui.app.dataset.toolkitChangesStatus = 'connected';
    } catch (error) {
      // An unavailable editor must not blank Seoul's reviewed baseline or last successful approvals.
      ui.app.dataset.toolkitChangesStatus = 'unavailable';
      if (VWORLD_CONFIG.siteId !== 'S202103') throw error;
    }
    const replacements = mergeApprovedReplacements(baseline, vworld.toolkitMapData.replacements);
    vworld.demoFacadeMatched=false;
    if(VWORLD_CONFIG.siteId==='S202103'&&DEMO_FACADE){
      const match=replacements.find(r=>r.slot?.slot_alias===DEMO_FACADE.slotAlias);
      if(match){match.image_url=DEMO_FACADE.imageUrl;match.id='demo:'+match.id;vworld.demoFacadeMatched=true;}
    }
    await Promise.all(replacements.map(prepareApprovedReplacementRenderImage));
    vworld.approvedReplacements = replacements;
    vworld.replacementOverlayError = null;
    ui.app.dataset.approvedOverlayCount = String(replacements.length);
    ui.app.dataset.approvedLegacyCropCount = String(replacements.filter((replacement) => replacement.legacy_crop_applied).length);
    ui["virtual-data-badge"].textContent = replacements.length
      ? `승인 이미지 ${replacements.length}장 교체 표시`
      : "승인 이미지 교체 준비";
    if (vworld.replacementOverlays && window.Cesium) {
      rebuildApprovedReplacementOverlays(window.Cesium);
      rebuildApprovedReportAssets(window.Cesium);
      vworld.toolkitScene?.refresh();
      renderVWorldScene();
    }
  } catch (error) {
    handleReplacementOverlayError(error);
  }
}

async function prepareApprovedReplacementRenderImage(replacement) {
  replacement.render_image = replacement.image_url;
  replacement.legacy_crop_applied = false;
  const crop = replacement.toolkit_approved ? null : matchingLegacyReplacementCrop(replacement.slot, replacement);
  if (!crop || typeof Image === "undefined") return;
  try {
    const image = await new Promise((resolve, reject) => {
      const element = new Image();
      element.crossOrigin = "anonymous";
      element.onload = () => resolve(element);
      element.onerror = reject;
      element.src = replacement.image_url;
    });
    if (image.naturalWidth !== crop.sourceWidth || image.naturalHeight !== crop.sourceHeight) {
      throw new Error(`legacy image size ${image.naturalWidth}x${image.naturalHeight} does not match ${crop.sourceWidth}x${crop.sourceHeight}`);
    }
    const width = Number(replacement.slot?.replacement_canvas_width_px) || crop.width;
    const height = Number(replacement.slot?.replacement_canvas_height_px) || crop.height;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("2D canvas is unavailable");
    context.drawImage(
      image,
      crop.left, crop.top, crop.width, crop.height,
      0, 0, width, height,
    );
    replacement.render_image = canvas;
    replacement.legacy_crop_applied = true;
  } catch (error) {
    console.warn("Legacy replacement crop could not be applied", replacement.slot_key, error);
  }
}

function handleReplacementOverlayError(error) {
  console.warn("Approved replacement overlay connection failed", error);
  vworld.replacementOverlayError = error;
  ui.app.dataset.approvedOverlayCount = "unavailable";
  ui["virtual-data-badge"].textContent = "승인 이미지 연결 대기";
}

function rebuildApprovedReplacementOverlays(Cesium) {
  const truedanFacade = vworld.approvedReplacements.find(isTruedanFacadeReplacement);
  const informationFacilityReplacements = vworld.approvedReplacements.filter(isInformationFacilityReplacement);
  const f02wl072Frame = vworld.approvedReplacements.find(isF02wl072FrameReplacement);
  vworld.renovation?.setFacadeImage(truedanFacade?.image_url || "");
  vworld.informationZone?.setReplacements(informationFacilityReplacements);
  vworld.s11Booths?.setReplacements(vworld.approvedReplacements);
  vworld.informationCenter?.setReplacements(vworld.approvedReplacements);
  vworld.platform111?.setReplacements(vworld.approvedReplacements);
  vworld.platform111Window?.setReplacements(vworld.approvedReplacements);
  vworld.photobooth?.setReplacements(vworld.approvedReplacements);
  vworld.trainMatesFacades?.setReplacements(vworld.approvedReplacements);
  vworld.f02wl072Frame?.setReplacement(f02wl072Frame || null);
  ui.app.dataset.truedanFacadeMode = truedanFacade ? "approved" : "default";
  ui.app.dataset.truedanFacadeSlot = TRUEDAN_FACADE.slotKey;
  ui.app.dataset.truedanFacadeVersion = truedanFacade?.id || "";
  ui.app.dataset.informationFacilityApprovedCount = String(informationFacilityReplacements.length);
  ui.app.dataset.informationFacilitySlots = INFORMATION_FACILITIES.map((asset) => asset.slotKey).join(",");
  ui.app.dataset.f02wl072FrameMode = f02wl072Frame ? "approved" : "default";
  ui.app.dataset.f02wl072FrameSlot = F02WL072_FRAME.slotKey;
  ui.app.dataset.f02wl072FrameVersion = f02wl072Frame?.id || "";
  ui.app.dataset.f02wl072FrameSurfaces = String(F02WL072_FRAME.surfaces.length);
  if (!vworld.replacementOverlays) return;
  const entities = vworld.replacementOverlays.entities;
  entities.removeAll();
  vworld.replacementOverlayPrimitives?.removeAll();
  vworld.replacementOverlayPrimitiveRecords = [];
  let renderedOverlayCount = 0;
  for (const replacement of vworld.approvedReplacements) {
    if (isTruedanFacadeReplacement(replacement)) continue;
    if (isInformationFacilityReplacement(replacement)) continue;
    if (isF02wl072FrameReplacement(replacement)) continue;
    const slot = replacement.slot;
    if (isTrainMatesSlot(slot)) continue;
    if (isRetiredS38Slot(slot)) continue;
    if (isRetiredPergolaSlot(slot)) continue;
    if (isRetiredLoungeSlot(slot)) continue;
    if (isRetiredLoungeSignBodySlot(slot)) continue;
    if (isInformationCenterSlot(slot) || isRetiredInformationCenterSlot(slot)) continue;
    if (isPlatform111Slot(slot)) continue;
    if (isPhotoboothSlot(slot)) continue;
    if (isRetiredPlatform111Replacement(replacement)) continue;
    if (slot.site_id === S11_ZONE.site && (s11ShopForSlot(slot) || slot.slot_alias === S11_RETIRED_SIGN)) continue;
    // A retired storefront's separately rendered approved photo must not float
    // over the new information facilities after its VWorld shell is hidden.
    if (slot.site_id === INFORMATION_ZONE.site
      && RETIRED_INFORMATION_SHOP_SLOTS.includes(slot.slot_alias)) continue;
    const placements = approvedOverlayPlacements(slot);
    placements.forEach((placement, placementIndex) => {
      const surface = { ...slot, ...placement };
      const dimensions = approvedOverlayDimensions(surface);
      const placementSuffix = placements.length > 1 ? `:${placementIndex + 1}` : "";
      const replacementProperties = {
        replacementSlot: slot.slot_alias || slot.model_name || replacement.slot_key,
        floor: slot.floor,
        tdId: slot.td_id,
        replacementVersion: replacement.id,
        sourceKind: slot.source_kind || "vworld_uv",
        targetAssetId: slot.target_asset_id || "",
        surfacePlacementIndex: placementIndex,
        surfacePlacementCount: placements.length,
      };
      if (surface.render_kind === "coplanar_polygon") {
        const result = createCoplanarReplacementPrimitives(Cesium, {
          replacement,
          slot,
          placement: surface,
          placementIndex,
          placementCount: placements.length,
          maskOffset: APPROVED_REPLACEMENT_MASK_OFFSET_METERS,
          imageOffset: APPROVED_REPLACEMENT_IMAGE_OFFSET_METERS,
        });
        if (!result || !vworld.replacementOverlayPrimitives) return;
        for (const primitive of result.primitives) {
          vworld.replacementOverlayPrimitives.add(primitive);
          vworld.replacementOverlayPrimitiveRecords.push({ primitive, floor: result.floor });
          renderedOverlayCount += 1;
        }
        return;
      }
      const maskWall = approvedOverlayWall(Cesium, surface, dimensions.width, APPROVED_REPLACEMENT_MASK_OFFSET_METERS);
      const imageWall = approvedOverlayWall(Cesium, surface, dimensions.width, APPROVED_REPLACEMENT_IMAGE_OFFSET_METERS);
      if (!maskWall || !imageWall) return;
      entities.add({
        id: `approved-replacement-mask:${replacement.slot_key}${placementSuffix}`,
        name: `${slot.slot_alias || slot.object_label || slot.model_name} 원본 이미지 차폐면`,
        properties: replacementProperties,
        wall: {
          positions: maskWall.positions,
          minimumHeights: [maskWall.minimumHeight, maskWall.minimumHeight],
          maximumHeights: [maskWall.maximumHeight, maskWall.maximumHeight],
          material: Cesium.Color.fromCssColorString("#081117"),
          outline: false,
          shadows: Cesium.ShadowMode.DISABLED,
          distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 650),
        },
      });
      entities.add({
        id: `approved-replacement:${replacement.slot_key}${placementSuffix}`,
        name: `${slot.slot_alias || slot.object_label || slot.model_name} 승인 교체 이미지`,
        properties: replacementProperties,
        wall: {
          positions: imageWall.positions,
          minimumHeights: [imageWall.minimumHeight, imageWall.minimumHeight],
          maximumHeights: [imageWall.maximumHeight, imageWall.maximumHeight],
          material: new Cesium.ImageMaterialProperty({
            image: replacement.render_image || replacement.image_url,
            color: Cesium.Color.WHITE,
            transparent: true,
          }),
          outline: false,
          shadows: Cesium.ShadowMode.DISABLED,
          distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 650),
        },
      });
      renderedOverlayCount += 2;
    });
  }
  ui.app.dataset.approvedOverlayEntities = String(renderedOverlayCount);
  ui.app.dataset.approvedReplacementMode = "replacement-only";
}

function isTruedanFacadeReplacement(replacement) {
  const slot = replacement?.slot;
  return replacement?.slot_key === TRUEDAN_FACADE.slotKey
    && slot?.site_id === TRUEDAN.site
    && slot?.source_kind === "app_asset"
    && slot?.target_asset_id === TRUEDAN_FACADE.targetAssetId
    && slot?.target_surface_id === TRUEDAN_FACADE.targetSurfaceId;
}

function approvedOverlayPlacements(slot) {
  const placements = Array.isArray(slot?.surface_placements) ? slot.surface_placements : [];
  if (!placements.length) return [slot];
  const placementIds = new Set();
  const valid = placements.filter((placement) => {
    const rawValues = [
      placement?.longitude, placement?.latitude, placement?.height_m,
      placement?.camera_heading_deg, placement?.surface_width_m, placement?.surface_height_m,
    ];
    const values = rawValues.map(Number);
    const placementId = String(placement?.placement_id || "").trim();
    if (!placementId || placementIds.has(placementId)) return false;
    placementIds.add(placementId);
    return rawValues.every((value) => value !== null && value !== undefined && value !== "")
      && values.every(Number.isFinite)
      && values[0] >= -180 && values[0] <= 180
      && values[1] >= -90 && values[1] <= 90
      && values[3] >= 0 && values[3] < 360
      && values[4] > 0 && values[5] > 0;
  });
  if (valid.length !== placements.length || valid.filter((placement) => placement.is_primary === true).length !== 1) {
    console.warn("Approved replacement has invalid surface placements", slot?.slot_key || slot?.slot_alias || "unknown");
    return [];
  }
  return valid;
}

function isF02wl072FrameCatalogFocus() {
  return CATALOG_FOCUS?.sourceKind === "app_asset"
    && CATALOG_FOCUS.targetAssetId === F02WL072_FRAME.targetAssetId
    && CATALOG_FOCUS.targetSurfaceId === F02WL072_FRAME.targetSurfaceId;
}

function approvedOverlayDimensions(slot) {
  const exactWidth = Number(slot?.surface_width_m);
  const exactHeight = Number(slot?.surface_height_m);
  if ([exactWidth, exactHeight].every(Number.isFinite) && exactWidth > 0 && exactHeight > 0) {
    return { width: exactWidth, height: exactHeight };
  }
  const area = Number(slot?.surface_area_m2);
  const canvasWidth = Number(slot?.replacement_canvas_width_px);
  const canvasHeight = Number(slot?.replacement_canvas_height_px);
  const hasReplacementCanvas = [canvasWidth, canvasHeight].every(Number.isFinite)
    && canvasWidth > 0 && canvasHeight > 0;
  const cropWidth = hasReplacementCanvas ? canvasWidth : Number(slot?.crop_width_px);
  const cropHeight = hasReplacementCanvas ? canvasHeight : Number(slot?.crop_height_px);
  if (![area, cropWidth, cropHeight].every(Number.isFinite) || area <= 0 || cropWidth <= 0 || cropHeight <= 0) {
    return { width: 1, height: 1 };
  }
  const aspect = Math.max(.05, Math.min(24, cropWidth / cropHeight));
  return {
    width: Math.sqrt(area * aspect),
    height: Math.sqrt(area / aspect),
  };
}

function approvedOverlayWall(Cesium, slot, width, surfaceOffset) {
  const longitude = Number(slot?.longitude);
  const latitude = Number(slot?.latitude);
  const centerHeight = Number(slot?.height_m);
  const normalHeading = Number(slot?.camera_heading_deg);
  const dimensions = approvedOverlayDimensions(slot);
  if (![longitude, latitude, centerHeight, normalHeading, width, dimensions.height].every(Number.isFinite)) return null;

  const heading = Cesium.Math.toRadians(normalHeading);
  const normalEast = Math.sin(heading);
  const normalNorth = Math.cos(heading);
  // 카메라가 놓이는 앞쪽 법선으로 차폐면과 교체면을 순서대로 띄운다.
  const tangentEast = Math.cos(heading);
  const tangentNorth = -Math.sin(heading);
  const halfWidth = Math.max(.05, width / 2);
  const origin = Cesium.Cartesian3.fromDegrees(longitude, latitude, 0);
  const frame = Cesium.Transforms.eastNorthUpToFixedFrame(origin);
  const pointAt = (tangentDistance) => Cesium.Matrix4.multiplyByPoint(
    frame,
    new Cesium.Cartesian3(
      normalEast * surfaceOffset + tangentEast * tangentDistance,
      normalNorth * surfaceOffset + tangentNorth * tangentDistance,
      0,
    ),
    new Cesium.Cartesian3(),
  );
  return {
    // 앞에서 볼 때 왼쪽에서 오른쪽으로 이어지도록 순서를 유지한다.
    positions: [pointAt(halfWidth), pointAt(-halfWidth)],
    minimumHeight: centerHeight - dimensions.height / 2,
    maximumHeight: centerHeight + dimensions.height / 2,
  };
}

function catalogFocusNumber(value) {
  if (value === null || value === undefined || value === "") return NaN;
  return Number(value);
}

function readCatalogFocus() {
  const params = new URLSearchParams(window.location.search);
  if (params.get("catalogFocus") !== "1") return null;
  const longitude = catalogFocusNumber(params.get("lon"));
  const latitude = catalogFocusNumber(params.get("lat"));
  const height = catalogFocusNumber(params.get("height"));
  const east = catalogFocusNumber(params.get("east"));
  const north = catalogFocusNumber(params.get("north"));
  const cameraHeading = catalogFocusNumber(params.get("cameraHeading"));
  const surfaceArea = catalogFocusNumber(params.get("surfaceArea"));
  const surfaceWidth = catalogFocusNumber(params.get("surfaceWidth"));
  const surfaceHeight = catalogFocusNumber(params.get("surfaceHeight"));
  const cropWidth = catalogFocusNumber(params.get("cropWidth"));
  const cropHeight = catalogFocusNumber(params.get("cropHeight"));
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return null;
  const floor = String(params.get("floor") || "1F").slice(0, 12);
  return Object.freeze({
    longitude,
    latitude,
    height: Number.isFinite(height) ? height : (VWORLD_CONFIG.floorHeightMeters[floor] ?? 27),
    east: Number.isFinite(east) ? east : null,
    north: Number.isFinite(north) ? north : null,
    cameraHeading: Number.isFinite(cameraHeading) ? cameraHeading : null,
    surfaceArea: Number.isFinite(surfaceArea) ? surfaceArea : null,
    surfaceWidth: Number.isFinite(surfaceWidth) ? surfaceWidth : null,
    surfaceHeight: Number.isFinite(surfaceHeight) ? surfaceHeight : null,
    cropWidth: Number.isFinite(cropWidth) ? cropWidth : null,
    cropHeight: Number.isFinite(cropHeight) ? cropHeight : null,
    floor,
    label: String(params.get("label") || "선택 이미지").slice(0, 120),
    imageId: String(params.get("imageId") || "").slice(0, 80),
    model: String(params.get("model") || "").slice(0, 160),
    tdId: String(params.get("tdId") || "").slice(0, 180),
    sourceKind: String(params.get("sourceKind") || "vworld_uv").slice(0, 40),
    targetAssetId: String(params.get("targetAssetId") || "").slice(0, 120),
    targetSurfaceId: String(params.get("targetSurfaceId") || "").slice(0, 120),
    returnUrl: String(params.get("returnUrl") || "").slice(0, 1600),
  });
}

function normalizeCatalogFocus(value) {
  if (!value || typeof value !== "object") return null;
  const longitude = catalogFocusNumber(value.longitude);
  const latitude = catalogFocusNumber(value.latitude);
  const east = catalogFocusNumber(value.east);
  const north = catalogFocusNumber(value.north);
  const cameraHeading = catalogFocusNumber(value.cameraHeading);
  const surfaceArea = catalogFocusNumber(value.surfaceArea);
  const surfaceWidth = catalogFocusNumber(value.surfaceWidth);
  const surfaceHeight = catalogFocusNumber(value.surfaceHeight);
  const cropWidth = catalogFocusNumber(value.cropWidth);
  const cropHeight = catalogFocusNumber(value.cropHeight);
  const height = catalogFocusNumber(value.height);
  if ((!Number.isFinite(longitude) || !Number.isFinite(latitude)) && (!Number.isFinite(east) || !Number.isFinite(north))) return null;
  const floor = String(value.floor || "1F").slice(0, 12);
  return Object.freeze({
    longitude: Number.isFinite(longitude) ? longitude : null,
    latitude: Number.isFinite(latitude) ? latitude : null,
    height: Number.isFinite(height) ? height : (VWORLD_CONFIG.floorHeightMeters[floor] ?? 27),
    east: Number.isFinite(east) ? east : null,
    north: Number.isFinite(north) ? north : null,
    cameraHeading: Number.isFinite(cameraHeading) ? cameraHeading : null,
    surfaceArea: Number.isFinite(surfaceArea) ? surfaceArea : null,
    surfaceWidth: Number.isFinite(surfaceWidth) ? surfaceWidth : null,
    surfaceHeight: Number.isFinite(surfaceHeight) ? surfaceHeight : null,
    cropWidth: Number.isFinite(cropWidth) ? cropWidth : null,
    cropHeight: Number.isFinite(cropHeight) ? cropHeight : null,
    floor,
    label: String(value.label || "선택 개체").slice(0, 120),
    imageId: String(value.imageId || "").slice(0, 80),
    model: String(value.model || "").slice(0, 160),
    tdId: String(value.tdId || "").slice(0, 180),
    sourceKind: String(value.sourceKind || "vworld_uv").slice(0, 40),
    targetAssetId: String(value.targetAssetId || "").slice(0, 120),
    targetSurfaceId: String(value.targetSurfaceId || "").slice(0, 120),
    returnUrl: "",
  });
}

function applyCatalogFocus(value) {
  const focus = normalizeCatalogFocus(value);
  if (!focus) return;
  CATALOG_FOCUS = focus;
  state.floor = focus.floor;
  vworld.catalogFocusBuilt = false;
  vworld.catalogFocusApplied = false;
  vworld.lastFloor = null;
  vworld.catalogFocus?.entities.removeAll();
  configureCatalogFocusUi();
  if (vworld.ready && window.Cesium) buildCatalogFocusMarker(window.Cesium);
  render();
}

function configureCatalogFocusUi() {
  if (!CATALOG_FOCUS) return;
  ui.app.dataset.catalogFocus = "true";
  ui.app.dataset.catalogFocusCoordinates = [CATALOG_FOCUS.longitude, CATALOG_FOCUS.latitude, CATALOG_FOCUS.height].join(",");
  ui.app.dataset.catalogFocusHeading = Number.isFinite(CATALOG_FOCUS.cameraHeading) ? String(CATALOG_FOCUS.cameraHeading) : "fallback";
  ui["catalog-focus"].hidden = false;
  ui["catalog-focus-title"].textContent = CATALOG_FOCUS.label;
  ui["catalog-focus-meta"].textContent = [CATALOG_FOCUS.floor, CATALOG_FOCUS.imageId, CATALOG_FOCUS.model].filter(Boolean).join(" · ");
  if (CATALOG_FOCUS.returnUrl) {
    try {
      const returnUrl = new URL(CATALOG_FOCUS.returnUrl, window.location.href);
      if (returnUrl.origin === window.location.origin) ui["catalog-focus-return"].href = returnUrl.href;
    } catch {
      // 기본 카탈로그 링크를 유지한다.
    }
  }
}

function buildCatalogFocusMarker(Cesium) {
  if (!CATALOG_FOCUS || !vworld.catalogFocus || vworld.catalogFocusBuilt) return;
  const position = catalogFocusPosition(Cesium, .35);
  vworld.catalogFocus.entities.add({
    id: `catalog-focus:${CATALOG_FOCUS.imageId || "selected"}`,
    name: CATALOG_FOCUS.label,
    position,
    point: {
      pixelSize: 13,
      color: Cesium.Color.fromCssColorString("#19d5e8").withAlpha(.34),
      outlineColor: Cesium.Color.WHITE,
      outlineWidth: 2,
    },
    label: {
      text: CATALOG_FOCUS.sourceKind === 'route_review_reference' ? '대표 위치 · 층 미확인'
        : CATALOG_FOCUS.sourceKind === 'route_review' ? '검토 후보 위치' : "선택 이미지 위치",
      font: "700 11px sans-serif",
      fillColor: Cesium.Color.fromCssColorString("#dffcff"),
      outlineColor: Cesium.Color.fromCssColorString("#031219"),
      outlineWidth: 5,
      style: Cesium.LabelStyle.FILL_AND_OUTLINE,
      pixelOffset: new Cesium.Cartesian2(0, -25),
    },
  });
  vworld.catalogFocusBuilt = true;
}

function flyToCatalogFocus(duration = .85) {
  if (!CATALOG_FOCUS || !vworld.ready || !window.Cesium) return;
  const Cesium = window.Cesium;
  stopVWorldRotation();
  if (catalogFocusedPhotobooth() && vworld.photobooth) {
    state.layers.renovation = true;
    const toggle = document.querySelector('[data-layer="renovation"]');
    if (toggle) toggle.checked = true;
    renderLayerState();
    vworld.photobooth.setVisible(true);
    vworld.photobooth.focus(duration, CATALOG_FOCUS.cameraHeading ?? PHOTOBOOTH.normalHeading);
    vworld.catalogFocusApplied = true;
    ui.app.dataset.catalogFocusApplied = 'true';
    ui.app.dataset.catalogFocusMode = 'photobooth';
    return;
  }
  const platformSurface = catalogFocusedPlatform111();
  if (platformSurface && activePlatform111()) {
    state.layers.renovation = true;
    const toggle = document.querySelector('[data-layer="renovation"]');
    if (toggle) toggle.checked = true;
    renderLayerState();
    // Keep the other-floor representation hidden; normal layer rendering handles masks.
    renderVWorldScene();
    activePlatform111().focus(platformSurface.id,duration);
    vworld.catalogFocusApplied = true;
    ui.app.dataset.catalogFocusApplied = 'true';
    ui.app.dataset.catalogFocusMode = 'platform111';
    return;
  }
  const centerSurface = catalogFocusedInformationCenter();
  if (centerSurface && vworld.informationCenter) {
    state.layers.renovation = true;
    const toggle = document.querySelector('[data-layer="renovation"]');
    if (toggle) toggle.checked = true;
    renderLayerState();
    vworld.informationCenter.setVisible(true);
    vworld.informationCenter.focus(centerSurface.id,duration);
    vworld.catalogFocusApplied = true;
    ui.app.dataset.catalogFocusApplied = 'true';
    ui.app.dataset.catalogFocusMode = 'information-center';
    return;
  }
  if (CATALOG_FOCUS.targetAssetId === TRAIN_MATES.id && vworld.trainMatesFacades) {
    state.layers.shops = true;
    vworld.assets.show = true;
    vworld.trainMatesFacades.setVisible(true);
    vworld.trainMatesFacades.focus(CATALOG_FOCUS.targetSurfaceId, duration);
    vworld.catalogFocusApplied = true;
    ui.app.dataset.catalogFocusApplied = 'true';
    ui.app.dataset.catalogFocusMode = 'train-mates';
    return;
  }
  const s11Shop = catalogFocusedS11Shop();
  if (s11Shop && vworld.s11Booths) {
    state.layers.renovation = true;
    const toggle = document.querySelector('[data-layer="renovation"]');
    if (toggle) toggle.checked = true;
    renderLayerState();
    vworld.s11Booths.setVisible(true);
    vworld.seoulRetirementMask?.setVisible({truedan:true,informationZone:true});
    vworld.s11Booths.focus(s11Shop.id,duration);
    vworld.catalogFocusApplied = true;
    ui.app.dataset.catalogFocusApplied = 'true';
    ui.app.dataset.catalogFocusMode = 's11-current-shop';
    return;
  }
  if (isTruedanCatalogFocus() && vworld.renovation) {
    state.layers.renovation = true;
    const renovationToggle = document.querySelector('[data-layer="renovation"]');
    if (renovationToggle) renovationToggle.checked = true;
    renderLayerState();
    vworld.renovation.setVisible(true);
    vworld.seoulRetirementMask?.setVisible({ truedan: true, informationZone: true });
    vworld.renovation.focus(duration);
    vworld.catalogFocusApplied = true;
    ui.app.dataset.catalogFocusApplied = "true";
    ui.app.dataset.catalogFocusMode = "app-asset";
    return;
  }
  const informationFacility = catalogFocusedInformationFacility();
  if (informationFacility && vworld.informationZone) {
    state.layers.renovation = true;
    const renovationToggle = document.querySelector('[data-layer="renovation"]');
    if (renovationToggle) renovationToggle.checked = true;
    renderLayerState();
    vworld.informationZone.setVisible(true);
    vworld.seoulRetirementMask?.setVisible({ truedan: true, informationZone: true });
    vworld.informationZone.focusAsset(informationFacility.id, duration);
    vworld.catalogFocusApplied = true;
    ui.app.dataset.catalogFocusApplied = "true";
    ui.app.dataset.catalogFocusMode = "app-asset";
    return;
  }
  const center = catalogFocusPosition(Cesium);
  const offset = catalogFocusCameraOffset(Cesium);
  vworld.viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);
  vworld.viewer.camera.flyToBoundingSphere(new Cesium.BoundingSphere(center, 2.5), {
    duration,
    offset,
  });
  vworld.catalogFocusApplied = true;
  ui.app.dataset.catalogFocusApplied = "true";
  ui.app.dataset.catalogFocusMode = "surface";
}

function isTruedanCatalogFocus() {
  return CATALOG_FOCUS?.sourceKind === "app_asset"
    && CATALOG_FOCUS.targetAssetId === TRUEDAN.id
    && CATALOG_FOCUS.targetSurfaceId === TRUEDAN_FACADE.targetSurfaceId;
}

function catalogFocusedS11Shop() {
  if (VWORLD_CONFIG.siteId !== S11_ZONE.site) return null;
  return S11_SHOPS.find(shop => shop.id === CATALOG_FOCUS?.targetAssetId
    || shop.alias === CATALOG_FOCUS?.label || shop.alias === CATALOG_FOCUS?.imageId) || null;
}

function catalogFocusedInformationFacility() {
  if (CATALOG_FOCUS?.sourceKind !== "app_asset") return null;
  return INFORMATION_FACILITIES.find((asset) => asset.id === CATALOG_FOCUS.targetAssetId
    && asset.surface.id === CATALOG_FOCUS.targetSurfaceId) || null;
}

function catalogFocusCameraOffset(Cesium) {
  if (CATALOG_FOCUS?.sourceKind === 'route_review_reference') {
    const east = (CATALOG_FOCUS.longitude - 126.97082) * Math.cos(37.55363 * Math.PI / 180) * 111320;
    const north = (CATALOG_FOCUS.latitude - 37.55363) * 111320;
    return new Cesium.HeadingPitchRange(Cesium.Math.toRadians(320), Cesium.Math.toRadians(-65), Math.max(260, Math.hypot(east,north) * 3));
  }
  if (CATALOG_FOCUS?.sourceKind === 'route_review') {
    return new Cesium.HeadingPitchRange(Cesium.Math.toRadians(320), Cesium.Math.toRadians(-45), 38);
  }
  const longitude = Number(CATALOG_FOCUS?.longitude);
  const latitude = Number(CATALOG_FOCUS?.latitude);
  const centerLongitude = Cesium.Math.toDegrees(VWORLD_CONFIG.centerLongitudeRad);
  const centerLatitude = Cesium.Math.toDegrees(VWORLD_CONFIG.centerLatitudeRad);
  const surfaceNormalHeading = Number(CATALOG_FOCUS?.cameraHeading);
  let heading = Number.isFinite(surfaceNormalHeading)
    ? catalogSurfaceNormalToViewHeading(Cesium, surfaceNormalHeading)
    : Cesium.Math.toRadians(322);

  if (!Number.isFinite(surfaceNormalHeading) && Number.isFinite(longitude) && Number.isFinite(latitude)) {
    // 개체의 바깥쪽에서 동일한 고정 방위로 보는 대신, 서울역 실내 중심 쪽에
    // 카메라를 놓는다. 곡면 파사드도 각 위치의 안쪽 면을 정면에 가깝게 본다.
    const averageLatitude = Cesium.Math.toRadians((latitude + centerLatitude) / 2);
    const east = (centerLongitude - longitude) * Math.cos(averageLatitude);
    const north = centerLatitude - latitude;
    if (Math.hypot(east, north) > 1e-8) {
      const cameraPositionBearing = Math.atan2(east, north);
      heading = Cesium.Math.zeroToTwoPi(cameraPositionBearing + Math.PI);
    }
  }

  if (isF02wl072FrameCatalogFocus()) {
    return new Cesium.HeadingPitchRange(
      heading,
      Cesium.Math.toRadians(-25),
      28,
    );
  }

  const facade = CATALOG_FOCUS?.targetAssetId === TRUEDAN.id
    || INFORMATION_FACILITY_IDS.includes(CATALOG_FOCUS?.targetAssetId)
    || /^[FB]\d{2}(?:WL|FC)/i.test(CATALOG_FOCUS?.model || "");
  // 가림 전수조사(tools/audit-facade-views.mjs)로 기둥·난간 등에 가리는 시설만 각도·거리·높이를 바꾼다.
  // 정면 사진이 없는 시설은 방향을 절대값(heading)으로, 사진 면이 있는 시설은 법선 기준 차이(headingOffset)로 둔다.
  const view = catalogFocusViewCorrection();
  return new Cesium.HeadingPitchRange(
    Number.isFinite(view?.heading) ? Cesium.Math.toRadians(view.heading) : heading + Cesium.Math.toRadians(view?.headingOffset ?? 0),
    Cesium.Math.toRadians(view?.pitch ?? (facade ? -3 : -22)),
    view?.range ?? (facade ? catalogFacadeCameraRange() : 30),
  );
}

function catalogFocusViewCorrection() {
  return FACADE_VIEW_CORRECTIONS.views?.[CATALOG_FOCUS?.imageId] || null;
}

function catalogFacadeCameraRange() {
  const exactWidth = Number(CATALOG_FOCUS?.surfaceWidth);
  const exactHeight = Number(CATALOG_FOCUS?.surfaceHeight);
  if ([exactWidth, exactHeight].every(Number.isFinite) && exactWidth > 0 && exactHeight > 0) {
    return Math.max(4.5, Math.min(9, Math.max(exactWidth * .92, exactHeight * 1.45) + 1.2));
  }
  const area = Number(CATALOG_FOCUS?.surfaceArea);
  const cropWidth = Number(CATALOG_FOCUS?.cropWidth);
  const cropHeight = Number(CATALOG_FOCUS?.cropHeight);
  if (!Number.isFinite(area) || area <= 0 || !Number.isFinite(cropWidth) || !Number.isFinite(cropHeight) || cropWidth <= 0 || cropHeight <= 0) return 8;
  const aspect = Math.max(.15, Math.min(8, cropWidth / cropHeight));
  const estimatedWidth = Math.sqrt(area * aspect);
  const estimatedHeight = Math.sqrt(area / aspect);
  // 고정 13.5m는 좁은 통로의 반대편 벽 뒤로 카메라를 보내는 경우가 있었다.
  // 선택 면 전체가 들어오되 같은 통로 안에 머물도록 사진 면 크기에 맞춰 4.5~9m로 제한한다.
  return Math.max(4.5, Math.min(9, Math.max(estimatedWidth * .92, estimatedHeight * 1.45) + 1.2));
}

function catalogSurfaceNormalToViewHeading(Cesium, surfaceNormalHeading) {
  // 추출값은 사진 면의 앞쪽 법선(카메라가 놓일 위치)이다. HeadingPitchRange의
  // heading은 그 위치에서 중심을 바라보는 시선 방향이므로 정확히 180° 반대다.
  return Cesium.Math.toRadians((surfaceNormalHeading + 180) % 360);
}

function catalogFocusedInformationCenter() {
  if (!INFORMATION_CENTER.enabled || VWORLD_CONFIG.siteId !== INFORMATION_CENTER.site) return null;
  return CATALOG_FOCUS?.targetAssetId === INFORMATION_CENTER.id
    ? informationCenterSurface(CATALOG_FOCUS.targetSurfaceId) || INFORMATION_CENTER_SURFACES[1]
    : informationCenterSurface(CATALOG_FOCUS?.label) || informationCenterSurface(CATALOG_FOCUS?.imageId);
}
function catalogFocusedPhotobooth() {
  if (!PHOTOBOOTH.enabled || VWORLD_CONFIG.siteId !== PHOTOBOOTH.site) return null;
  return photoboothSurface(CATALOG_FOCUS?.targetAssetId) || photoboothSurface(CATALOG_FOCUS?.label) || photoboothSurface(CATALOG_FOCUS?.imageId);
}
function activePlatform111() {
  return state.floor === PLATFORM111_WINDOW.floor ? vworld.platform111Window : vworld.platform111;
}

function catalogFocusedPlatform111() {
  if (!PLATFORM111.enabled || VWORLD_CONFIG.siteId !== PLATFORM111.site) return null;
  return CATALOG_FOCUS?.targetAssetId === PLATFORM111.id
    ? platform111Surface(CATALOG_FOCUS.targetSurfaceId) || PLATFORM111_SURFACES[0]
    : platform111Surface(CATALOG_FOCUS?.imageId) || platform111Surface(CATALOG_FOCUS?.label);
}

function catalogFocusPosition(Cesium, extraHeight = 0) {
  if (catalogFocusedPhotobooth() && vworld.photobooth) return vworld.photobooth.surfacePosition(extraHeight);
  const platformSurface = catalogFocusedPlatform111();
  if (platformSurface && activePlatform111()) return activePlatform111().surfacePosition(platformSurface.id,extraHeight);
  const centerSurface = catalogFocusedInformationCenter();
  if (centerSurface && vworld.informationCenter) return vworld.informationCenter.surfacePosition(centerSurface.id,extraHeight);
  if (CATALOG_FOCUS?.targetAssetId === TRAIN_MATES.id && vworld.trainMatesFacades) {
    return vworld.trainMatesFacades.surfacePosition(CATALOG_FOCUS.targetSurfaceId, extraHeight);
  }
  const s11Shop = catalogFocusedS11Shop();
  if (s11Shop) {
    const frame = Cesium.Transforms.eastNorthUpToFixedFrame(Cesium.Cartesian3.fromDegrees(...S11_ZONE.origin));
    const point = s11ShopCenter(s11Shop); point[2] += extraHeight;
    return Cesium.Matrix4.multiplyByPoint(frame,new Cesium.Cartesian3(...point),new Cesium.Cartesian3());
  }
  // A catalog tab can still hold pre-migration coordinates. Renderer-owned
  // assets must put their selection marker on the same current surface.
  const informationFacility = catalogFocusedInformationFacility();
  if (informationFacility) {
    const frame = Cesium.Transforms.eastNorthUpToFixedFrame(
      Cesium.Cartesian3.fromDegrees(...INFORMATION_ZONE.origin),
    );
    const point = informationFacilitySurfaceCenter(informationFacility);
    point[2] += extraHeight;
    return Cesium.Matrix4.multiplyByPoint(frame, new Cesium.Cartesian3(...point), new Cesium.Cartesian3());
  }
  // 카탈로그 ENU 좌표는 별도의 실내 기준점에서 계산됐다. 지도 로컬 프레임에
  // 그대로 대입하면 약 100m 어긋나므로, 원본 개체의 지리 좌표를 우선한다.
  if (Number.isFinite(CATALOG_FOCUS?.longitude) && Number.isFinite(CATALOG_FOCUS?.latitude)) {
    return Cesium.Cartesian3.fromDegrees(
      CATALOG_FOCUS.longitude,
      CATALOG_FOCUS.latitude,
      CATALOG_FOCUS.height + extraHeight,
    );
  }
  if (Number.isFinite(CATALOG_FOCUS?.east) && Number.isFinite(CATALOG_FOCUS?.north)) {
    return vworldEnuPosition(Cesium, CATALOG_FOCUS.east, CATALOG_FOCUS.north, CATALOG_FOCUS.height + extraHeight);
  }
  return null;
}

function buildTrainMatesAsset(Cesium) {
  if (!SHOW_TRAIN_MATES || !vworld.assets || vworld.trainMatesBuilt) return;
  vworld.trainMatesFacades = buildTrainMates(Cesium, vworld.viewer, vworld.assets, trainMatesPlacement, vworldEnuPosition);
  vworld.trainMatesFacades.setReplacements(vworld.approvedReplacements);
  vworld.trainMatesBuilt = true;
}

function loadTrainMatesPlacement() {
  const fallback = {
    centerEast: TRAIN_MATES.centerEast,
    centerNorth: TRAIN_MATES.centerNorth,
    baseUp: TRAIN_MATES.baseUp,
    headingDeg: TRAIN_MATES.headingDeg,
  };
  try {
    const saved = JSON.parse(localStorage.getItem(TRAIN_MATES_PLACEMENT_KEY) || "null");
    if (![saved?.centerEast, saved?.centerNorth, saved?.baseUp, saved?.headingDeg].every(Number.isFinite)) return fallback;
    return saved;
  } catch {
    return fallback;
  }
}

function rebuildTrainMatesAsset(Cesium) {
  if (!vworld.assets) return;
  vworld.trainMatesFacades?.destroy();
  vworld.assets.entities.removeAll();
  vworld.trainMatesBuilt = false;
  buildTrainMatesAsset(Cesium);
}

function toggleTrainMatesPlacement() {
  if (!vworld.ready || !window.Cesium) return showToast("VWorld 3D가 연결된 뒤 사용할 수 있습니다.");
  if (state.floor !== TRAIN_MATES.floor) {
    state.floor = TRAIN_MATES.floor;
    state.zoneId = TRAIN_MATES.zoneId;
  }
  vworld.placingTrainMates = !vworld.placingTrainMates;
  ui["place-trainmates"].classList.toggle("is-active", vworld.placingTrainMates);
  ui["place-trainmates"].querySelector("span").textContent = vworld.placingTrainMates ? "바닥 클릭" : "위치";
  ui["cesium-container"].classList.toggle("is-placing-asset", vworld.placingTrainMates);
  ui["placement-nav"].hidden = !vworld.placingTrainMates;
  render();
  showToast(vworld.placingTrainMates
    ? "위치 지정 중 · 에스컬레이터 우측의 원하는 바닥 중심을 클릭하세요."
    : "TRAIN MATES 위치 지정을 취소했습니다.");
}

function rotateTrainMates(deltaDegrees) {
  if (!vworld.ready || !window.Cesium) return showToast("VWorld 3D가 연결된 뒤 사용할 수 있습니다.");
  let headingDeg = trainMatesPlacement.headingDeg + deltaDegrees;
  if (headingDeg > 180) headingDeg -= 360;
  if (headingDeg <= -180) headingDeg += 360;
  trainMatesPlacement = { ...trainMatesPlacement, headingDeg };
  localStorage.setItem(TRAIN_MATES_PLACEMENT_KEY, JSON.stringify(trainMatesPlacement));
  rebuildTrainMatesAsset(window.Cesium);
  renderVWorldScene();
  showToast(`TRAIN MATES 방향 ${headingDeg.toFixed(0)}° · ${deltaDegrees > 0 ? "오른쪽" : "왼쪽"} ${Math.abs(deltaDegrees)}° 회전`);
}

function flyToTrainMatesPlacementArea(duration = .85) {
  if (!vworld.ready || !window.Cesium) return;
  const Cesium = window.Cesium;
  stopVWorldRotation();
  const center = vworldEnuPosition(
    Cesium,
    trainMatesPlacementCamera.east,
    trainMatesPlacementCamera.north,
    VWORLD_CONFIG.floorHeightMeters[TRAIN_MATES.floor] + 1.2,
  );
  vworld.viewer.camera.flyToBoundingSphere(new Cesium.BoundingSphere(center, 14), {
    duration,
    offset: new Cesium.HeadingPitchRange(
      Cesium.Math.toRadians(trainMatesPlacementCamera.headingDeg),
      Cesium.Math.toRadians(trainMatesPlacementCamera.pitchDeg),
      trainMatesPlacementCamera.range,
    ),
  });
  ui.app.dataset.placementCamera = `${trainMatesPlacementCamera.east},${trainMatesPlacementCamera.north},${trainMatesPlacementCamera.headingDeg},${trainMatesPlacementCamera.range}`;
}

function panTrainMatesPlacementCamera(action) {
  const step = 12;
  if (action === "north") trainMatesPlacementCamera.north += step;
  if (action === "south") trainMatesPlacementCamera.north -= step;
  if (action === "east") trainMatesPlacementCamera.east += step;
  if (action === "west") trainMatesPlacementCamera.east -= step;
  if (action === "zoom-in") trainMatesPlacementCamera.range = Math.max(22, trainMatesPlacementCamera.range - 8);
  if (action === "zoom-out") trainMatesPlacementCamera.range = Math.min(100, trainMatesPlacementCamera.range + 8);
  flyToTrainMatesPlacementArea(.55);
}

function placeTrainMatesAtScreenPoint(Cesium, screenPosition) {
  if (!vworld.viewer.scene.pickPositionSupported) {
    showToast("이 브라우저에서는 3D 바닥 좌표 선택을 지원하지 않습니다.");
    return;
  }
  const worldPosition = vworld.viewer.scene.pickPosition(screenPosition);
  if (!Cesium.defined(worldPosition)) {
    showToast("3D 바닥이 있는 지점을 다시 클릭해 주세요.");
    return;
  }
  const inverseFrame = Cesium.Matrix4.inverse(vworld.localFrame, new Cesium.Matrix4());
  const local = Cesium.Matrix4.multiplyByPoint(inverseFrame, worldPosition, new Cesium.Cartesian3());
  trainMatesPlacement = {
    centerEast: local.x,
    centerNorth: local.y,
    baseUp: local.z + .04,
    headingDeg: trainMatesPlacement.headingDeg,
  };
  localStorage.setItem(TRAIN_MATES_PLACEMENT_KEY, JSON.stringify(trainMatesPlacement));
  rebuildTrainMatesAsset(Cesium);
  vworld.placingTrainMates = false;
  ui["place-trainmates"].classList.remove("is-active");
  ui["place-trainmates"].querySelector("span").textContent = "위치";
  ui["placement-nav"].hidden = true;
  ui["cesium-container"].classList.remove("is-placing-asset");
  renderVWorldScene();
  showToast(`TRAIN MATES 위치 저장 · E ${local.x.toFixed(1)}m / N ${local.y.toFixed(1)}m`);
}

function vworldEnuPosition(Cesium, east, north, up) {
  return Cesium.Matrix4.multiplyByPoint(
    vworld.localFrame,
    new Cesium.Cartesian3(east, north, up),
    new Cesium.Cartesian3(),
  );
}

function renderVWorldOverlays(Cesium) {
  const entities = vworld.overlays.entities;
  entities.removeAll();
  const current = currentFootfallByZone();
  const zones = db.zones.filter((zone) => zone.floor_code === state.floor);
  const selectedZone = state.zoneId;
  const positions = new Map();

  zones.forEach((zone) => {
    const row = current.get(zone.zone_id) || fallbackFootfall(zone.zone_id);
    const crowd = displayCrowd(row);
    const position = vworldPosition(Cesium, zone.centroid_x, zone.centroid_y, state.floor, 2.2);
    positions.set(zone.zone_id, position);
    const selected = zone.zone_id === selectedZone;
    const color = crowd >= .82
      ? Cesium.Color.fromCssColorString("#ff465d")
      : crowd >= .6
        ? Cesium.Color.fromCssColorString("#ff9f1c")
        : Cesium.Color.fromCssColorString("#00d6c9");
    const commerceSales = zoneSalesRanking().find((item) => item.zone.zone_id === zone.zone_id)?.sales || 0;
    const labelValue = state.mode === "commerce" ? formatWon(commerceSales) : `${formatPercent(crowd)} · ${formatInt(row.occupancy_avg)}명`;
    const entity = entities.add({
      id: `zone:${zone.zone_id}`,
      position,
      properties: { zoneId: zone.zone_id, layer: "crowd", synthetic: true },
      ellipse: {
        show: state.layers.crowd,
        height: (VWORLD_CONFIG.floorHeightMeters[state.floor] ?? 27) + 2.2,
        heightReference: Cesium.HeightReference.NONE,
        semiMajorAxis: selected ? 24 : 17 + crowd * 8,
        semiMinorAxis: selected ? 16 : 11 + crowd * 5,
        material: color.withAlpha(selected ? .48 : .26 + Math.min(crowd, 1) * .2),
        outline: true,
        outlineColor: selected ? Cesium.Color.WHITE : color.withAlpha(.88),
        outlineWidth: selected ? 3 : 1,
      },
      point: {
        show: state.layers.crowd,
        pixelSize: selected ? 14 : 9,
        color,
        outlineColor: selected ? Cesium.Color.WHITE : color.withAlpha(.7),
        outlineWidth: selected ? 3 : 1,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
      label: {
        show: state.layers.labels,
        text: `${shortZoneName(zone.zone_name)}\n${labelValue}`,
        font: selected ? "700 13px sans-serif" : "600 11px sans-serif",
        fillColor: Cesium.Color.WHITE,
        outlineColor: Cesium.Color.fromCssColorString("#02101a"),
        outlineWidth: 4,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        pixelOffset: new Cesium.Cartesian2(0, selected ? -31 : -26),
        distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 900),
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
    });
    entity.name = `${VWORLD_CONFIG.siteName} ${zone.floor_code} ${zone.zone_name}`;
  });

  if ((state.mode === "simulation" || state.mode === "story") && positions.size > 1) {
    db.adjacency
      .filter((edge) => positions.has(edge.from_zone_id) && positions.has(edge.to_zone_id))
      .forEach((edge) => entities.add({
        id: `route:${edge.from_zone_id}:${edge.to_zone_id}`,
        polyline: {
          positions: [positions.get(edge.from_zone_id), positions.get(edge.to_zone_id)],
          width: 4,
          clampToGround: false,
          material: new Cesium.PolylineGlowMaterialProperty({
            color: Cesium.Color.fromCssColorString("#00d6c9").withAlpha(.9),
            glowPower: .28,
            taperPower: .6,
          }),
        },
      }));
  }

  if (state.layers.shops) {
    const rankedStores = topStoresForFloor(state.floor);
    const topStores = rankedStores.slice(0, 4);
    const topStoreIds = new Set(topStores.map((item) => item.store.store_id));
    const salesByStore = new Map(rankedStores.map((item) => [item.store.store_id, item.row.sales_krw]));
    const maxStoreSales = Math.max(1, ...rankedStores.map((item) => item.row.sales_krw));
    db.stores
      .filter((store) => store.floor_code === state.floor && store.business_status === "ACTIVE")
      .forEach((store) => {
        const sales = salesByStore.get(store.store_id) || 0;
        const isTopStore = topStoreIds.has(store.store_id);
        const barHeight = 6 + sales / maxStoreSales * 22;
        const labelHeight = state.mode === "commerce" && isTopStore ? barHeight + 2.5 : 4.5;
        entities.add({
          id: `store:${store.store_id}`,
          position: vworldPosition(Cesium, store.x, store.y, state.floor, labelHeight),
          properties: { zoneId: store.zone_id, layer: "shops", synthetic: true },
          point: {
            pixelSize: isTopStore ? 10 : 7,
            color: Cesium.Color.fromCssColorString("#1685ff"),
            outlineColor: Cesium.Color.fromCssColorString("#b8e8ff"),
            outlineWidth: 2,
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
          },
          label: {
            show: state.mode === "commerce" && isTopStore,
            text: `${store.store_name}\n${formatWon(sales)} · 가상`,
            font: "600 10px sans-serif",
            fillColor: Cesium.Color.fromCssColorString("#bfeaff"),
            outlineColor: Cesium.Color.fromCssColorString("#02101a"),
            outlineWidth: 3,
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            pixelOffset: new Cesium.Cartesian2(0, -17),
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
          },
        });
        if (state.mode === "commerce" && isTopStore) {
          entities.add({
            id: `store-bar:${store.store_id}`,
            position: vworldPosition(Cesium, store.x, store.y, state.floor, barHeight / 2 + .25),
            properties: { zoneId: store.zone_id, layer: "shops", synthetic: true, sales },
            cylinder: {
              length: barHeight,
              topRadius: 2.1,
              bottomRadius: 2.8,
              material: Cesium.Color.fromCssColorString("#1685ff").withAlpha(.68),
              outline: true,
              outlineColor: Cesium.Color.fromCssColorString("#8eeaff").withAlpha(.9),
            },
          });
        }
      });
  }

  if (state.layers.facilities) {
    const activeAlerts = db.alerts.filter((alert) => alert.status !== "RESOLVED" && db.zoneById.get(alert.zone_id)?.floor_code === state.floor);
    activeAlerts.forEach((alert, index) => {
      const zone = db.zoneById.get(alert.zone_id);
      if (!zone) return;
      const critical = ["HIGH", "CRITICAL"].includes(alert.severity);
      entities.add({
        id: `alert:${alert.alert_id || index}`,
        position: vworldPosition(Cesium, Number(zone.centroid_x) + 4, Number(zone.centroid_y) + 3, state.floor, 7),
        properties: { zoneId: zone.zone_id, layer: "facilities", synthetic: true },
        point: {
          pixelSize: critical ? 14 : 10,
          color: Cesium.Color.fromCssColorString(critical ? "#ff465d" : "#ff9f1c"),
          outlineColor: Cesium.Color.WHITE,
          outlineWidth: 2,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
        label: {
          text: `! ${alert.alert_type}`,
          font: "700 10px sans-serif",
          fillColor: Cesium.Color.fromCssColorString(critical ? "#ff9aaa" : "#ffd49a"),
          outlineColor: Cesium.Color.fromCssColorString("#21040a"),
          outlineWidth: 4,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          pixelOffset: new Cesium.Cartesian2(0, -20),
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
      });
    });
  }
}

function vworldPosition(Cesium, x, y, floor, extraHeight = 0) {
  const transform = VWORLD_CONFIG.overlayTransform;
  const east = (Number(x) - transform.originX) * transform.eastScale;
  const north = (Number(y) - transform.originY) * transform.northScale;
  const up = (VWORLD_CONFIG.floorHeightMeters[floor] ?? 27) + extraHeight;
  return vworldEnuPosition(Cesium, east, north, up);
}

function flyToTrainMates(duration = 1) {
  if (!vworld.ready || !window.Cesium) return;
  const Cesium = window.Cesium;
  state.layers.shops = true;
  vworld.placingTrainMates = false;
  ui['place-trainmates'].classList.remove('is-active');
  ui['place-trainmates'].querySelector('span').textContent = '위치';
  ui['cesium-container'].classList.remove('is-placing-asset');
  ui['placement-nav'].hidden = true;
  const shopsToggle = document.querySelector('[data-layer="shops"]');
  if (shopsToggle) shopsToggle.checked = true;
  if (state.floor !== TRAIN_MATES.floor) {
    state.floor = TRAIN_MATES.floor;
    state.zoneId = TRAIN_MATES.zoneId;
    render();
  }
  stopVWorldRotation();
  renderVWorldScene();
  vworld.trainMatesFacades?.focus(null, duration);
  showToast("TRAIN MATES 서울역점 · 2F 배치 위치로 이동했습니다.");
}

function flyToVWorldFloor(floor, duration = .85) {
  if (!vworld.ready || !window.Cesium) return;
  const Cesium = window.Cesium;
  const camera = VWORLD_CONFIG.floorCamera;
  vworld.viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);
  const center = vworldPosition(Cesium, camera.centerX, camera.centerY, floor, 0);
  const sphere = new Cesium.BoundingSphere(center, camera.radius);
  vworld.viewer.camera.flyToBoundingSphere(sphere, {
    duration,
    offset: new Cesium.HeadingPitchRange(vworld.heading, Cesium.Math.toRadians(-34), camera.range),
  });
}

function startVWorldRotation() {
  if (!vworld.ready || vworld.rotating) return;
  const Cesium = window.Cesium;
  vworld.rotating = true;
  ui["camera-rotate"].classList.add("is-active");
  ui["camera-rotate"].querySelector("span").textContent = "정지";
  let lastTime = performance.now();
  const rotate = (time) => {
    if (!vworld.rotating) return;
    const delta = Math.min(40, time - lastTime);
    lastTime = time;
    vworld.heading = (vworld.heading + delta * .00012) % (Math.PI * 2);
    const camera = VWORLD_CONFIG.floorCamera;
    const center = vworldPosition(Cesium, camera.centerX, camera.centerY, state.floor, 0);
    vworld.viewer.camera.lookAt(center, new Cesium.HeadingPitchRange(vworld.heading, Cesium.Math.toRadians(-34), camera.range));
    vworld.rotateFrame = requestAnimationFrame(rotate);
  };
  vworld.rotateFrame = requestAnimationFrame(rotate);
}

function stopVWorldRotation() {
  if (vworld.rotateFrame) cancelAnimationFrame(vworld.rotateFrame);
  vworld.rotateFrame = null;
  vworld.rotating = false;
  ui["camera-rotate"]?.classList.remove("is-active");
  const label = ui["camera-rotate"]?.querySelector("span");
  if (label) label.textContent = "회전";
  if (vworld.viewer && window.Cesium) vworld.viewer.camera.lookAtTransform(window.Cesium.Matrix4.IDENTITY);
}

function bindEvents() {
  ui["station-switcher"].addEventListener("change", (event) => {
    const siteId = event.target.value === "S201801" ? "S201801" : "S202103";
    const url = new URL(window.location.href);
    url.search = "";
    url.searchParams.set("site", siteId);
    window.location.assign(url);
  });
  window.addEventListener("message", (event) => {
    if (event.origin === window.location.origin && event.source === window.parent
        && event.data?.type === 'station-one:route-review-focus') {
      const f = event.data.focus;
      const valid = VWORLD_CONFIG.siteId === 'S202103' && vworld.ready && ['route_review','route_review_reference'].includes(f?.sourceKind)
        && ['B7','B6','B3','B2','B1','1F','2F','3F','4F','RF'].includes(f.floor)
        && typeof f.longitude === 'number' && f.longitude > 126.95 && f.longitude < 126.99
        && typeof f.latitude === 'number' && f.latitude > 37.53 && f.latitude < 37.58
        && typeof f.height === 'number' && Number.isFinite(f.height) && f.height > -50 && f.height < 100;
      if (valid) applyCatalogFocus({ floor:f.floor, longitude:f.longitude, latitude:f.latitude,
        height:f.height, label:f.label, imageId:f.imageId, sourceKind:f.sourceKind });
      event.source.postMessage({ type:'station-one:route-review-applied', requestId:event.data.requestId,
        ok:Boolean(valid), floor:valid ? f.floor : null }, event.origin);
      return;
    }
    if (event.origin === window.location.origin && event.source === window.parent
        && event.data?.type === 'station-one:catalog-focus-clear') {
      CATALOG_FOCUS = null;
      vworld.catalogFocus?.entities.removeAll();
      vworld.catalogFocusBuilt = false;
      ui.app.dataset.catalogFocus = 'false';
      ui["catalog-focus"].hidden = true;
      vworld.viewer?.scene.requestRender();
      return;
    }
    if (event.origin === window.location.origin && event.source === window.parent
        && event.data?.type === 'station-one:facade-demo-preview') {
      const d = event.data, reply = (ok, matched = null) => event.source.postMessage({ type:'station-one:facade-demo-preview-applied', requestId:d.requestId, ok, matched }, event.origin);
      const clear = d.imageUrl === null;
      const valid = VWORLD_CONFIG.siteId === 'S202103' && (clear || typeof d.slotAlias === 'string' && d.slotAlias.length > 0 && d.slotAlias.length <= 120
        && typeof d.imageUrl === 'string' && d.imageUrl.length <= 400000 && /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(d.imageUrl));
      if (!valid) { reply(false); return; }
      DEMO_FACADE = clear ? null : { slotAlias:d.slotAlias, imageUrl:d.imageUrl };
      refreshApprovedReplacementOverlays().then(() => reply(true, clear ? null : Boolean(vworld.demoFacadeMatched)));
      return;
    }
    if (event.origin !== window.location.origin || event.data?.type !== "station-one:catalog-focus") return;
    applyCatalogFocus(event.data.focus);
    event.source?.postMessage({
      type: "station-one:catalog-focus-applied",
      requestId: event.data.requestId,
      floor: CATALOG_FOCUS?.floor,
      label: CATALOG_FOCUS?.label,
    }, event.origin);
  });
  document.querySelectorAll(".mode-button").forEach((button) => {
    button.addEventListener("click", () => setMode(button.dataset.mode));
  });

  document.querySelectorAll("[data-layer]").forEach((input) => {
    input.addEventListener("change", () => {
      state.layers[input.dataset.layer] = input.checked;
      renderLayerState();
      renderMap();
    });
  });

  ui["date-select"].addEventListener("change", (event) => {
    state.date = event.target.value;
    render();
  });
  ui["hour-range"].addEventListener("input", (event) => {
    state.hour = Number(event.target.value);
    render();
  });
  ui["timeline-play"].addEventListener("click", togglePlayback);
  ui["camera-home"].addEventListener("click", () => {
    if (!vworld.ready) return showToast("VWorld 3D가 연결된 뒤 사용할 수 있습니다.");
    stopVWorldRotation();
    flyToVWorldFloor(state.floor);
  });
  ui["camera-trainmates"].addEventListener("click", () => {
    if (!vworld.ready) return showToast("VWorld 3D가 연결된 뒤 사용할 수 있습니다.");
    flyToTrainMates();
  });
  ui["place-trainmates"].addEventListener("click", toggleTrainMatesPlacement);
  ui["rotate-trainmates-left"].addEventListener("click", () => rotateTrainMates(-1));
  ui["rotate-trainmates-right"].addEventListener("click", () => rotateTrainMates(1));
  ui["placement-nav"].querySelectorAll("[data-placement-pan]").forEach((button) => {
    button.addEventListener("click", () => panTrainMatesPlacementCamera(button.dataset.placementPan));
  });
  ui["camera-rotate"].addEventListener("click", () => {
    if (!vworld.ready) return showToast("VWorld 3D가 연결된 뒤 사용할 수 있습니다.");
    if (vworld.rotating) stopVWorldRotation();
    else startVWorldRotation();
  });

  ui["scenario-select"].addEventListener("change", (event) => {
    state.scenarioId = event.target.value;
    const scenario = getScenario();
    state.demandPct = Math.round((scenario?.demand_multiplier || 1) * 100);
    ui["demand-range"].value = state.demandPct;
    render();
  });
  ui["demand-range"].addEventListener("input", (event) => {
    state.demandPct = Number(event.target.value);
    render();
  });

  ui["story-next"].addEventListener("click", () => {
    state.storyIndex = (state.storyIndex + 1) % storySteps.length;
    const step = storySteps[state.storyIndex];
    state.floor = step.floor;
    state.zoneId = step.zoneId;
    render();
  });

  ui["decision-button"].addEventListener("click", () => {
    const scenario = getScenario();
    const message = state.mode === "simulation"
      ? `${scenario.scenario_name}: 권장 조치를 적용한 모의결과를 화면에 반영했습니다.`
      : "권장 조치를 운영 플레이북에 임시 반영했습니다. 실제 시스템에는 전송되지 않습니다.";
    showToast(message);
    ui["decision-button"].textContent = "모의실행 완료 ✓";
    setTimeout(() => { ui["decision-button"].textContent = "권장 조치 모의실행"; }, 1800);
  });
}

function announceCatalogMapReady() {
  if (window.parent === window) return;
  window.parent.postMessage({
    type: "station-one:catalog-map-ready",
    vworldReady: Boolean(vworld.ready && vworld.mapVisible),
  }, window.location.origin);
}

function populateDateSelect() {
  ui["date-select"].innerHTML = db.dates.map((date) => `<option value="${date}" ${date === state.date ? "selected" : ""}>${date}</option>`).join("");
}

function populateScenarioSelect() {
  ui["scenario-select"].innerHTML = db.scenarios.map((scenario) => `<option value="${escapeHtml(scenario.scenario_id)}">${escapeHtml(scenario.scenario_name)}</option>`).join("");
  ui["scenario-select"].value = state.scenarioId;
}

function setMode(mode) {
  state.mode = mode;
  document.querySelectorAll(".mode-button").forEach((button) => {
    const active = button.dataset.mode === mode;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  render();
}

function render() {
  if (!db) return;
  ensureValidSelection();
  ui.app.dataset.mode = state.mode;
  ui["date-select"].value = state.date;
  ui["hour-range"].value = String(state.hour);
  ui["time-output"].textContent = `${String(state.hour).padStart(2, "0")}:00`;
  renderLayerState();
  renderFloors();
  renderStageCopy();
  renderMap();
  renderZoneCard();
  renderRightPanel();
  renderStory();
  renderVWorldScene();
}

function ensureValidSelection() {
  const selected = db.zoneById.get(state.zoneId);
  if (!selected || selected.floor_code !== state.floor) {
    state.zoneId = db.zones.find((zone) => zone.floor_code === state.floor)?.zone_id || db.zones[0].zone_id;
  }
}

function renderLayerState() {
  Object.entries(state.layers).forEach(([name, value]) => { ui.app.dataset[`layer${capitalize(name)}`] = String(value); });
}

function renderFloors() {
  const order = Object.keys(VWORLD_CONFIG.floorHeightMeters).reverse();
  const floorNames = new Map(db.floors.map((floor) => [floor.floor_code, floor.floor_name]));
  const current = currentFootfallByZone();
  ui["floor-list"].innerHTML = order.filter((floor) => floorNames.has(floor)).map((floor) => {
    const floorRows = db.zones.filter((zone) => zone.floor_code === floor).map((zone) => current.get(zone.zone_id)).filter(Boolean);
    const peak = floorRows.length ? Math.max(...floorRows.map((row) => displayCrowd(row))) : 0;
    const status = peak >= .82 ? "혼잡" : peak >= .62 ? "주의" : "원활";
    const statusClass = peak >= .82 ? "is-hot" : peak >= .62 ? "is-warn" : "";
    return `<button class="floor-button ${floor === state.floor ? "is-active" : ""}" type="button" data-floor="${floor}" aria-pressed="${floor === state.floor}"><b>${floor}</b><span>${escapeHtml(floorNames.get(floor))}</span><em class="${statusClass}">${status}</em></button>`;
  }).join("");

  ui["floor-list"].querySelectorAll(".floor-button").forEach((button) => {
    button.addEventListener("click", () => {
      state.floor = button.dataset.floor;
      state.zoneId = db.zones.find((zone) => zone.floor_code === state.floor)?.zone_id;
      render();
    });
  });
}

function renderStageCopy() {
  const current = currentFootfallByZone();
  const floorZones = db.zones.filter((zone) => zone.floor_code === state.floor);
  const peakZone = floorZones
    .map((zone) => ({ zone, row: current.get(zone.zone_id) }))
    .filter((item) => item.row)
    .sort((a, b) => displayCrowd(b.row) - displayCrowd(a.row))[0];

  if (state.mode === "operations") {
    ui["stage-kicker"].textContent = "OPERATIONS · SITUATIONAL AWARENESS";
    ui["stage-title"].textContent = peakZone ? `${peakZone.zone.zone_name} 혼잡 ${formatPercent(displayCrowd(peakZone.row))}` : "운영 신호를 확인하세요";
    ui["stage-subtitle"].textContent = `${state.date} ${String(state.hour).padStart(2, "0")}:00 · 열차·유동·시설 경보를 구역 단위로 결합한 합성 관제 화면입니다.`;
  } else if (state.mode === "commerce") {
    const ranked = zoneSalesRanking().filter((item) => item.zone.floor_code === state.floor);
    ui["stage-kicker"].textContent = "COMMERCE · FLOW TO VALUE";
    ui["stage-title"].textContent = ranked[0] ? `${ranked[0].zone.zone_name} · 월매출 ${formatWon(ranked[0].sales)}` : "상권 흐름을 확인하세요";
    ui["stage-subtitle"].textContent = "유동·체류 대비 매출 전환이 낮은 구역을 찾고 프로모션 대안을 비교합니다.";
  } else if (state.mode === "simulation") {
    const scenario = getScenario();
    ui["stage-kicker"].textContent = "WHAT-IF · TEST BEFORE INVEST";
    ui["stage-title"].textContent = `${scenario.scenario_name} · 수요 ${state.demandPct}%`;
    ui["stage-subtitle"].textContent = `${scenario.recommended_action} · 화면 결과는 검증 전 모의값입니다.`;
  } else {
    const step = storySteps[state.storyIndex];
    ui["stage-kicker"].textContent = "PUBLIC DEMO · DECISION STORY";
    ui["stage-title"].textContent = step.title.replace(/^\d+ · /, "");
    ui["stage-subtitle"].textContent = step.copy;
  }
}

function renderMap() {
  const current = currentFootfallByZone();
  const floorZones = db.zones.filter((zone) => zone.floor_code === state.floor);
  const zonePositions = new Map();
  const salesRanking = zoneSalesRanking();
  const maxSales = Math.max(1, ...salesRanking.map((item) => item.sales));
  const salesByZone = new Map(salesRanking.map((item) => [item.zone.zone_id, item.sales]));

  ui["zone-layer"].innerHTML = floorZones.map((zone) => {
    const row = current.get(zone.zone_id) || fallbackFootfall(zone.zone_id);
    const crowd = displayCrowd(row);
    const { x, y } = project(zone.centroid_x, zone.centroid_y);
    zonePositions.set(zone.zone_id, { x, y });
    const width = clamp(102 + zone.capacity / 31, 112, 205);
    const height = width * .42;
    const points = `${x},${y - height / 2} ${x + width / 2},${y} ${x},${y + height / 2} ${x - width / 2},${y}`;
    const side = `${x - width / 2},${y} ${x},${y + height / 2} ${x},${y + height / 2 + 17} ${x - width / 2},${y + 17}`;
    const sideRight = `${x},${y + height / 2} ${x + width / 2},${y} ${x + width / 2},${y + 17} ${x},${y + height / 2 + 17}`;
    const heatFill = crowd >= .82 ? "url(#heat-hot)" : crowd >= .6 ? "url(#heat-warm)" : "url(#heat-cool)";
    const commerceIntensity = (salesByZone.get(zone.zone_id) || 0) / maxSales;
    const topFill = state.mode === "commerce"
      ? mixColor("#0c334a", "#238ac1", commerceIntensity)
      : crowd >= .82 ? "#5b2731" : crowd >= .6 ? "#4b3a25" : "#0d3a4d";
    const selected = zone.zone_id === state.zoneId;
    return `
      <g class="zone-group ${selected ? "is-selected" : ""}" data-zone-id="${zone.zone_id}" role="button" tabindex="0" aria-label="${escapeHtml(zone.zone_name)}, 혼잡 ${formatPercent(crowd)}">
        <circle class="heat-halo" cx="${x}" cy="${y}" r="${Math.round(58 + crowd * 82)}" fill="${heatFill}" opacity="${clamp(.28 + crowd * .58, .28, .9)}" />
        <polygon class="zone-side" points="${side}" fill="#071d2b" stroke="#20506a" />
        <polygon class="zone-side" points="${sideRight}" fill="#061723" stroke="#20506a" />
        <polygon class="zone-top" points="${points}" fill="${topFill}" stroke="#3a7897" stroke-width="2" />
        <text class="zone-label" x="${x}" y="${y - 2}">${escapeHtml(shortZoneName(zone.zone_name))}</text>
        <text class="zone-sub" x="${x}" y="${y + 12}">${formatPercent(crowd)} · ${formatInt(row.occupancy_avg)}명</text>
      </g>`;
  }).join("");

  ui["zone-layer"].querySelectorAll(".zone-group").forEach((group) => {
    const select = () => { state.zoneId = group.dataset.zoneId; render(); };
    group.addEventListener("click", select);
    group.addEventListener("keydown", (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); select(); } });
  });

  const routeLines = db.adjacency.filter((edge) => zonePositions.has(edge.from_zone_id) && zonePositions.has(edge.to_zone_id)).map((edge) => {
    const from = zonePositions.get(edge.from_zone_id);
    const to = zonePositions.get(edge.to_zone_id);
    const controlX = (from.x + to.x) / 2;
    const controlY = Math.min(from.y, to.y) - 30;
    return `<path class="route-line" d="M ${from.x} ${from.y} Q ${controlX} ${controlY} ${to.x} ${to.y}" />`;
  });
  ui["route-layer"].innerHTML = routeLines.join("");

  const floorStores = db.stores.filter((store) => store.floor_code === state.floor && store.business_status === "ACTIVE");
  const topStoreIds = new Set(topStoresForFloor(state.floor).slice(0, 4).map((item) => item.store.store_id));
  const shopMarkers = floorStores.map((store, index) => {
    const pos = project(store.x, store.y);
    const y = pos.y - 14 - (index % 2) * 5;
    const showLabel = state.mode === "commerce" && topStoreIds.has(store.store_id);
    return `<g class="shop-marker" data-zone-id="${store.zone_id}" transform="translate(${pos.x},${y})"><polygon points="0,-8 8,0 0,8 -8,0" /><text y="-12" style="display:${showLabel ? "block" : "none"}">${escapeHtml(store.store_id)}</text></g>`;
  });

  const activeAlerts = db.alerts.filter((alert) => alert.status !== "RESOLVED");
  const facilityMarkers = floorZones.map((zone) => {
    const pos = zonePositions.get(zone.zone_id);
    const assets = db.facilities.filter((asset) => asset.zone_id === zone.zone_id);
    const hasAlert = activeAlerts.some((alert) => alert.zone_id === zone.zone_id && ["HIGH", "CRITICAL"].includes(alert.severity));
    return `<g class="facility-marker ${hasAlert ? "has-alert" : ""}" transform="translate(${pos.x + 42},${pos.y - 34})"><circle r="13" /><text y="3">${assets.length}</text></g>`;
  });
  ui["marker-layer"].innerHTML = [...shopMarkers, ...facilityMarkers].join("");
  ui["marker-layer"].querySelectorAll("[data-zone-id]").forEach((marker) => marker.addEventListener("click", () => { state.zoneId = marker.dataset.zoneId; render(); }));
}

function renderZoneCard() {
  const zone = db.zoneById.get(state.zoneId);
  const row = currentFootfallByZone().get(state.zoneId) || fallbackFootfall(state.zoneId);
  const crowd = displayCrowd(row);
  const floorAlert = db.alerts.find((alert) => alert.zone_id === state.zoneId && alert.status !== "RESOLVED");
  ui["zone-card-title"].textContent = `${zone.floor_code} · ${zone.zone_name}`;
  ui["zone-card-copy"].textContent = floorAlert ? floorAlert.recommendation : `${zone.zone_type} · 수용 ${formatInt(zone.capacity)}명 · 개인식별 없는 구역 집계`;
  ui["zone-card-crowd"].textContent = formatPercent(crowd);
  ui["zone-card-occupancy"].textContent = `${formatInt(row.occupancy_avg)}명`;
  ui["zone-card-dwell"].textContent = `${formatNumber(row.dwell_minutes, 1)}분`;
}

function renderRightPanel() {
  const context = `${state.floor} · ${String(state.hour).padStart(2, "0")}:00`;
  ui["right-context"].textContent = context;
  ui["scenario-panel"].hidden = state.mode !== "simulation";

  if (state.mode === "commerce") renderCommercePanel();
  else if (state.mode === "simulation") renderSimulationPanel();
  else renderOperationsPanel(state.mode === "story");
}

function renderOperationsPanel(story = false) {
  const current = currentFootfallByZone();
  const floorZones = db.zones.filter((zone) => zone.floor_code === state.floor);
  const rows = floorZones.map((zone) => current.get(zone.zone_id)).filter(Boolean);
  const occupancy = rows.reduce((sum, row) => sum + row.occupancy_avg, 0);
  const predicted = rows.reduce((sum, row) => sum + row.predicted_15m, 0);
  const peak = rows.length ? Math.max(...rows.map((row) => displayCrowd(row))) : 0;
  const floorAssets = db.facilities.filter((asset) => asset.floor_code === state.floor);
  const availableAssets = floorAssets.filter((asset) => asset.status !== "ATTENTION").length;
  const normalRate = floorAssets.length ? availableAssets / floorAssets.length : 0;
  const delayed = relevantTrains().filter((train) => train.delay_min > 0);
  const floorAlerts = db.alerts.filter((alert) => alert.status !== "RESOLVED" && db.zoneById.get(alert.zone_id)?.floor_code === state.floor);

  ui["right-kicker"].textContent = story ? "DECISION STORY" : "LIVE SIGNAL";
  ui["hero-value"].textContent = formatInt(occupancy);
  ui["hero-label"].textContent = "현재 점유인원";
  ui["hero-delta"].textContent = predicted > occupancy ? `15분 후 +${formatInt(predicted - occupancy)}명 예상` : "15분 후 안정 예상";
  renderMetrics([
    ["PEAK CROWD", formatPercent(peak), peak >= .82 ? "대응 필요" : "관리 범위"],
    ["15M FORECAST", `${formatInt(predicted)}명`, "구역 합산"],
    ["AVAILABLE ASSETS", formatPercent(normalRate), `${availableAssets}/${floorAssets.length} 가동`],
    ["DELAYED TRAIN", `${delayed.length}편`, "±1시간"],
  ]);

  const signals = [
    ...floorAlerts.map((alert) => ({ title: `${alert.alert_type} · ${db.zoneById.get(alert.zone_id)?.zone_name}`, copy: alert.recommendation, severity: alert.severity, time: alert.status })),
    ...delayed.slice(0, 3).map((train) => ({ title: `${train.train_id} ${train.delay_min}분 지연`, copy: `${train.origin} → ${train.destination} · ${train.platform}번 승강장`, severity: train.delay_min >= 20 ? "HIGH" : "MEDIUM", time: train.scheduled_time })),
  ];
  ui["list-title"].textContent = "ACTIVE SIGNALS";
  renderSignals(signals.slice(0, 5));
  ui["decision-copy"].textContent = story
    ? storySteps[state.storyIndex].copy
    : floorAlerts[0]?.recommendation || (peak >= .7 ? "혼잡 상위 구역에 안내 인력을 선배치하고 인접층 대기공간을 개방하세요." : "현재 운영은 관리 범위입니다. 시설 주의 자산을 예방점검 목록에 추가하세요.");
}

function renderCommercePanel() {
  const currentPeriod = db.periods.at(-1);
  const previousPeriod = db.periods.at(-2);
  const floorStoreIds = new Set(db.stores.filter((store) => store.floor_code === state.floor).map((store) => store.store_id));
  const currentRows = db.sales.filter((row) => row.period === currentPeriod && floorStoreIds.has(row.store_id));
  const previousRows = db.sales.filter((row) => row.period === previousPeriod && floorStoreIds.has(row.store_id));
  const sales = sum(currentRows, "sales_krw");
  const previousSales = sum(previousRows, "sales_krw");
  const delta = previousSales ? sales / previousSales - 1 : 0;
  const transactions = sum(currentRows, "transactions");
  const visitors = sum(currentRows, "visitors_est");
  const conversion = visitors ? transactions / visitors : 0;
  const avgTicket = transactions ? sales / transactions : 0;
  const topStores = topStoresForFloor(state.floor).slice(0, 5);

  ui["right-kicker"].textContent = "COMMERCE SIGNAL";
  ui["hero-value"].textContent = formatWon(sales);
  ui["hero-label"].textContent = `${currentPeriod} 선택층 매출`;
  ui["hero-delta"].textContent = `${delta >= 0 ? "+" : ""}${formatPercent(delta)} vs ${previousPeriod}`;
  renderMetrics([
    ["TRANSACTIONS", formatInt(transactions), `${floorStoreIds.size}개 점포`],
    ["VISITORS EST.", formatInt(visitors), "합성 추정"],
    ["AVG TICKET", formatWon(avgTicket), "거래당"],
    ["CONVERSION", formatPercent(conversion), "유입 대비"],
  ]);
  ui["list-title"].textContent = "TOP STORES";
  renderSignals(topStores.map((item, index) => ({
    title: `${index + 1}. ${item.store.store_name}`,
    copy: `${item.store.category_l1} · ${item.store.category_l2} · ${formatInt(item.row.transactions)}건`,
    severity: index === 0 ? "HIGH" : "LOW",
    time: formatWon(item.row.sales_krw),
  })));
  const lowConversion = [...currentRows].sort((a, b) => a.conversion_rate - b.conversion_rate)[0];
  const lowStore = db.storeById.get(lowConversion?.store_id);
  ui["decision-copy"].textContent = lowStore
    ? `${lowStore.store_name}의 전환율이 ${formatPercent(lowConversion.conversion_rate)}로 선택층 최저입니다. 18~20시 공동쿠폰과 인접 동선을 묶어 검증하세요.`
    : "유동 대비 매출 전환이 낮은 구역을 선택해 프로모션을 설계하세요.";
}

function renderSimulationPanel() {
  const scenario = getScenario();
  const factor = state.demandPct / Math.max(1, scenario.demand_multiplier * 100);
  const predictedPeak = clamp(scenario.predicted_peak_crowd * factor, 0, 1.25);
  const baseline = scenario.baseline_peak_crowd;
  const response = Math.max(2.5, scenario.recommended_response_min / Math.max(.75, factor));
  const salesEffect = scenario.sales_opportunity_krw * factor;

  ui["right-kicker"].textContent = "SCENARIO RESULT";
  ui["hero-value"].textContent = formatPercent(predictedPeak);
  ui["hero-label"].textContent = "예측 최대 혼잡지수";
  ui["hero-delta"].textContent = `${formatSignedPercent(predictedPeak - baseline)}p vs 평시`;
  ui["demand-output"].textContent = `${state.demandPct}%`;
  ui["scenario-select"].value = state.scenarioId;
  ui["demand-range"].value = String(state.demandPct);
  renderMetrics([
    ["BASELINE", formatPercent(baseline), "평시 피크"],
    ["RESPONSE", `${formatNumber(response, 1)}분`, "권장 시작"],
    ["TRAIN DELAY", `${scenario.train_delay_min}분`, scenario.trigger_type],
    ["SALES EFFECT", formatWon(salesEffect), "모의값"],
  ]);
  ui["scenario-result"].innerHTML = [
    ["혼잡 변화", formatSignedPercent(predictedPeak - baseline)],
    ["수요 배율", `${state.demandPct}%`],
    ["폐쇄 구역", scenario.closed_zone_id || "없음"],
    ["결과 상태", scenario.result_label],
  ].map(([label, value]) => `<span>${label}<b>${escapeHtml(String(value))}</b></span>`).join("");

  const impacted = db.zones.filter((zone) => zone.floor_code === state.floor).map((zone) => {
    const row = currentFootfallByZone().get(zone.zone_id) || fallbackFootfall(zone.zone_id);
    return { zone, crowd: clamp(row.crowd_index * state.demandPct / 100, 0, 1.25) };
  }).sort((a, b) => b.crowd - a.crowd);
  ui["list-title"].textContent = "IMPACTED ZONES";
  renderSignals(impacted.slice(0, 5).map((item) => ({
    title: item.zone.zone_name,
    copy: `${item.zone.zone_type} · 수용 ${formatInt(item.zone.capacity)}명`,
    severity: item.crowd >= .82 ? "HIGH" : item.crowd >= .62 ? "MEDIUM" : "LOW",
    time: formatPercent(item.crowd),
  })));
  ui["decision-copy"].textContent = `${scenario.recommended_action}. 실제 적용 전 운영기관 검증이 필요합니다.`;
}

function renderMetrics(metrics) {
  ui["metric-grid"].innerHTML = metrics.map(([label, value, note]) => `<div class="metric"><small>${escapeHtml(label)}</small><strong>${escapeHtml(String(value))}</strong><em>${escapeHtml(String(note))}</em></div>`).join("");
}

function renderSignals(signals) {
  ui["list-count"].textContent = String(signals.length);
  ui["signal-list"].innerHTML = signals.length
    ? signals.map((signal) => `<article class="signal-item" data-severity="${signal.severity || "LOW"}"><i aria-hidden="true"></i><div><strong>${escapeHtml(signal.title)}</strong><span>${escapeHtml(signal.copy)}</span></div><time>${escapeHtml(String(signal.time || ""))}</time></article>`).join("")
    : `<div class="empty-state">선택 조건의 활성 신호가 없습니다.</div>`;
}

function renderStory() {
  const step = storySteps[state.storyIndex];
  ui["story-step"].textContent = step.title;
  ui["story-copy"].textContent = step.copy;
}

function currentFootfallByZone() {
  return new Map(db.footfall.filter((row) => row.date === state.date && row.hour === state.hour).map((row) => [row.zone_id, row]));
}

function fallbackFootfall(zoneId) {
  return db.footfall.find((row) => row.zone_id === zoneId) || { occupancy_avg: 0, predicted_15m: 0, dwell_minutes: 0, crowd_index: 0, capacity: 1 };
}

function displayCrowd(row) {
  if (state.mode === "simulation" || state.mode === "story") return clamp(row.crowd_index * state.demandPct / 100, 0, 1.25);
  return row.crowd_index;
}

function relevantTrains() {
  return db.trains.filter((train) => train.service_date === state.date && Math.abs(Number(String(train.scheduled_time).slice(0, 2)) - state.hour) <= 1);
}

function zoneSalesRanking() {
  const period = db.periods.at(-1);
  const salesByZone = new Map();
  db.sales.filter((row) => row.period === period).forEach((row) => salesByZone.set(row.zone_id, (salesByZone.get(row.zone_id) || 0) + row.sales_krw));
  return db.zones.map((zone) => ({ zone, sales: salesByZone.get(zone.zone_id) || 0 })).sort((a, b) => b.sales - a.sales);
}

function topStoresForFloor(floor) {
  const period = db.periods.at(-1);
  return db.sales
    .filter((row) => row.period === period && db.storeById.get(row.store_id)?.floor_code === floor)
    .map((row) => ({ row, store: db.storeById.get(row.store_id) }))
    .sort((a, b) => b.row.sales_krw - a.row.sales_krw);
}

function getScenario() {
  return db.scenarios.find((scenario) => scenario.scenario_id === state.scenarioId) || db.scenarios[0];
}

function project(x, y) {
  return { x: 190 + x * 6.9 - y * 2.7, y: 98 + y * 4.1 + x * 1.22 };
}

function togglePlayback() {
  state.playing = !state.playing;
  ui["timeline-play"].textContent = state.playing ? "Ⅱ" : "▶";
  ui["timeline-play"].setAttribute("aria-label", state.playing ? "시간 재생 정지" : "시간 재생");
  if (!state.playing) {
    clearInterval(state.playTimer);
    state.playTimer = null;
    return;
  }
  state.playTimer = setInterval(() => {
    if (state.hour < 23) state.hour += 1;
    else {
      state.hour = 5;
      const index = db.dates.indexOf(state.date);
      state.date = db.dates[(index + 1) % db.dates.length];
    }
    render();
  }, 850);
}

function showToast(message) {
  ui.toast.textContent = message;
  ui.toast.classList.add("is-visible");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => ui.toast.classList.remove("is-visible"), 2300);
}

function sum(rows, key) { return rows.reduce((total, row) => total + (Number(row[key]) || 0), 0); }
function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }
function capitalize(value) { return value.charAt(0).toUpperCase() + value.slice(1); }
function formatInt(value) { return new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 0 }).format(Number(value) || 0); }
function formatNumber(value, digits = 1) { return new Intl.NumberFormat("ko-KR", { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(Number(value) || 0); }
function formatPercent(value) { return `${formatNumber((Number(value) || 0) * 100, 0)}%`; }
function formatSignedPercent(value) { const points = (Number(value) || 0) * 100; return `${points >= 0 ? "+" : ""}${formatNumber(points, 1)}%`; }
function formatWon(value) {
  const amount = Number(value) || 0;
  const abs = Math.abs(amount);
  const sign = amount < 0 ? "−" : "";
  if (abs >= 100_000_000) return `${sign}${formatNumber(abs / 100_000_000, 1)}억`;
  if (abs >= 10_000) return `${sign}${formatNumber(abs / 10_000, 0)}만원`;
  return `${sign}${formatInt(abs)}원`;
}

function shortZoneName(name) { return String(name).replace("지하철 ", "").replace("일반 ", "").replace("KTX ", ""); }

function mixColor(start, end, amount) {
  const parse = (hex) => [1, 3, 5].map((index) => parseInt(hex.slice(index, index + 2), 16));
  const [sr, sg, sb] = parse(start);
  const [er, eg, eb] = parse(end);
  const t = clamp(amount, 0, 1);
  return `rgb(${Math.round(sr + (er - sr) * t)},${Math.round(sg + (eg - sg) * t)},${Math.round(sb + (eb - sb) * t)})`;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
}
