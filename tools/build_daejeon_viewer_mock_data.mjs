import fs from "node:fs/promises";
import path from "node:path";

const OUTPUT_DIR = path.resolve("public/data/station-one-daejeon");
const CSV_DIR = path.join(OUTPUT_DIR, "csv");
const JSON_DIR = path.join(OUTPUT_DIR, "json");
const MOCK_VERSION = "DJ-MOCK-2026.09-v1";
const STATION_CODE = "DAEJEON_KTX";
const SYNTHETIC = "SYNTHETIC";
const BASE_DATE = "2026-09-02";

await fs.mkdir(CSV_DIR, { recursive: true });
await fs.mkdir(JSON_DIR, { recursive: true });

let seed = 2018010902;
function random() {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let value = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
  return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
}
function between(min, max) { return min + (max - min) * random(); }
function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }
function round(value, digits = 0) {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}
function csvEscape(value) {
  if (value === null || value === undefined) return "";
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}
function toCsv(rows, columns) {
  return `\uFEFF${[columns.join(","), ...rows.map((row) => columns.map((column) => csvEscape(row[column])).join(","))].join("\n")}\n`;
}
function addDays(dateText, amount) {
  const date = new Date(`${dateText}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}
function addMinutes(time, amount) {
  const [hour, minute] = time.split(":").map(Number);
  const total = hour * 60 + minute + amount;
  return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

const floors = [
  ["1F", "동·서광장 연결층", 55.69],
  ["2F", "맞이방·상업층", 60.34],
  ["3F", "KTX 승차·환승층", 63.48],
  ["4F", "고객라운지층", 68.37],
  ["5F", "운영지원층", 71.66],
  ["RF", "옥상 설비층", 74.33],
].map(([floor_code, floor_name, elevation_m]) => ({
  synthetic_flag: SYNTHETIC, mock_version: MOCK_VERSION, station_code: STATION_CODE,
  floor_code, floor_name, elevation_m, public_level: "A",
}));

const zones = [
  ["DJ-Z-1F-01", "1F", "서광장 환승 연결부", "TRANSFER", 1050, 760, 11, 24, 31],
  ["DJ-Z-1F-02", "1F", "동광장 출입홀", "ENTRANCE", 1250, 890, 9, 72, 31],
  ["DJ-Z-2F-01", "2F", "중앙 맞이방", "CONCOURSE", 2500, 1680, 24, 49, 44],
  ["DJ-Z-2F-02", "2F", "상업가로", "RETAIL", 1350, 820, 32, 28, 52],
  ["DJ-Z-2F-03", "2F", "도시철도 환승부", "TRANSFER", 1600, 1160, 14, 72, 55],
  ["DJ-Z-3F-01", "3F", "KTX 대합실", "WAITING", 2200, 1320, 28, 48, 48],
  ["DJ-Z-3F-02", "3F", "승차게이트", "GATE", 1500, 1420, 10, 26, 58],
  ["DJ-Z-3F-03", "3F", "승강장 연결통로", "PLATFORM_LINK", 1700, 1510, 8, 74, 58],
  ["DJ-Z-4F-01", "4F", "고객 라운지", "LOUNGE", 620, 260, 46, 37, 45],
  ["DJ-Z-4F-02", "4F", "지역관광 서비스존", "SERVICE", 480, 210, 19, 63, 45],
  ["DJ-Z-5F-01", "5F", "운영지원 구역", "OPERATIONS", 320, 120, 36, 50, 49],
  ["DJ-Z-RF-01", "RF", "옥상 설비 구역", "FACILITY", 120, 35, 12, 50, 50],
].map(([zone_id, floor_code, zone_name, zone_type, capacity, flow_base_per_hour, dwell_base_min, centroid_x, centroid_y]) => ({
  synthetic_flag: SYNTHETIC, mock_version: MOCK_VERSION, station_code: STATION_CODE,
  zone_id, floor_code, zone_name, zone_type, capacity, flow_base_per_hour, dwell_base_min,
  centroid_x, centroid_y, public_level: "A",
}));
const zoneById = new Map(zones.map((zone) => [zone.zone_id, zone]));

const adjacencyPairs = [
  ["DJ-Z-1F-01", "DJ-Z-1F-02", 118, "CONCOURSE"],
  ["DJ-Z-1F-01", "DJ-Z-2F-01", 48, "ESCALATOR"],
  ["DJ-Z-1F-02", "DJ-Z-2F-01", 52, "ELEVATOR"],
  ["DJ-Z-2F-01", "DJ-Z-2F-02", 41, "CORRIDOR"],
  ["DJ-Z-2F-01", "DJ-Z-2F-03", 44, "CORRIDOR"],
  ["DJ-Z-2F-01", "DJ-Z-3F-01", 36, "ESCALATOR"],
  ["DJ-Z-2F-02", "DJ-Z-3F-02", 47, "ESCALATOR"],
  ["DJ-Z-2F-03", "DJ-Z-3F-03", 43, "ESCALATOR"],
  ["DJ-Z-3F-01", "DJ-Z-3F-02", 35, "CORRIDOR"],
  ["DJ-Z-3F-01", "DJ-Z-3F-03", 39, "CORRIDOR"],
  ["DJ-Z-3F-01", "DJ-Z-4F-01", 31, "ELEVATOR"],
  ["DJ-Z-4F-01", "DJ-Z-4F-02", 30, "CORRIDOR"],
  ["DJ-Z-4F-02", "DJ-Z-5F-01", 24, "STAIR"],
  ["DJ-Z-5F-01", "DJ-Z-RF-01", 18, "STAIR"],
];
const adjacency = adjacencyPairs.map(([from_zone_id, to_zone_id, distance_m, connection_type], index) => ({
  synthetic_flag: SYNTHETIC, mock_version: MOCK_VERSION,
  edge_id: `DJ-E${String(index + 1).padStart(3, "0")}`, from_zone_id, to_zone_id, distance_m,
  connection_type, bidirectional: "Y", accessibility: connection_type === "STAIR" ? "N" : "Y",
}));

const storeSeed = [
  ["DJ-S001", "철도도시 베이커리", "DJ-Z-2F-02", "식음", "베이커리", 33, 55, 96],
  ["DJ-S002", "제로마일 커피", "DJ-Z-2F-02", "식음", "카페", 23, 49, 72],
  ["DJ-S003", "대전 로컬마켓", "DJ-Z-2F-02", "소매", "기념품", 31, 47, 68],
  ["DJ-S004", "트래블 편의점", "DJ-Z-2F-01", "소매", "편의", 43, 41, 78],
  ["DJ-S005", "플랫폼 키친", "DJ-Z-2F-01", "식음", "한식", 53, 43, 128],
  ["DJ-S006", "브릿지 델리", "DJ-Z-2F-03", "식음", "델리", 67, 53, 84],
  ["DJ-S007", "시티 트래블숍", "DJ-Z-2F-03", "서비스", "여행", 76, 57, 46],
  ["DJ-S008", "게이트 스낵", "DJ-Z-3F-02", "식음", "간식", 28, 61, 41],
  ["DJ-S009", "레일 카페", "DJ-Z-3F-01", "식음", "카페", 45, 45, 88],
  ["DJ-S010", "로컬 셀렉트", "DJ-Z-3F-01", "소매", "지역상품", 57, 48, 65],
  ["DJ-S011", "퀵 바이트", "DJ-Z-3F-03", "식음", "간편식", 73, 60, 53],
  ["DJ-S012", "라운지 티룸", "DJ-Z-4F-01", "식음", "카페", 40, 46, 58],
  ["DJ-S013", "여행 컨시어지", "DJ-Z-4F-02", "서비스", "관광", 64, 43, 39],
  ["DJ-S014", "광장 모빌리티", "DJ-Z-1F-01", "서비스", "이동", 27, 29, 44],
  ["DJ-S015", "동광장 픽업숍", "DJ-Z-1F-02", "소매", "편의", 69, 33, 51],
];
const stores = storeSeed.map(([store_id, store_name, zone_id, category_l1, category_l2, x, y, area_sqm], index) => ({
  synthetic_flag: SYNTHETIC, mock_version: MOCK_VERSION, station_code: STATION_CODE,
  store_id, store_name, floor_code: zoneById.get(zone_id).floor_code, zone_id, category_l1, category_l2,
  area_sqm, open_date: `202${index % 5}-0${(index % 8) + 1}-01`, business_status: "ACTIVE", x, y, public_level: "B",
}));

const periods = ["2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09"];
const monthlySales = [];
for (const [storeIndex, store] of stores.entries()) {
  for (const [periodIndex, period] of periods.entries()) {
    const base = (58_000_000 + storeIndex * 4_300_000) * (1 + periodIndex * 0.022);
    const season = [0.96, 1.03, 0.99, 1.08, 1.12, 1.05][periodIndex];
    const sales_krw = Math.round(base * season * between(0.94, 1.08) / 10000) * 10000;
    const avg_ticket_krw = Math.round(between(8_200, store.category_l1 === "서비스" ? 31_000 : 17_500) / 100) * 100;
    const transactions = Math.round(sales_krw / avg_ticket_krw);
    const conversion_rate = round(between(0.19, 0.37), 3);
    monthlySales.push({
      synthetic_flag: SYNTHETIC, mock_version: MOCK_VERSION, period, company_id: "DJ-MOCK-COMPANY",
      store_id: store.store_id, zone_id: store.zone_id, sales_krw, transactions, avg_ticket_krw,
      visitors_est: Math.round(transactions / conversion_rate), conversion_rate,
      gross_margin_rate: round(between(0.36, 0.64), 3), promotion_flag: random() > 0.78 ? "Y" : "N", public_level: "C",
    });
  }
}

const dates = Array.from({ length: 7 }, (_, index) => addDays("2026-08-27", index));
const hourProfile = { 5: .24, 6: .45, 7: .83, 8: 1.18, 9: 1.04, 10: .88, 11: .91, 12: 1.08, 13: 1.02, 14: .94, 15: .98, 16: 1.07, 17: 1.25, 18: 1.43, 19: 1.28, 20: 1.04, 21: .79, 22: .51, 23: .26 };
const footfall = [];
for (const date of dates) {
  const day = new Date(`${date}T12:00:00Z`).getUTCDay();
  const dayFactor = day === 6 ? 1.16 : day === 0 ? 1.09 : 1;
  for (const hour of Object.keys(hourProfile).map(Number)) {
    for (const zone of zones) {
      const eveningPressure = date === BASE_DATE && hour >= 17 && hour <= 19 && ["DJ-Z-2F-01", "DJ-Z-3F-01", "DJ-Z-3F-02"].includes(zone.zone_id);
      const eventFactor = eveningPressure ? 1.34 : 1;
      const inflow_count = Math.round(zone.flow_base_per_hour * hourProfile[hour] * dayFactor * eventFactor * between(.88, 1.12));
      const dwell_minutes = round(clamp(zone.dwell_base_min * between(.9, 1.14) * (eveningPressure ? 1.12 : 1), 5, 62), 1);
      const occupancy_avg = Math.round(clamp(inflow_count * dwell_minutes / 60 * 1.46, 0, zone.capacity * .98));
      const crowd_index = round(occupancy_avg / zone.capacity, 3);
      const predicted_15m = Math.round(clamp(occupancy_avg * between(.97, 1.14) * (eveningPressure ? 1.06 : 1), 0, zone.capacity * 1.06));
      footfall.push({
        synthetic_flag: SYNTHETIC, mock_version: MOCK_VERSION, date, hour,
        timestamp_local: `${date}T${String(hour).padStart(2, "0")}:00:00+09:00`, zone_id: zone.zone_id,
        inflow_count, outflow_count: Math.round(inflow_count * between(.91, 1.07)), occupancy_avg, dwell_minutes,
        capacity: zone.capacity, crowd_index, predicted_15m,
        anomaly_flag: crowd_index >= .8 || predicted_15m / zone.capacity >= .88 ? "Y" : "N", public_level: "B",
      });
    }
  }
}

const destinations = ["서울", "부산", "동대구", "광주송정", "목포", "여수엑스포", "포항", "진주"];
const trainEvents = [];
for (const date of dates) {
  for (let index = 0; index < 24; index += 1) {
    const scheduled_time = addMinutes("05:20", index * 42);
    const direction = index % 2 === 0 ? "DEPARTURE" : "ARRIVAL";
    let delay_min = random() < .7 ? 0 : Math.round(between(3, 16));
    if (date === BASE_DATE && Number(scheduled_time.slice(0, 2)) === 18 && index % 3 !== 0) delay_min += 12;
    const counterpart = destinations[index % destinations.length];
    trainEvents.push({
      synthetic_flag: SYNTHETIC, mock_version: MOCK_VERSION, service_date: date,
      train_id: `DJ-${index % 6 === 0 ? "SRT" : "KTX"}-${date.slice(-2)}${String(index + 1).padStart(2, "0")}`,
      train_type: index % 6 === 0 ? "SRT" : index % 4 === 0 ? "KTX-산천" : "KTX", direction,
      origin: direction === "DEPARTURE" ? "대전" : counterpart,
      destination: direction === "DEPARTURE" ? counterpart : "대전",
      scheduled_time, actual_time: addMinutes(scheduled_time, delay_min), delay_min,
      platform: 1 + index % 12, passengers_est: Math.round(between(260, 640)),
      linked_zone_id: "DJ-Z-3F-02", scenario_tag: delay_min >= 15 ? "DELAY_RISK" : "NORMAL", public_level: "B",
    });
  }
}

const facilityTypes = [["ESCALATOR", "에스컬레이터"], ["ELEVATOR", "엘리베이터"], ["DISPLAY", "안내 디스플레이"], ["PEOPLE_COUNTER", "비식별 인원계수 센서"]];
const facilities = [];
for (const zone of zones) {
  for (const [index, [category, label]] of facilityTypes.entries()) {
    const health_score = round(between(73, 99), 1);
    facilities.push({
      synthetic_flag: SYNTHETIC, mock_version: MOCK_VERSION, asset_id: `DJ-A${String(facilities.length + 1).padStart(4, "0")}`,
      category, asset_name: `${zone.zone_name} ${label} ${index + 1}`, zone_id: zone.zone_id, floor_code: zone.floor_code,
      criticality: index < 2 ? "HIGH" : "MEDIUM", install_date: `202${index}-0${index + 2}-15`,
      last_maintenance_date: `2026-0${6 + index % 3}-${String(10 + index * 3).padStart(2, "0")}`,
      health_score, status: health_score < 79 ? "ATTENTION" : health_score < 85 ? "MONITOR" : "NORMAL",
      next_maintenance_due: `2026-${String(10 + index % 3).padStart(2, "0")}-15`, sensor_status: health_score < 76 ? "DEGRADED" : "ONLINE", public_level: "C",
    });
  }
}

const scenarios = [
  ["DJ-SCN-BASE", "평시 운영", "NORMAL", 1, 0, "", .62, .62, 8.2, 0, "현행 운영 유지"],
  ["DJ-SCN-KTX-20", "경부선 열차 20분 지연", "TRAIN_DELAY", 1.24, 20, "", .89, .63, 5.6, -12_000_000, "3F 게이트 안내 증원·2F 맞이방 분산"],
  ["DJ-SCN-METRO", "도시철도 환승수요 +30%", "TRANSFER_SURGE", 1.3, 0, "", .92, .64, 5.1, 21_000_000, "2F 환승부 단방향 유도·상업가로 우회 동선"],
  ["DJ-SCN-EAST", "동광장 출입부 통제", "ZONE_CLOSURE", 1.17, 0, "DJ-Z-1F-02", .84, .61, 6.4, -7_800_000, "서광장 연결부 우회 안내·엘리베이터 접근 유지"],
  ["DJ-SCN-EVENT", "지역행사 귀가수요 +35%", "DEMAND_SURGE", 1.35, 0, "", .95, .65, 4.8, 33_000_000, "피크 30분 전 대기공간 개방·간편식 사전주문"],
  ["DJ-SCN-PROMO", "2F 로컬상권 공동행사", "COMMERCE", 1.08, 0, "", .71, .61, 8, 48_000_000, "저혼잡 시간대 지역상품 쿠폰·환승 동선 연계"],
].map(([scenario_id, scenario_name, trigger_type, demand_multiplier, train_delay_min, closed_zone_id, predicted_peak_crowd, baseline_peak_crowd, recommended_response_min, sales_opportunity_krw, recommended_action]) => ({
  synthetic_flag: SYNTHETIC, mock_version: MOCK_VERSION, scenario_id, scenario_name, trigger_type,
  demand_multiplier, train_delay_min, closed_zone_id, predicted_peak_crowd, baseline_peak_crowd,
  recommended_response_min, sales_opportunity_krw, recommended_action, result_label: "SIMULATION_ONLY", public_level: "B",
}));

const alerts = [
  ["DJ-ALT-001", "CROWD", "HIGH", "DJ-Z-3F-01", .86, .8, "OPEN", .92, "2F 맞이방으로 대기 수요 분산", "DJ-SCN-KTX-20"],
  ["DJ-ALT-002", "TRAIN_DELAY", "HIGH", "DJ-Z-3F-02", 20, 15, "OPEN", .95, "게이트 안내 인력 3명 선배치", "DJ-SCN-KTX-20"],
  ["DJ-ALT-003", "TRANSFER", "MEDIUM", "DJ-Z-2F-03", .78, .72, "OPEN", .88, "도시철도 환승부 단방향 안내", "DJ-SCN-METRO"],
  ["DJ-ALT-004", "COMMERCE", "LOW", "DJ-Z-2F-02", .21, .25, "OPEN", .8, "18~20시 로컬상품 교차쿠폰 노출", "DJ-SCN-PROMO"],
  ["DJ-ALT-005", "FACILITY", "MEDIUM", "DJ-Z-1F-01", 77, 80, "ACKNOWLEDGED", .84, "서광장 에스컬레이터 예방점검", "DJ-SCN-BASE"],
  ["DJ-ALT-006", "HVAC", "LOW", "DJ-Z-4F-01", 25.8, 25, "RESOLVED", .76, "라운지 공조 설정값 조정", "DJ-SCN-BASE"],
].map(([alert_id, alert_type, severity, zone_id, current_value, threshold_value, status, confidence, recommendation, scenario_id], index) => ({
  synthetic_flag: SYNTHETIC, mock_version: MOCK_VERSION, alert_id,
  generated_at: `2026-09-02T${String(17 + Math.floor(index / 3)).padStart(2, "0")}:${String(index * 9).padStart(2, "0")}:00+09:00`,
  alert_type, severity, zone_id, current_value, threshold_value, status, confidence, recommendation, scenario_id, public_level: "B",
}));

const definitions = {
  floors: ["synthetic_flag", "mock_version", "station_code", "floor_code", "floor_name", "elevation_m", "public_level"],
  zones: ["synthetic_flag", "mock_version", "station_code", "zone_id", "floor_code", "zone_name", "zone_type", "capacity", "flow_base_per_hour", "dwell_base_min", "centroid_x", "centroid_y", "public_level"],
  zone_adjacency: ["synthetic_flag", "mock_version", "edge_id", "from_zone_id", "to_zone_id", "distance_m", "connection_type", "bidirectional", "accessibility"],
  stores: ["synthetic_flag", "mock_version", "station_code", "store_id", "store_name", "floor_code", "zone_id", "category_l1", "category_l2", "area_sqm", "open_date", "business_status", "x", "y", "public_level"],
  monthly_sales: ["synthetic_flag", "mock_version", "period", "company_id", "store_id", "zone_id", "sales_krw", "transactions", "avg_ticket_krw", "visitors_est", "conversion_rate", "gross_margin_rate", "promotion_flag", "public_level"],
  hourly_footfall: ["synthetic_flag", "mock_version", "date", "hour", "timestamp_local", "zone_id", "inflow_count", "outflow_count", "occupancy_avg", "dwell_minutes", "capacity", "crowd_index", "predicted_15m", "anomaly_flag", "public_level"],
  train_events: ["synthetic_flag", "mock_version", "service_date", "train_id", "train_type", "direction", "origin", "destination", "scheduled_time", "actual_time", "delay_min", "platform", "passengers_est", "linked_zone_id", "scenario_tag", "public_level"],
  facilities: ["synthetic_flag", "mock_version", "asset_id", "category", "asset_name", "zone_id", "floor_code", "criticality", "install_date", "last_maintenance_date", "health_score", "status", "next_maintenance_due", "sensor_status", "public_level"],
  alerts: ["synthetic_flag", "mock_version", "alert_id", "generated_at", "alert_type", "severity", "zone_id", "current_value", "threshold_value", "status", "confidence", "recommendation", "scenario_id", "public_level"],
  scenarios: ["synthetic_flag", "mock_version", "scenario_id", "scenario_name", "trigger_type", "demand_multiplier", "train_delay_min", "closed_zone_id", "predicted_peak_crowd", "baseline_peak_crowd", "recommended_response_min", "sales_opportunity_krw", "recommended_action", "result_label", "public_level"],
};
const datasets = { floors, zones, zone_adjacency: adjacency, stores, monthly_sales: monthlySales, hourly_footfall: footfall, train_events: trainEvents, facilities, alerts, scenarios };
for (const [name, rows] of Object.entries(datasets)) {
  await fs.writeFile(path.join(CSV_DIR, `${name}.csv`), toCsv(rows, definitions[name]), "utf8");
}

const currentRows = footfall.filter((row) => row.date === BASE_DATE && row.hour === 18);
const snapshot = {
  meta: {
    synthetic_flag: SYNTHETIC,
    mock_version: MOCK_VERSION,
    generated_at: "2026-09-02T18:00:00+09:00",
    station_code: STATION_CODE,
    disclaimer: "모든 운영·유동·매출·열차·시설 수치는 시연용 가상 데이터이며 실제 대전역 운영값이 아닙니다.",
  },
  kpis: {
    active_alerts: alerts.filter((alert) => alert.status !== "RESOLVED").length,
    peak_crowd_index: Math.max(...currentRows.map((row) => row.crowd_index)),
    current_occupancy: currentRows.reduce((sum, row) => sum + row.occupancy_avg, 0),
    predicted_15m_occupancy: currentRows.reduce((sum, row) => sum + row.predicted_15m, 0),
    normal_facility_rate: round(facilities.filter((asset) => asset.status !== "ATTENTION").length / facilities.length, 3),
  },
  zones: currentRows.map((row) => ({
    zone_id: row.zone_id, zone_name: zoneById.get(row.zone_id).zone_name, floor_code: zoneById.get(row.zone_id).floor_code,
    occupancy: row.occupancy_avg, capacity: row.capacity, crowd_index: row.crowd_index, predicted_15m: row.predicted_15m,
  })),
  alerts: alerts.filter((alert) => alert.status !== "RESOLVED"),
  scenarios,
};
await fs.writeFile(path.join(JSON_DIR, "realtime_snapshot.json"), `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");

console.log(JSON.stringify({
  output: OUTPUT_DIR,
  mockVersion: MOCK_VERSION,
  rows: Object.fromEntries(Object.entries(datasets).map(([name, rows]) => [name, rows.length])),
}, null, 2));
