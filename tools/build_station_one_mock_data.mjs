import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const OUTPUT_DIR = "outputs/20260819_station_one_mock_data";
const CSV_DIR = path.join(OUTPUT_DIR, "csv");
const JSON_DIR = path.join(OUTPUT_DIR, "json");
const PREVIEW_DIR = path.join(OUTPUT_DIR, "previews");
const XLSX_PATH = path.join(OUTPUT_DIR, "STATION_ONE_서울역_합성목업데이터.xlsx");
const MOCK_VERSION = "MOCK-2026.08-v1";
const GENERATED_AT = "2026-08-19T14:30:00+09:00";
const SYNTHETIC = "SYNTHETIC";
const rng = mulberry32(20260819);

await fs.mkdir(CSV_DIR, { recursive: true });
await fs.mkdir(JSON_DIR, { recursive: true });
await fs.mkdir(PREVIEW_DIR, { recursive: true });

function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function rand(min, max) {
  return min + (max - min) * rng();
}

function randInt(min, max) {
  return Math.floor(rand(min, max + 1));
}

function pick(items) {
  return items[Math.floor(rng() * items.length)];
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function round(value, digits = 0) {
  const m = 10 ** digits;
  return Math.round(value * m) / m;
}

function isoDate(date) {
  return date.toISOString().slice(0, 10);
}

function excelDate(dateText) {
  return new Date(`${dateText}T12:00:00Z`);
}

function addDays(dateText, days) {
  const d = new Date(`${dateText}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return isoDate(d);
}

function monthRange(start, end) {
  const out = [];
  let [year, month] = start.split("-").map(Number);
  const [endYear, endMonth] = end.split("-").map(Number);
  while (year < endYear || (year === endYear && month <= endMonth)) {
    out.push(`${year}-${String(month).padStart(2, "0")}`);
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return out;
}

function dateRange(start, end) {
  const out = [];
  let cursor = start;
  while (cursor <= end) {
    out.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return out;
}

function addMinutes(hhmm, minutes) {
  const [h, m] = hhmm.split(":").map(Number);
  const total = h * 60 + m + minutes;
  const wrapped = ((total % 1440) + 1440) % 1440;
  return `${String(Math.floor(wrapped / 60)).padStart(2, "0")}:${String(wrapped % 60).padStart(2, "0")}`;
}

function colLetter(n) {
  let s = "";
  while (n > 0) {
    n -= 1;
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26);
  }
  return s;
}

function csvEscape(value) {
  if (value === null || value === undefined) return "";
  const text = value instanceof Date ? isoDate(value) : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function toCsv(rows, columns) {
  const header = columns.map((c) => csvEscape(c.key)).join(",");
  const body = rows.map((row) => columns.map((c) => csvEscape(row[c.key])).join(","));
  return `\uFEFF${[header, ...body].join("\n")}\n`;
}

const floors = [
  { floor_code: "B2", floor_name: "지하철 환승층", elevation_m: -12, public_level: "A" },
  { floor_code: "B1", floor_name: "환승·편의층", elevation_m: -6, public_level: "A" },
  { floor_code: "1F", floor_name: "KTX 주대합실", elevation_m: 0, public_level: "A" },
  { floor_code: "2F", floor_name: "식음·대기층", elevation_m: 6, public_level: "A" },
  { floor_code: "3F", floor_name: "라운지·테라스층", elevation_m: 12, public_level: "A" },
].map((r) => ({ synthetic_flag: SYNTHETIC, mock_version: MOCK_VERSION, station_code: "SEOUL_KTX", ...r }));

const zones = [
  ["Z-B2-01", "B2", "지하철 환승통로", "TRANSFER", 1600, 1250, 18, 25, 26],
  ["Z-B2-02", "B2", "지하철 개찰구 앞", "GATE", 1100, 920, 12, 48, 25],
  ["Z-B1-01", "B1", "환승 중앙홀", "CONCOURSE", 2400, 1650, 16, 34, 20],
  ["Z-B1-02", "B1", "물품보관·편의통로", "SERVICE", 700, 430, 11, 67, 18],
  ["Z-1F-01", "1F", "KTX 중앙대합실", "CONCOURSE", 3600, 2200, 22, 40, 15],
  ["Z-1F-02", "1F", "승차게이트 존", "GATE", 1800, 1550, 10, 58, 12],
  ["Z-1F-03", "1F", "동부 출입구", "ENTRANCE", 1200, 980, 8, 76, 18],
  ["Z-1F-04", "1F", "서부 출입구", "ENTRANCE", 1250, 1050, 8, 16, 18],
  ["Z-2F-01", "2F", "푸드코트", "RETAIL", 1400, 760, 36, 32, 34],
  ["Z-2F-02", "2F", "일반 대기라운지", "WAITING", 1500, 680, 42, 52, 34],
  ["Z-2F-03", "2F", "리테일 갤러리", "RETAIL", 1000, 620, 24, 74, 34],
  ["Z-3F-01", "3F", "프리미엄 라운지", "LOUNGE", 650, 280, 58, 48, 52],
].map(([zone_id, floor_code, zone_name, zone_type, capacity, flow_base, dwell_base_min, x, y]) => ({
  synthetic_flag: SYNTHETIC,
  mock_version: MOCK_VERSION,
  station_code: "SEOUL_KTX",
  zone_id,
  floor_code,
  zone_name,
  zone_type,
  capacity,
  flow_base_per_hour: flow_base,
  dwell_base_min,
  centroid_x: x,
  centroid_y: y,
  public_level: "A",
}));
const zoneById = new Map(zones.map((z) => [z.zone_id, z]));

const zoneAdjacency = [
  ["Z-B2-01", "Z-B2-02", 46, "CORRIDOR"], ["Z-B2-01", "Z-B1-01", 62, "ESCALATOR"],
  ["Z-B2-02", "Z-B1-01", 58, "STAIR"], ["Z-B1-01", "Z-B1-02", 35, "CORRIDOR"],
  ["Z-B1-01", "Z-1F-01", 44, "ESCALATOR"], ["Z-1F-01", "Z-1F-02", 42, "CORRIDOR"],
  ["Z-1F-01", "Z-1F-03", 61, "CORRIDOR"], ["Z-1F-01", "Z-1F-04", 59, "CORRIDOR"],
  ["Z-1F-01", "Z-2F-01", 56, "ESCALATOR"], ["Z-1F-01", "Z-2F-02", 49, "ESCALATOR"],
  ["Z-1F-02", "Z-2F-03", 63, "ESCALATOR"], ["Z-2F-01", "Z-2F-02", 33, "CORRIDOR"],
  ["Z-2F-02", "Z-2F-03", 29, "CORRIDOR"], ["Z-2F-02", "Z-3F-01", 51, "ELEVATOR"],
].map(([from_zone_id, to_zone_id, distance_m, connection_type], idx) => ({
  synthetic_flag: SYNTHETIC,
  mock_version: MOCK_VERSION,
  edge_id: `E${String(idx + 1).padStart(3, "0")}`,
  from_zone_id,
  to_zone_id,
  distance_m,
  connection_type,
  bidirectional: "Y",
  accessibility: connection_type === "STAIR" ? "N" : "Y",
}));

const storeZones = ["Z-B1-02", "Z-1F-01", "Z-1F-03", "Z-1F-04", "Z-2F-01", "Z-2F-02", "Z-2F-03", "Z-3F-01"];
const categoryConfig = {
  "식음-카페": { base: 118000000, margin: 0.63, ticket: 8700, area: [38, 110] },
  "식음-한식": { base: 168000000, margin: 0.55, ticket: 14500, area: [65, 165] },
  "식음-베이커리": { base: 128000000, margin: 0.61, ticket: 9200, area: [42, 105] },
  "소매-편의": { base: 142000000, margin: 0.34, ticket: 6800, area: [25, 80] },
  "소매-기념품": { base: 76000000, margin: 0.48, ticket: 23800, area: [28, 90] },
  "서비스-여행": { base: 68000000, margin: 0.57, ticket: 31500, area: [22, 65] },
};
const categories = Object.keys(categoryConfig);
const storeNameRoots = ["모닝레일", "플랫폼", "서울마루", "트래블픽", "스테이션", "브릿지", "마일제로", "한강뷰", "기차숲", "모빌리티"];
const storeNameSuffix = ["키친", "카페", "마켓", "베이커리", "라운지", "스토어"];
const stores = Array.from({ length: 30 }, (_, idx) => {
  const store_id = `S${String(idx + 1).padStart(3, "0")}`;
  const zone_id = storeZones[idx % storeZones.length];
  const category = categories[idx % categories.length];
  const config = categoryConfig[category];
  const [category_l1, category_l2] = category.split("-");
  const openedYear = 2019 + (idx % 6);
  const openedMonth = 1 + ((idx * 5) % 12);
  const status = idx === 26 ? "RENOVATION" : "ACTIVE";
  return {
    synthetic_flag: SYNTHETIC,
    mock_version: MOCK_VERSION,
    station_code: "SEOUL_KTX",
    store_id,
    store_name: `${storeNameRoots[idx % storeNameRoots.length]} ${storeNameSuffix[(idx * 3) % storeNameSuffix.length]} ${String(idx + 1).padStart(2, "0")}`,
    floor_code: zoneById.get(zone_id).floor_code,
    zone_id,
    category_l1,
    category_l2,
    area_sqm: round(rand(config.area[0], config.area[1]), 1),
    open_date: `${openedYear}-${String(openedMonth).padStart(2, "0")}-01`,
    business_status: status,
    x: round(zoneById.get(zone_id).centroid_x + rand(-6, 6), 1),
    y: round(zoneById.get(zone_id).centroid_y + rand(-5, 5), 1),
    public_level: "B",
  };
});

const leases = stores.map((store, idx) => {
  const start = store.open_date;
  const end = `${Number(start.slice(0, 4)) + 5}${start.slice(4, 7)}-${String(27 + (idx % 2)).padStart(2, "0")}`;
  const contract_type = idx % 5 === 0 ? "REVENUE_SHARE" : idx % 3 === 0 ? "FIXED" : "FIXED_PLUS_SHARE";
  const fixed = contract_type === "REVENUE_SHARE" ? 0 : Math.round(store.area_sqm * rand(115000, 235000) / 10000) * 10000;
  const share = contract_type === "FIXED" ? 0 : round(rand(0.035, 0.095), 3);
  return {
    synthetic_flag: SYNTHETIC,
    mock_version: MOCK_VERSION,
    contract_id: `LC${String(idx + 1).padStart(3, "0")}`,
    store_id: store.store_id,
    contract_type,
    start_date: start,
    end_date: end,
    fixed_rent_krw: fixed,
    revenue_share_rate: share,
    deposit_krw: Math.round(store.area_sqm * rand(420000, 850000) / 1000000) * 1000000,
    common_fee_krw: Math.round(store.area_sqm * rand(16000, 32000) / 10000) * 10000,
    renewal_option: idx % 4 === 0 ? "REVIEW" : "Y",
    public_level: "C",
  };
});

const months = monthRange("2023-01", "2026-07");
const seasonal = { 1: 0.88, 2: 0.93, 3: 0.98, 4: 1.01, 5: 1.08, 6: 1.03, 7: 1.09, 8: 1.13, 9: 1.02, 10: 1.06, 11: 1.01, 12: 1.17 };
const monthlySales = [];
for (let sIdx = 0; sIdx < stores.length; sIdx += 1) {
  const store = stores[sIdx];
  const config = categoryConfig[`${store.category_l1}-${store.category_l2}`];
  const storeFactor = 0.72 + ((sIdx * 17) % 41) / 100;
  for (let mIdx = 0; mIdx < months.length; mIdx += 1) {
    const period = months[mIdx];
    const month = Number(period.slice(5));
    const promo = rng() < 0.19;
    const promotionFactor = promo ? rand(1.05, 1.16) : 1;
    const trend = 1 + mIdx * 0.0043;
    const noise = rand(0.91, 1.10);
    const renovationFactor = store.business_status === "RENOVATION" && period >= "2026-06" ? 0.34 : 1;
    const sales_krw = Math.round((config.base * storeFactor * seasonal[month] * promotionFactor * trend * noise * renovationFactor) / 10000) * 10000;
    const avg_ticket_krw = Math.round(config.ticket * rand(0.93, 1.11) / 100) * 100;
    const transactions = Math.max(1, Math.round(sales_krw / avg_ticket_krw));
    const conversion_rate = round(rand(0.18, 0.36), 3);
    const visitors_est = Math.round(transactions / conversion_rate);
    monthlySales.push({
      synthetic_flag: SYNTHETIC,
      mock_version: MOCK_VERSION,
      period,
      company_id: "MOCK-COMPANY-001",
      store_id: store.store_id,
      zone_id: store.zone_id,
      sales_krw,
      transactions,
      avg_ticket_krw,
      visitors_est,
      conversion_rate,
      gross_margin_rate: round(clamp(config.margin + rand(-0.035, 0.035), 0.25, 0.70), 3),
      promotion_flag: promo ? "Y" : "N",
      public_level: "C",
    });
  }
}

const companyYears = [2023, 2024, 2025].map((year, idx) => {
  const rows = monthlySales.filter((r) => r.period.startsWith(String(year)));
  const revenue = rows.reduce((sum, r) => sum + r.sales_krw, 0);
  const grossProfit = rows.reduce((sum, r) => sum + r.sales_krw * r.gross_margin_rate, 0);
  const operatingMargin = 0.076 + idx * 0.008;
  return {
    synthetic_flag: SYNTHETIC,
    mock_version: MOCK_VERSION,
    company_id: "MOCK-COMPANY-001",
    company_name: "STATION ONE Retail Lab (가상회사)",
    fiscal_year: year,
    revenue_krw: Math.round(revenue),
    gross_profit_krw: Math.round(grossProfit),
    operating_profit_krw: Math.round(revenue * operatingMargin),
    employees: 145 + idx * 11,
    managed_stores: stores.length,
    capex_krw: Math.round(revenue * (0.028 + idx * 0.003)),
    audit_status: "SYNTHETIC_MODEL",
    public_level: "B",
  };
});

const hourProfile = { 5: 0.24, 6: 0.48, 7: 0.92, 8: 1.34, 9: 1.08, 10: 0.88, 11: 0.94, 12: 1.14, 13: 1.08, 14: 0.98, 15: 1.02, 16: 1.12, 17: 1.28, 18: 1.49, 19: 1.32, 20: 1.08, 21: 0.84, 22: 0.55, 23: 0.25 };
const julyDates = dateRange("2026-07-01", "2026-07-31");
const footfall = [];
for (const date of julyDates) {
  const day = new Date(`${date}T12:00:00Z`).getUTCDay();
  const dayFactor = day === 6 ? 1.22 : day === 0 ? 1.15 : day === 5 ? 1.08 : 1;
  for (const hour of Object.keys(hourProfile).map(Number)) {
    for (const zone of zones) {
      const specialEvent = date === "2026-07-18" && hour >= 17 && hour <= 20 && ["Z-1F-01", "Z-1F-02", "Z-B1-01"].includes(zone.zone_id);
      const eventFactor = specialEvent ? 1.42 : 1;
      const inflow_count = Math.round(zone.flow_base_per_hour * hourProfile[hour] * dayFactor * eventFactor * rand(0.87, 1.13));
      const dwell_minutes = round(clamp(zone.dwell_base_min * rand(0.88, 1.16) * (specialEvent ? 1.14 : 1), 5, 75), 1);
      const occupancy_avg = Math.round(clamp(inflow_count * (dwell_minutes / 60) * 1.62, 0, zone.capacity * 0.99));
      const crowd_index = round(occupancy_avg / zone.capacity, 3);
      const predicted_15m = Math.round(clamp(occupancy_avg * rand(0.96, 1.13) * (specialEvent ? 1.08 : 1), 0, zone.capacity * 1.08));
      footfall.push({
        synthetic_flag: SYNTHETIC,
        mock_version: MOCK_VERSION,
        date,
        hour,
        timestamp_local: `${date}T${String(hour).padStart(2, "0")}:00:00+09:00`,
        zone_id: zone.zone_id,
        inflow_count,
        outflow_count: Math.round(inflow_count * rand(0.91, 1.06)),
        occupancy_avg,
        dwell_minutes,
        capacity: zone.capacity,
        crowd_index,
        predicted_15m,
        anomaly_flag: crowd_index >= 0.82 || predicted_15m / zone.capacity >= 0.9 ? "Y" : "N",
        public_level: "B",
      });
    }
  }
}

const destinations = ["부산", "대전", "동대구", "목포", "여수엑스포", "포항", "진주", "강릉"];
const trainEvents = [];
for (const date of julyDates) {
  const dayNo = Number(date.slice(-2));
  for (let seq = 0; seq < 22; seq += 1) {
    const scheduled_time = addMinutes("05:30", seq * 46);
    const direction = seq % 2 === 0 ? "DEPARTURE" : "ARRIVAL";
    let delay_min = rng() < 0.7 ? 0 : rng() < 0.78 ? randInt(3, 12) : randInt(13, 32);
    if (date === "2026-07-18" && Number(scheduled_time.slice(0, 2)) >= 17 && Number(scheduled_time.slice(0, 2)) <= 20) delay_min += 18;
    trainEvents.push({
      synthetic_flag: SYNTHETIC,
      mock_version: MOCK_VERSION,
      service_date: date,
      train_id: `KTX-M-${String(dayNo).padStart(2, "0")}${String(seq + 1).padStart(2, "0")}`,
      train_type: seq % 5 === 0 ? "KTX-SANCHEON" : "KTX",
      direction,
      origin: direction === "DEPARTURE" ? "서울" : pick(destinations),
      destination: direction === "DEPARTURE" ? pick(destinations) : "서울",
      scheduled_time,
      actual_time: addMinutes(scheduled_time, delay_min),
      delay_min,
      platform: 3 + (seq % 10),
      passengers_est: randInt(310, 690),
      linked_zone_id: "Z-1F-02",
      scenario_tag: delay_min >= 20 ? "DELAY_RISK" : "NORMAL",
      public_level: "B",
    });
  }
}

const facilityTypes = [
  ["ESCALATOR", "에스컬레이터"], ["ELEVATOR", "엘리베이터"], ["HVAC", "공조기"],
  ["PEOPLE_COUNTER", "비식별 인원계수 센서"], ["DISPLAY", "안내 디스플레이"], ["GATE_SENSOR", "게이트 센서"],
];
const facilities = [];
for (const zone of zones) {
  facilityTypes.forEach(([category, label], idx) => {
    const assetIdx = facilities.length + 1;
    const health = round(rand(72, 99), 1);
    const status = health < 78 ? "ATTENTION" : health < 84 ? "MONITOR" : "NORMAL";
    const installYear = 2017 + ((assetIdx * 3) % 8);
    const lastMaint = addDays("2026-07-31", -randInt(4, 120));
    facilities.push({
      synthetic_flag: SYNTHETIC,
      mock_version: MOCK_VERSION,
      asset_id: `A${String(assetIdx).padStart(4, "0")}`,
      category,
      asset_name: `${zone.zone_name} ${label} ${idx + 1}`,
      zone_id: zone.zone_id,
      floor_code: zone.floor_code,
      criticality: ["ESCALATOR", "ELEVATOR", "HVAC"].includes(category) ? "HIGH" : "MEDIUM",
      install_date: `${installYear}-${String(1 + (assetIdx % 12)).padStart(2, "0")}-15`,
      last_maintenance_date: lastMaint,
      health_score: health,
      status,
      next_maintenance_due: addDays(lastMaint, category === "HVAC" ? 90 : 180),
      sensor_status: rng() < 0.96 ? "ONLINE" : "DEGRADED",
      public_level: category === "PEOPLE_COUNTER" ? "B" : "C",
    });
  });
}

const eventTypeMap = {
  ESCALATOR: ["STOP", "VIBRATION", "SAFETY_SENSOR"], ELEVATOR: ["DOOR", "STOP", "CALL_ERROR"],
  HVAC: ["TEMPERATURE", "FILTER", "POWER"], PEOPLE_COUNTER: ["SIGNAL_LOSS", "CALIBRATION"],
  DISPLAY: ["SCREEN_OFF", "CONTENT_DELAY"], GATE_SENSOR: ["READ_ERROR", "SIGNAL_LOSS"],
};
const facilityEvents = Array.from({ length: 180 }, (_, idx) => {
  const asset = facilities[(idx * 11 + randInt(0, 8)) % facilities.length];
  const date = julyDates[(idx * 7 + randInt(0, 6)) % julyDates.length];
  const hour = 6 + ((idx * 5) % 17);
  const severity = idx % 23 === 0 ? "CRITICAL" : idx % 7 === 0 ? "HIGH" : idx % 3 === 0 ? "MEDIUM" : "LOW";
  const response = severity === "CRITICAL" ? randInt(2, 5) : severity === "HIGH" ? randInt(4, 10) : randInt(7, 22);
  const resolution = response + (severity === "CRITICAL" ? randInt(25, 90) : severity === "HIGH" ? randInt(18, 70) : randInt(10, 55));
  const status = idx >= 173 ? "OPEN" : "RESOLVED";
  return {
    synthetic_flag: SYNTHETIC,
    mock_version: MOCK_VERSION,
    event_id: `FE${String(idx + 1).padStart(4, "0")}`,
    opened_at: `${date}T${String(hour).padStart(2, "0")}:${String((idx * 7) % 60).padStart(2, "0")}:00+09:00`,
    asset_id: asset.asset_id,
    zone_id: asset.zone_id,
    event_type: pick(eventTypeMap[asset.category]),
    severity,
    response_min: response,
    resolution_min: status === "OPEN" ? null : resolution,
    status,
    probable_cause: pick(["부품 열화", "피크부하", "통신 지연", "센서 편차", "예방점검 감지"]),
    recommended_action: status === "OPEN" ? "현장 확인 및 우회 안내" : "조치 완료·재발 모니터링",
    public_level: "C",
  };
});

const operationMonths = monthRange("2025-01", "2026-07");
const operationsKpi = [];
for (const period of operationMonths) {
  for (const zone of zones) {
    const trendIndex = operationMonths.indexOf(period);
    operationsKpi.push({
      synthetic_flag: SYNTHETIC,
      mock_version: MOCK_VERSION,
      period,
      zone_id: zone.zone_id,
      crowd_incidents: Math.max(0, Math.round(rand(0, 5) - trendIndex * 0.035)),
      avg_response_min: round(clamp(rand(7.2, 12.8) - trendIndex * 0.08, 4.5, 14), 1),
      facility_downtime_min: Math.round(clamp(rand(38, 170) - trendIndex * 1.8, 15, 190)),
      preventive_maintenance_rate: round(clamp(rand(0.86, 0.97) + trendIndex * 0.0015, 0.82, 0.995), 3),
      complaints_count: Math.round(clamp(rand(4, 24) - trendIndex * 0.12, 1, 28)),
      cleaning_sla_rate: round(clamp(rand(0.88, 0.98) + trendIndex * 0.001, 0.84, 0.995), 3),
      energy_kwh: Math.round(zone.capacity * rand(62, 91)),
      data_completeness_rate: round(rand(0.965, 0.998), 3),
      public_level: "C",
    });
  }
}

const scenarioTemplates = [
  ["SCN-BASE", "평시 운영", "NORMAL", 1.0, 0, "", 0.61, 0.61, 8.4, 0, "현행 운영 유지"],
  ["SCN-KTX-25", "KTX 25분 지연", "TRAIN_DELAY", 1.28, 25, "", 0.91, 0.64, 5.8, -18000000, "1F 안내인력 4명 증원·2F 대기 분산"],
  ["SCN-EAST-CLOSE", "동부 출입구 폐쇄", "ZONE_CLOSURE", 1.18, 0, "Z-1F-03", 0.88, 0.62, 6.3, -9200000, "서부 출입구 유도·환승 중앙홀 단방향 동선"],
  ["SCN-EVENT-35", "도심행사 수요 +35%", "DEMAND_SURGE", 1.35, 0, "", 0.94, 0.65, 5.1, 42000000, "피크 30분 전 게이트 분산·푸드코트 사전주문"],
  ["SCN-RAIN", "집중호우", "WEATHER", 1.16, 0, "", 0.82, 0.59, 6.9, 12500000, "출입구 체류관리·우산포장/청소 인력 선배치"],
  ["SCN-PROMO", "2F 공동 프로모션", "COMMERCE", 1.08, 0, "", 0.71, 0.61, 8.0, 67000000, "저혼잡 시간대 쿠폰·리테일 갤러리 연계"],
];
const scenarios = scenarioTemplates.map(([scenario_id, scenario_name, trigger_type, demand_multiplier, train_delay_min, closed_zone_id, predicted_peak_crowd, baseline_peak_crowd, recommended_response_min, sales_opportunity_krw, recommended_action]) => ({
  synthetic_flag: SYNTHETIC,
  mock_version: MOCK_VERSION,
  scenario_id,
  scenario_name,
  trigger_type,
  demand_multiplier,
  train_delay_min,
  closed_zone_id,
  predicted_peak_crowd,
  baseline_peak_crowd,
  recommended_response_min,
  sales_opportunity_krw,
  recommended_action,
  result_label: "SIMULATION_ONLY",
  public_level: "B",
}));

const alerts = [
  ["ALT-001", "CROWD", "HIGH", "Z-1F-01", 0.87, 0.80, "OPEN", 0.91, "2F 대기라운지로 분산 안내", "SCN-KTX-25"],
  ["ALT-002", "TRAIN_DELAY", "HIGH", "Z-1F-02", 25, 15, "OPEN", 0.95, "게이트 안내인력 4명 증원", "SCN-KTX-25"],
  ["ALT-003", "FACILITY", "MEDIUM", "Z-B1-01", 76, 80, "OPEN", 0.83, "에스컬레이터 진동 현장 점검", "SCN-BASE"],
  ["ALT-004", "DWELL", "MEDIUM", "Z-2F-01", 41, 35, "OPEN", 0.86, "좌석 회전·픽업 동선 분리", "SCN-EVENT-35"],
  ["ALT-005", "COMMERCE", "LOW", "Z-2F-03", 0.19, 0.24, "OPEN", 0.79, "18~20시 교차쿠폰 노출", "SCN-PROMO"],
  ["ALT-006", "SENSOR", "LOW", "Z-B2-02", 0.91, 0.95, "OPEN", 0.88, "계수 센서 보정 작업 예약", "SCN-BASE"],
  ["ALT-007", "CROWD", "HIGH", "Z-B1-01", 0.84, 0.80, "ACKNOWLEDGED", 0.89, "환승통로 단방향 안내", "SCN-EVENT-35"],
  ["ALT-008", "ENERGY", "LOW", "Z-3F-01", 118, 105, "RESOLVED", 0.74, "공조 설정 1.5도 완화", "SCN-BASE"],
  ["ALT-009", "FACILITY", "HIGH", "Z-1F-04", 71, 80, "RESOLVED", 0.92, "게이트 센서 교체", "SCN-EAST-CLOSE"],
  ["ALT-010", "WEATHER", "MEDIUM", "Z-1F-03", 32, 25, "RESOLVED", 0.87, "출입구 미끄럼 방지매트 배치", "SCN-RAIN"],
  ["ALT-011", "CROWD", "MEDIUM", "Z-2F-02", 0.77, 0.72, "RESOLVED", 0.82, "라운지 좌석 재배치", "SCN-KTX-25"],
  ["ALT-012", "COMMERCE", "LOW", "Z-B1-02", 0.16, 0.21, "RESOLVED", 0.77, "아침시간 편의상품 노출", "SCN-PROMO"],
].map(([alert_id, alert_type, severity, zone_id, current_value, threshold_value, status, confidence, recommendation, scenario_id], idx) => ({
  synthetic_flag: SYNTHETIC,
  mock_version: MOCK_VERSION,
  alert_id,
  generated_at: `2026-08-19T${String(13 + Math.floor(idx / 4)).padStart(2, "0")}:${String((idx * 7) % 60).padStart(2, "0")}:00+09:00`,
  alert_type,
  severity,
  zone_id,
  current_value,
  threshold_value,
  status,
  confidence,
  recommendation,
  scenario_id,
  public_level: "B",
}));

const datasetDefinitions = [
  ["company_summary", "02_Company", "연도별 가상 회사 재무·인원 요약", "YEAR", "C", "ANNUAL"],
  ["floors", "03_Floors_Zones", "역사 층 마스터", "FLOOR", "A", "ON_CHANGE"],
  ["zones", "03_Floors_Zones", "층별 구역·수용량·좌표", "ZONE", "A", "ON_CHANGE"],
  ["zone_adjacency", "03_Floors_Zones", "구역 연결 그래프", "EDGE", "A", "ON_CHANGE"],
  ["stores", "04_Stores", "점포·업종·공간키", "STORE", "B", "MONTHLY"],
  ["lease_contracts", "05_Lease_Contracts", "임대·수수료 계약 요약", "CONTRACT", "C", "MONTHLY"],
  ["monthly_sales", "06_Monthly_Sales", "점포별 월매출·거래·전환", "STORE_MONTH", "C", "MONTHLY"],
  ["hourly_footfall", "07_Hourly_Footfall", "구역별 시간대 유입·점유·혼잡", "ZONE_HOUR", "B", "HOURLY"],
  ["train_events", "08_Train_Events", "가상 KTX 도착·출발·지연", "TRAIN_EVENT", "B", "EVENT"],
  ["facilities", "09_Facilities", "시설 자산·상태·건강도", "ASSET", "C", "DAILY"],
  ["facility_events", "10_Facility_Events", "장애·점검 이벤트", "ASSET_EVENT", "C", "EVENT"],
  ["operations_kpi", "11_Operations_KPI", "구역별 월간 운영 KPI", "ZONE_MONTH", "C", "MONTHLY"],
  ["alerts", "12_Alerts", "대시보드용 현재 경보", "ALERT", "B", "EVENT"],
  ["scenarios", "13_Scenarios", "What-if 입력과 가상 결과", "SCENARIO", "B", "ON_CHANGE"],
];

const datasetMap = {
  company_summary: companyYears,
  floors,
  zones,
  zone_adjacency: zoneAdjacency,
  stores,
  lease_contracts: leases,
  monthly_sales: monthlySales,
  hourly_footfall: footfall,
  train_events: trainEvents,
  facilities,
  facility_events: facilityEvents,
  operations_kpi: operationsKpi,
  alerts,
  scenarios,
};

const dataCatalog = datasetDefinitions.map(([dataset_id, workbook_sheet, description, record_grain, public_level, refresh_cycle]) => ({
  synthetic_flag: SYNTHETIC,
  mock_version: MOCK_VERSION,
  dataset_id,
  workbook_sheet,
  description,
  record_grain,
  record_count: datasetMap[dataset_id].length,
  time_range: dataset_id === "monthly_sales" ? "2023-01~2026-07" : dataset_id === "hourly_footfall" || dataset_id === "train_events" || dataset_id === "facility_events" ? "2026-07-01~2026-07-31" : dataset_id === "operations_kpi" ? "2025-01~2026-07" : "2026-08-19 snapshot",
  refresh_cycle,
  public_level,
  source_type: "SYNTHETIC_GENERATOR",
  source_reference: "tools/build_station_one_mock_data.mjs",
  privacy_note: dataset_id === "hourly_footfall" ? "구역 집계만 포함, 개인·영상 없음" : "개인식별정보 없음",
}));
datasetMap.data_catalog = dataCatalog;

const columns = {
  company_summary: [
    ["synthetic_flag", "text"], ["mock_version", "text"], ["company_id", "text"], ["company_name", "text"], ["fiscal_year", "year"], ["revenue_krw", "money"], ["gross_profit_krw", "money"], ["operating_profit_krw", "money"], ["employees", "int"], ["managed_stores", "int"], ["capex_krw", "money"], ["audit_status", "text"], ["public_level", "text"],
  ],
  floors: [["synthetic_flag", "text"], ["mock_version", "text"], ["station_code", "text"], ["floor_code", "text"], ["floor_name", "text"], ["elevation_m", "decimal"], ["public_level", "text"]],
  zones: [["synthetic_flag", "text"], ["mock_version", "text"], ["station_code", "text"], ["zone_id", "text"], ["floor_code", "text"], ["zone_name", "text"], ["zone_type", "text"], ["capacity", "int"], ["flow_base_per_hour", "int"], ["dwell_base_min", "decimal"], ["centroid_x", "decimal"], ["centroid_y", "decimal"], ["public_level", "text"]],
  zone_adjacency: [["synthetic_flag", "text"], ["mock_version", "text"], ["edge_id", "text"], ["from_zone_id", "text"], ["to_zone_id", "text"], ["distance_m", "decimal"], ["connection_type", "text"], ["bidirectional", "text"], ["accessibility", "text"]],
  stores: [["synthetic_flag", "text"], ["mock_version", "text"], ["station_code", "text"], ["store_id", "text"], ["store_name", "text"], ["floor_code", "text"], ["zone_id", "text"], ["category_l1", "text"], ["category_l2", "text"], ["area_sqm", "decimal"], ["open_date", "date"], ["business_status", "text"], ["x", "decimal"], ["y", "decimal"], ["public_level", "text"]],
  lease_contracts: [["synthetic_flag", "text"], ["mock_version", "text"], ["contract_id", "text"], ["store_id", "text"], ["contract_type", "text"], ["start_date", "date"], ["end_date", "date"], ["fixed_rent_krw", "money"], ["revenue_share_rate", "percent"], ["deposit_krw", "money"], ["common_fee_krw", "money"], ["renewal_option", "text"], ["public_level", "text"]],
  monthly_sales: [["synthetic_flag", "text"], ["mock_version", "text"], ["period", "text"], ["company_id", "text"], ["store_id", "text"], ["zone_id", "text"], ["sales_krw", "money"], ["transactions", "int"], ["avg_ticket_krw", "money"], ["visitors_est", "int"], ["conversion_rate", "percent"], ["gross_margin_rate", "percent"], ["promotion_flag", "text"], ["public_level", "text"]],
  hourly_footfall: [["synthetic_flag", "text"], ["mock_version", "text"], ["date", "date"], ["hour", "int"], ["timestamp_local", "text"], ["zone_id", "text"], ["inflow_count", "int"], ["outflow_count", "int"], ["occupancy_avg", "int"], ["dwell_minutes", "decimal"], ["capacity", "int"], ["crowd_index", "percent"], ["predicted_15m", "int"], ["anomaly_flag", "text"], ["public_level", "text"]],
  train_events: [["synthetic_flag", "text"], ["mock_version", "text"], ["service_date", "date"], ["train_id", "text"], ["train_type", "text"], ["direction", "text"], ["origin", "text"], ["destination", "text"], ["scheduled_time", "text"], ["actual_time", "text"], ["delay_min", "int"], ["platform", "int"], ["passengers_est", "int"], ["linked_zone_id", "text"], ["scenario_tag", "text"], ["public_level", "text"]],
  facilities: [["synthetic_flag", "text"], ["mock_version", "text"], ["asset_id", "text"], ["category", "text"], ["asset_name", "text"], ["zone_id", "text"], ["floor_code", "text"], ["criticality", "text"], ["install_date", "date"], ["last_maintenance_date", "date"], ["health_score", "decimal"], ["status", "text"], ["next_maintenance_due", "date"], ["sensor_status", "text"], ["public_level", "text"]],
  facility_events: [["synthetic_flag", "text"], ["mock_version", "text"], ["event_id", "text"], ["opened_at", "text"], ["asset_id", "text"], ["zone_id", "text"], ["event_type", "text"], ["severity", "text"], ["response_min", "int"], ["resolution_min", "int"], ["status", "text"], ["probable_cause", "text"], ["recommended_action", "text"], ["public_level", "text"]],
  operations_kpi: [["synthetic_flag", "text"], ["mock_version", "text"], ["period", "text"], ["zone_id", "text"], ["crowd_incidents", "int"], ["avg_response_min", "decimal"], ["facility_downtime_min", "int"], ["preventive_maintenance_rate", "percent"], ["complaints_count", "int"], ["cleaning_sla_rate", "percent"], ["energy_kwh", "int"], ["data_completeness_rate", "percent"], ["public_level", "text"]],
  alerts: [["synthetic_flag", "text"], ["mock_version", "text"], ["alert_id", "text"], ["generated_at", "text"], ["alert_type", "text"], ["severity", "text"], ["zone_id", "text"], ["current_value", "decimal"], ["threshold_value", "decimal"], ["status", "text"], ["confidence", "percent"], ["recommendation", "text"], ["scenario_id", "text"], ["public_level", "text"]],
  scenarios: [["synthetic_flag", "text"], ["mock_version", "text"], ["scenario_id", "text"], ["scenario_name", "text"], ["trigger_type", "text"], ["demand_multiplier", "decimal"], ["train_delay_min", "int"], ["closed_zone_id", "text"], ["predicted_peak_crowd", "percent"], ["baseline_peak_crowd", "percent"], ["recommended_response_min", "decimal"], ["sales_opportunity_krw", "money"], ["recommended_action", "text"], ["result_label", "text"], ["public_level", "text"]],
  data_catalog: [["synthetic_flag", "text"], ["mock_version", "text"], ["dataset_id", "text"], ["workbook_sheet", "text"], ["description", "text"], ["record_grain", "text"], ["record_count", "int"], ["time_range", "text"], ["refresh_cycle", "text"], ["public_level", "text"], ["source_type", "text"], ["source_reference", "text"], ["privacy_note", "text"]],
};

for (const [datasetId, rows] of Object.entries(datasetMap)) {
  const defs = columns[datasetId].map(([key, type]) => ({ key, type }));
  await fs.writeFile(path.join(CSV_DIR, `${datasetId}.csv`), toCsv(rows, defs), "utf8");
}

const latestFootfall = footfall.filter((r) => r.date === "2026-07-18" && r.hour === 18);
const realtimeSnapshot = {
  meta: {
    synthetic_flag: SYNTHETIC,
    mock_version: MOCK_VERSION,
    generated_at: GENERATED_AT,
    station_code: "SEOUL_KTX",
    disclaimer: "모든 수치·상호·열차·사건은 시연용 합성 데이터이며 실제 서울역 운영값이 아닙니다.",
  },
  kpis: {
    active_alerts: alerts.filter((a) => a.status === "OPEN").length,
    peak_crowd_index: Math.max(...latestFootfall.map((r) => r.crowd_index)),
    current_occupancy: latestFootfall.reduce((s, r) => s + r.occupancy_avg, 0),
    predicted_15m_occupancy: latestFootfall.reduce((s, r) => s + r.predicted_15m, 0),
    normal_facility_rate: round(facilities.filter((a) => a.status === "NORMAL").length / facilities.length, 3),
  },
  zones: latestFootfall.map((r) => ({
    zone_id: r.zone_id,
    zone_name: zoneById.get(r.zone_id).zone_name,
    floor_code: zoneById.get(r.zone_id).floor_code,
    occupancy: r.occupancy_avg,
    capacity: r.capacity,
    crowd_index: r.crowd_index,
    predicted_15m: r.predicted_15m,
  })),
  alerts: alerts.filter((a) => a.status !== "RESOLVED"),
  scenarios,
};
await fs.writeFile(path.join(JSON_DIR, "realtime_snapshot.json"), `${JSON.stringify(realtimeSnapshot, null, 2)}\n`, "utf8");

const palette = {
  navy: "#071B33", blue: "#0B63F6", cyan: "#00B8D9", orange: "#FF9F1C", red: "#E5484D",
  green: "#16A085", paleBlue: "#EAF2FF", paleCyan: "#E8FBFF", paleOrange: "#FFF3E0",
  paleRed: "#FDEBEC", paleGreen: "#E8F7F1", gray: "#667085", line: "#D0D5DD", white: "#FFFFFF",
};

const wb = Workbook.create();
const sheetNames = [
  "00_README", "01_Dashboard", "02_Company", "03_Floors_Zones", "04_Stores", "05_Lease_Contracts",
  "06_Monthly_Sales", "07_Hourly_Footfall", "08_Train_Events", "09_Facilities", "10_Facility_Events",
  "11_Operations_KPI", "12_Alerts", "13_Scenarios", "14_Data_Catalog", "15_Checks",
];
for (const name of sheetNames) wb.worksheets.add(name);

function titleBand(sheet, title, subtitle, endCol) {
  sheet.showGridLines = false;
  sheet.mergeCells(`A1:${endCol}1`);
  sheet.getRange("A1").values = [[title]];
  sheet.getRange(`A1:${endCol}1`).format = {
    fill: palette.navy,
    font: { bold: true, color: palette.white, size: 17 },
    rowHeight: 34,
    verticalAlignment: "center",
  };
  sheet.mergeCells(`A2:${endCol}2`);
  sheet.getRange("A2").values = [[subtitle]];
  sheet.getRange(`A2:${endCol}2`).format = {
    fill: "#102A43",
    font: { color: "#D7E8F7", size: 10 },
    rowHeight: 27,
    verticalAlignment: "center",
    wrapText: true,
  };
}

function styleHeader(range) {
  range.format = {
    fill: palette.blue,
    font: { bold: true, color: palette.white },
    horizontalAlignment: "center",
    verticalAlignment: "center",
    wrapText: true,
    rowHeight: 30,
    borders: { preset: "all", style: "thin", color: palette.line },
  };
}

function typeFormat(type) {
  if (type === "money") return "#,##0;[Red](#,##0);-";
  if (type === "int") return "#,##0";
  if (type === "decimal") return "#,##0.0";
  if (type === "percent") return "0.0%";
  if (type === "year") return "0";
  if (type === "date") return "yyyy-mm-dd";
  return "@";
}

function xlsxValue(value, type) {
  if (value === null || value === undefined) return null;
  if (type === "date") return excelDate(value);
  if (type === "text" && typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
    return `${value.slice(0, 16).replace("T", " ")} KST`;
  }
  return value;
}

function widthFor(key, type) {
  if (["recommendation", "recommended_action", "description", "privacy_note", "source_reference", "probable_cause", "asset_name"].includes(key)) return 34;
  if (["timestamp_local", "opened_at", "generated_at", "company_name"].includes(key)) return 24;
  if (key.includes("date") || key.includes("period") || key.includes("time")) return 15;
  if (type === "money") return 17;
  if (type === "percent" || type === "decimal" || type === "int") return 13;
  return Math.min(22, Math.max(13, key.length + 3));
}

function addDataSheet(sheetName, title, datasetId, extraBlocks = []) {
  const sheet = wb.worksheets.getItem(sheetName);
  const defs = columns[datasetId].map(([key, type]) => ({ key, type }));
  const rows = datasetMap[datasetId];
  const endCol = colLetter(defs.length);
  titleBand(sheet, title, `${SYNTHETIC} · ${MOCK_VERSION} · 실제 서울역/회사 데이터가 아닌 시제품·경진대회용 합성값 · ${rows.length.toLocaleString()} records`, endCol);
  const headerRow = 4;
  const dataStart = 5;
  const dataEnd = dataStart + rows.length - 1;
  sheet.getRange(`A${headerRow}:${endCol}${headerRow}`).values = [defs.map((d) => d.key)];
  styleHeader(sheet.getRange(`A${headerRow}:${endCol}${headerRow}`));
  const matrix = rows.map((row) => defs.map((d) => xlsxValue(row[d.key], d.type)));
  if (matrix.length) sheet.getRangeByIndexes(dataStart - 1, 0, matrix.length, defs.length).values = matrix;
  const body = sheet.getRange(`A${dataStart}:${endCol}${dataEnd}`);
  body.format = { verticalAlignment: "center", borders: { preset: "inside", style: "thin", color: "#E4E7EC" } };
  defs.forEach((d, idx) => {
    const col = colLetter(idx + 1);
    sheet.getRange(`${col}${dataStart}:${col}${dataEnd}`).format.numberFormat = typeFormat(d.type);
    sheet.getRange(`${col}:${col}`).format.columnWidth = widthFor(d.key, d.type);
  });
  const table = sheet.tables.add(`A${headerRow}:${endCol}${dataEnd}`, true, `T_${datasetId.replaceAll("_", "").slice(0, 22)}`);
  table.style = "TableStyleMedium2";
  sheet.freezePanes.freezeRows(headerRow);
  for (const block of extraBlocks) block(sheet, { dataStart, dataEnd, defs });
  return { sheet, dataStart, dataEnd, endCol };
}

const readme = wb.worksheets.getItem("00_README");
titleBand(readme, "STATION ONE · 서울역 합성 목업데이터 팩", "실제 서울역·브이월드·당사 수치가 아닙니다. 프로토타입, 내부설득, 경진대회 화면 제작에만 사용하세요.", "L");
readme.getRange("A4:L4").merge();
readme.getRange("A4").values = [["사용 원칙"]];
readme.getRange("A4:L4").format = { fill: palette.orange, font: { bold: true, color: palette.navy }, rowHeight: 26 };
readme.getRange("A5:L9").values = [
  ["1", "모든 레코드는 synthetic_flag=SYNTHETIC, mock_version=MOCK-2026.08-v1로 표시됩니다.", null, null, null, null, null, null, null, null, null, null],
  ["2", "화면·출품서에는 ‘시연용 합성 데이터’ 문구를 유지하고 실제 성과처럼 표현하지 않습니다.", null, null, null, null, null, null, null, null, null, null],
  ["3", "구역·층·점포·설비·경보는 zone_id를 공통 키로 연결합니다.", null, null, null, null, null, null, null, null, null, null],
  ["4", "CCTV 원본·개인 이동궤적은 포함하지 않았고 구역별 집계 인원만 사용합니다.", null, null, null, null, null, null, null, null, null, null],
  ["5", "실데이터 확보 후 동일 컬럼을 유지한 채 값을 교체하면 UI와 분석 로직을 재사용할 수 있습니다.", null, null, null, null, null, null, null, null, null, null],
];
for (let r = 5; r <= 9; r += 1) readme.mergeCells(`B${r}:L${r}`);
readme.getRange("A5:L9").format = { fill: palette.paleOrange, wrapText: true, verticalAlignment: "center", rowHeight: 26, borders: { preset: "inside", style: "thin", color: palette.line } };
readme.getRange("A11:F11").values = [["구분", "기간/기준", "레코드", "주요 키", "외부공개", "파일"]];
styleHeader(readme.getRange("A11:F11"));
const readmeRows = dataCatalog.map((d) => [d.dataset_id, d.time_range, d.record_count, d.record_grain, d.public_level, `${d.dataset_id}.csv`]);
readme.getRangeByIndexes(11, 0, readmeRows.length, 6).values = readmeRows;
readme.getRange(`A12:F${11 + readmeRows.length}`).format = { borders: { preset: "inside", style: "thin", color: palette.line }, verticalAlignment: "center" };
readme.getRange(`C12:C${11 + readmeRows.length}`).format.numberFormat = "#,##0";
readme.getRange("A:A").format.columnWidth = 22;
readme.getRange("B:B").format.columnWidth = 24;
readme.getRange("C:E").format.columnWidth = 15;
readme.getRange("F:F").format.columnWidth = 27;
readme.getRange("H11:L11").merge();
readme.getRange("H11").values = [["권장 시연 시나리오"]];
readme.getRange("H11:L11").format = { fill: palette.cyan, font: { bold: true, color: palette.navy }, rowHeight: 30 };
readme.getRange("H12:L17").values = scenarios.map((s) => [s.scenario_id, s.scenario_name, s.trigger_type, s.predicted_peak_crowd, s.result_label]);
readme.getRange("H12:L17").format = { borders: { preset: "inside", style: "thin", color: palette.line }, verticalAlignment: "center" };
readme.getRange("K12:K17").format.numberFormat = "0%";
readme.getRange("H:H").format.columnWidth = 18;
readme.getRange("I:I").format.columnWidth = 24;
readme.getRange("J:L").format.columnWidth = 18;
readme.freezePanes.freezeRows(4);

const dashboard = wb.worksheets.getItem("01_Dashboard");
titleBand(dashboard, "STATION ONE · Executive Twin Mock Dashboard", "2026-07 기준 · 모든 값은 합성 목업 · 실제/통계/모의값 배지를 운영 UI에서 반드시 구분", "L");
dashboard.getRange("A3:L3").values = [["기준월", "2026-07", "버전", MOCK_VERSION, "생성시각", "2026-08-19 14:30 KST", "MODEL STATUS", null, null, null, null, null]];
dashboard.mergeCells("H3:L3");
dashboard.getRange("H3").formulas = [["=IF(COUNTIF('15_Checks'!$E$5:$E$12,\"FAIL\")=0,\"PASS\",\"FAIL\")"]];
dashboard.getRange("A3:L3").format = { fill: palette.paleBlue, font: { bold: true, color: palette.navy }, verticalAlignment: "center", rowHeight: 25 };

const salesEnd = monthlySales.length + 4;
const footfallEnd = footfall.length + 4;
const alertsEnd = alerts.length + 4;
const facilityEnd = facilities.length + 4;
const cardRanges = [["A4:C4", "A5:C7"], ["D4:F4", "D5:F7"], ["G4:I4", "G5:I7"], ["J4:L4", "J5:L7"]];
const cardLabels = ["2026-07 점포매출 (KRW)", "7월 구역 유입 합계 (명)", "최대 혼잡지수", "현재 OPEN 경보"];
const cardFormulas = [
  `=SUMIF('06_Monthly_Sales'!$C$5:$C$${salesEnd},$B$3,'06_Monthly_Sales'!$G$5:$G$${salesEnd})`,
  `=SUM('07_Hourly_Footfall'!$G$5:$G$${footfallEnd})`,
  `=MAX('07_Hourly_Footfall'!$L$5:$L$${footfallEnd})`,
  `=COUNTIF('12_Alerts'!$J$5:$J$${alertsEnd},\"OPEN\")`,
];
cardRanges.forEach(([labelRange, valueRange], idx) => {
  dashboard.mergeCells(labelRange);
  dashboard.mergeCells(valueRange);
  dashboard.getRange(labelRange.split(":")[0]).values = [[cardLabels[idx]]];
  dashboard.getRange(valueRange.split(":")[0]).formulas = [[cardFormulas[idx]]];
  dashboard.getRange(labelRange).format = { fill: idx === 3 ? palette.paleOrange : palette.paleCyan, font: { bold: true, color: palette.gray }, horizontalAlignment: "center", verticalAlignment: "center" };
  dashboard.getRange(valueRange).format = { fill: palette.white, font: { bold: true, color: idx === 3 ? palette.orange : palette.navy, size: 21 }, horizontalAlignment: "center", verticalAlignment: "center", borders: { preset: "outside", style: "thin", color: palette.line } };
});
dashboard.getRange("A5").format.numberFormat = "#,##0,,\"M\"";
dashboard.getRange("D5").format.numberFormat = "#,##0";
dashboard.getRange("G5").format.numberFormat = "0%";
dashboard.getRange("J5").format.numberFormat = "0";

const last12 = months.slice(-12);
dashboard.getRange("A28:B28").values = [["월", "매출액(KRW)"]];
styleHeader(dashboard.getRange("A28:B28"));
dashboard.getRange("A29:A40").values = last12.map((m) => [m]);
dashboard.getRange("B29").formulas = [[`=SUMIF('06_Monthly_Sales'!$C$5:$C$${salesEnd},A29,'06_Monthly_Sales'!$G$5:$G$${salesEnd})`]];
dashboard.getRange("B29:B40").fillDown();
dashboard.getRange("B29:B40").format.numberFormat = "#,##0";

dashboard.getRange("E28:F28").values = [["구역", "평균 혼잡지수"]];
styleHeader(dashboard.getRange("E28:F28"));
dashboard.getRange("E29:E40").values = zones.map((z) => [z.zone_id]);
dashboard.getRange("F29").formulas = [[`=AVERAGEIF('07_Hourly_Footfall'!$F$5:$F$${footfallEnd},E29,'07_Hourly_Footfall'!$L$5:$L$${footfallEnd})`]];
dashboard.getRange("F29:F40").fillDown();
dashboard.getRange("F29:F40").format.numberFormat = "0.0%";

const salesChart = dashboard.charts.add("line", dashboard.getRange("A28:B40"));
salesChart.title = "최근 12개월 목업 매출 추이 (KRW)";
salesChart.hasLegend = false;
salesChart.xAxis = { axisType: "textAxis", textStyle: { fontSize: 9 } };
salesChart.yAxis = { numberFormatCode: "#,##0,,\"M\"" };
salesChart.setPosition("A9", "F25");
const crowdChart = dashboard.charts.add("bar", dashboard.getRange("E28:F40"));
crowdChart.title = "구역별 평균 혼잡지수";
crowdChart.hasLegend = false;
crowdChart.xAxis = { axisType: "textAxis", textStyle: { fontSize: 8 } };
crowdChart.yAxis = { numberFormatCode: "0%", min: 0, max: 1 };
crowdChart.setPosition("G9", "L25");
dashboard.getRange("A26:L26").merge();
dashboard.getRange("A26").values = [["DEMO NARRATIVE · KTX 지연 → 1F 혼잡 예측 → 2F 대기 분산 → 운영인력 배치 → 상권 영향 비교"]];
dashboard.getRange("A26:L26").format = { fill: palette.navy, font: { bold: true, color: palette.white }, horizontalAlignment: "center", verticalAlignment: "center", rowHeight: 28 };
dashboard.getRange("H28:L28").merge();
dashboard.getRange("H28").values = [["데모 핵심 가정"]];
dashboard.getRange("H28:L28").format = { fill: palette.orange, font: { bold: true, color: palette.navy }, horizontalAlignment: "center" };
dashboard.getRange("H29:L34").values = [
  ["열차 지연", 25, "분", "SCN-KTX-25", null],
  ["수요 증가", 1.28, "배", "SCN-KTX-25", null],
  ["예측 최대 혼잡", 0.91, "index", "SIMULATION_ONLY", null],
  ["권장 대응시간", 5.8, "분", "SIMULATION_ONLY", null],
  ["정상 시설률", null, "%", "합성 자산 상태", null],
  ["CCTV 원본", 0, "건", "비식별 집계만 사용", null],
];
dashboard.getRange("I33").formulas = [[`=COUNTIF('09_Facilities'!$L$5:$L$${facilityEnd},\"NORMAL\")/COUNTA('09_Facilities'!$C$5:$C$${facilityEnd})`]];
dashboard.getRange("H29:L34").format = { fill: palette.paleOrange, borders: { preset: "inside", style: "thin", color: palette.line }, verticalAlignment: "center" };
dashboard.getRange("I31").format.numberFormat = "0.0%";
dashboard.getRange("I33").format.numberFormat = "0.0%";
dashboard.getRange("A:L").format.columnWidth = 14;
dashboard.getRange("F:F").format.columnWidth = 22;
dashboard.getRange("G:G").format.columnWidth = 16;
dashboard.freezePanes.freezeRows(3);

const companySheetResult = addDataSheet("02_Company", "02 · 가상 회사 요약", "company_summary");
companySheetResult.sheet.getRange("C:C").format.columnWidth = 23;
companySheetResult.sheet.getRange("D:D").format.columnWidth = 32;
companySheetResult.sheet.getRange("L:L").format.columnWidth = 20;

const spatial = wb.worksheets.getItem("03_Floors_Zones");
titleBand(spatial, "03 · 층·구역·연결 그래프", `${SYNTHETIC} · VWorld 층 표현을 참고한 독립 목업 공간키 · 실제 경계/좌표가 아님`, "M");
spatial.getRange("A4:G4").values = [columns.floors.map(([key]) => key)];
styleHeader(spatial.getRange("A4:G4"));
spatial.getRangeByIndexes(4, 0, floors.length, columns.floors.length).values = floors.map((r) => columns.floors.map(([key, type]) => xlsxValue(r[key], type)));
spatial.getRange("A12:M12").values = [columns.zones.map(([key]) => key)];
styleHeader(spatial.getRange("A12:M12"));
spatial.getRangeByIndexes(12, 0, zones.length, columns.zones.length).values = zones.map((r) => columns.zones.map(([key, type]) => xlsxValue(r[key], type)));
spatial.getRange("A27:I27").values = [columns.zone_adjacency.map(([key]) => key)];
styleHeader(spatial.getRange("A27:I27"));
spatial.getRangeByIndexes(27, 0, zoneAdjacency.length, columns.zone_adjacency.length).values = zoneAdjacency.map((r) => columns.zone_adjacency.map(([key, type]) => xlsxValue(r[key], type)));
spatial.getRange("A:M").format.columnWidth = 15;
spatial.getRange("F:F").format.columnWidth = 24;
spatial.freezePanes.freezeRows(4);

addDataSheet("04_Stores", "04 · 점포 마스터", "stores");
addDataSheet("05_Lease_Contracts", "05 · 임대계약 목업", "lease_contracts");
addDataSheet("06_Monthly_Sales", "06 · 점포별 월매출 목업", "monthly_sales");
addDataSheet("07_Hourly_Footfall", "07 · 구역별 시간대 유동·혼잡 목업", "hourly_footfall", [
  (sheet, { dataStart, dataEnd }) => {
    sheet.getRange(`L${dataStart}:L${dataEnd}`).conditionalFormats.add("colorScale", { colors: ["#D9F7F4", "#FFD166", "#E5484D"], thresholds: ["min", "50%", "max"] });
    sheet.getRange(`N${dataStart}:N${dataEnd}`).conditionalFormats.add("containsText", { text: "Y", format: { fill: palette.paleRed, font: { color: palette.red, bold: true } } });
  },
]);
addDataSheet("08_Train_Events", "08 · 가상 열차 도착·출발 이벤트", "train_events");
addDataSheet("09_Facilities", "09 · 시설 자산·건강도 목업", "facilities", [
  (sheet, { dataStart, dataEnd }) => sheet.getRange(`K${dataStart}:K${dataEnd}`).conditionalFormats.add("colorScale", { colors: ["#E5484D", "#FFD166", "#16A085"], thresholds: ["min", "50%", "max"] }),
]);
const facilityEventSheetResult = addDataSheet("10_Facility_Events", "10 · 시설 장애·점검 이벤트 목업", "facility_events");
facilityEventSheetResult.sheet.getRange("G:G").format.columnWidth = 20;
facilityEventSheetResult.sheet.getRange("H:H").format.columnWidth = 13;
facilityEventSheetResult.sheet.getRange("K:K").format.columnWidth = 15;
addDataSheet("11_Operations_KPI", "11 · 구역별 운영 KPI 목업", "operations_kpi");
const alertsSheetResult = addDataSheet("12_Alerts", "12 · 운영·혼잡·상권 경보 목업", "alerts", [
  (sheet, { dataStart, dataEnd }) => {
    sheet.getRange(`F${dataStart}:F${dataEnd}`).conditionalFormats.add("containsText", { text: "HIGH", format: { fill: palette.paleRed, font: { color: palette.red, bold: true } } });
    sheet.getRange(`J${dataStart}:J${dataEnd}`).conditionalFormats.add("containsText", { text: "OPEN", format: { fill: palette.paleOrange, font: { color: palette.orange, bold: true } } });
  },
]);
alertsSheetResult.sheet.getRange("J:J").format.columnWidth = 18;
alertsSheetResult.sheet.getRange("L:L").format.columnWidth = 38;
addDataSheet("13_Scenarios", "13 · What-if 시나리오와 가상 결과", "scenarios");
addDataSheet("14_Data_Catalog", "14 · 데이터 카탈로그", "data_catalog");

const checks = wb.worksheets.getItem("15_Checks");
titleBand(checks, "15 · 데이터 품질·모델 점검", "PASS는 파일 구조와 합성 라벨의 기계적 일관성만 뜻하며 실제 정확성·효과를 보증하지 않습니다.", "F");
checks.getRange("A3:B3").values = [["MODEL STATUS", null]];
checks.mergeCells("B3:F3");
checks.getRange("B3").formulas = [["=IF(COUNTIF(E5:E12,\"FAIL\")=0,\"PASS\",\"FAIL\")"]];
checks.getRange("A3:F3").format = { fill: palette.paleBlue, font: { bold: true, color: palette.navy }, rowHeight: 28 };
checks.getRange("A4:F4").values = [["check_id", "description", "expected", "actual", "status", "where_to_fix"]];
styleHeader(checks.getRange("A4:F4"));
checks.getRange("A5:C12").values = [
  ["CHK-001", "점포 레코드 수", stores.length],
  ["CHK-002", "월매출 레코드 수", monthlySales.length],
  ["CHK-003", "시간대 유동 레코드 수", footfall.length],
  ["CHK-004", "열차 이벤트 레코드 수", trainEvents.length],
  ["CHK-005", "시설 자산 레코드 수", facilities.length],
  ["CHK-006", "시나리오 레코드 수", scenarios.length],
  ["CHK-007", "월매출 양수 여부", 1],
  ["CHK-008", "월매출 SYNTHETIC 라벨 수", monthlySales.length],
];
checks.getRange("D5:D12").formulas = [
  [`=COUNTA('04_Stores'!$D$5:$D$${stores.length + 4})`],
  [`=COUNTA('06_Monthly_Sales'!$C$5:$C$${salesEnd})`],
  [`=COUNTA('07_Hourly_Footfall'!$C$5:$C$${footfallEnd})`],
  [`=COUNTA('08_Train_Events'!$D$5:$D$${trainEvents.length + 4})`],
  [`=COUNTA('09_Facilities'!$C$5:$C$${facilityEnd})`],
  [`=COUNTA('13_Scenarios'!$C$5:$C$${scenarios.length + 4})`],
  [`=IF(SUM('06_Monthly_Sales'!$G$5:$G$${salesEnd})>0,1,0)`],
  [`=COUNTIF('06_Monthly_Sales'!$A$5:$A$${salesEnd},\"SYNTHETIC\")`],
];
checks.getRange("E5").formulas = [["=IF(C5=D5,\"PASS\",\"FAIL\")"]];
checks.getRange("E5:E12").fillDown();
checks.getRange("F5:F12").values = [
  ["04_Stores"], ["06_Monthly_Sales"], ["07_Hourly_Footfall"], ["08_Train_Events"],
  ["09_Facilities"], ["13_Scenarios"], ["06_Monthly_Sales"], ["06_Monthly_Sales"],
];
checks.getRange("A5:F12").format = { borders: { preset: "inside", style: "thin", color: palette.line }, verticalAlignment: "center" };
checks.getRange("E5:E12").conditionalFormats.add("containsText", { text: "PASS", format: { fill: palette.paleGreen, font: { color: palette.green, bold: true } } });
checks.getRange("E5:E12").conditionalFormats.add("containsText", { text: "FAIL", format: { fill: palette.paleRed, font: { color: palette.red, bold: true } } });
checks.getRange("A:A").format.columnWidth = 15;
checks.getRange("B:B").format.columnWidth = 30;
checks.getRange("C:E").format.columnWidth = 15;
checks.getRange("F:F").format.columnWidth = 24;
checks.freezePanes.freezeRows(4);

const inspectDashboard = await wb.inspect({ kind: "table,formula,drawing", sheetId: "01_Dashboard", range: "A1:L40", maxChars: 12000, tableMaxRows: 45, tableMaxCols: 14, options: { maxResults: 120 } });
await fs.writeFile(path.join(OUTPUT_DIR, "inspection_dashboard.ndjson"), inspectDashboard.ndjson || String(inspectDashboard), "utf8");
const inspectChecks = await wb.inspect({ kind: "table,formula", sheetId: "15_Checks", range: "A1:F15", maxChars: 8000, tableMaxRows: 20, tableMaxCols: 8, options: { maxResults: 100 } });
await fs.writeFile(path.join(OUTPUT_DIR, "inspection_checks.ndjson"), inspectChecks.ndjson || String(inspectChecks), "utf8");
const formulaErrors = await wb.inspect({ kind: "match", searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A", options: { useRegex: true, maxResults: 300 }, summary: "final formula error scan" });
await fs.writeFile(path.join(OUTPUT_DIR, "inspection_formula_errors.ndjson"), formulaErrors.ndjson || String(formulaErrors), "utf8");

const renderRanges = {
  "00_README": "A1:L25", "01_Dashboard": "A1:L40", "02_Company": "A1:M10", "03_Floors_Zones": "A1:M40",
  "04_Stores": "A1:O22", "05_Lease_Contracts": "A1:M22", "06_Monthly_Sales": "A1:N22",
  "07_Hourly_Footfall": "A1:O22", "08_Train_Events": "A1:P22", "09_Facilities": "A1:O22",
  "10_Facility_Events": "A1:N22", "11_Operations_KPI": "A1:M22", "12_Alerts": "A1:N18",
  "13_Scenarios": "A1:O12", "14_Data_Catalog": "A1:M20", "15_Checks": "A1:F14",
};
for (const [sheetName, range] of Object.entries(renderRanges)) {
  const png = await wb.render({ sheetName, range, scale: sheetName === "01_Dashboard" ? 1 : 0.78, format: "png" });
  await fs.writeFile(path.join(PREVIEW_DIR, `${sheetName}.png`), new Uint8Array(await png.arrayBuffer()));
}

const xlsx = await SpreadsheetFile.exportXlsx(wb);
await xlsx.save(XLSX_PATH);

const allOutputFiles = [];
for (const dir of [CSV_DIR, JSON_DIR]) {
  for (const file of await fs.readdir(dir)) allOutputFiles.push(path.join(dir, file));
}
allOutputFiles.push(XLSX_PATH);
const fileManifest = [];
for (const file of allOutputFiles) {
  const bytes = await fs.readFile(file);
  fileManifest.push({
    path: file,
    bytes: bytes.length,
    sha256: crypto.createHash("sha256").update(bytes).digest("hex"),
  });
}
const manifest = {
  synthetic_flag: SYNTHETIC,
  mock_version: MOCK_VERSION,
  generated_at: GENERATED_AT,
  seed: 20260819,
  record_counts: Object.fromEntries(Object.entries(datasetMap).map(([key, rows]) => [key, rows.length])),
  files: fileManifest,
};
await fs.writeFile(path.join(JSON_DIR, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

const readmeMd = `# STATION ONE 서울역 합성 목업데이터 팩\n\n` +
  `- 버전: \`${MOCK_VERSION}\`\n- 생성시각: \`${GENERATED_AT}\`\n- 결정론적 시드: \`20260819\`\n\n` +
  `> 모든 수치, 점포명, 열차, 시설, 경보, 시나리오는 시연용으로 생성한 합성 데이터입니다. 실제 서울역·브이월드·회사 실적을 뜻하지 않습니다.\n\n` +
  `## 구성\n\n- \`STATION_ONE_서울역_합성목업데이터.xlsx\`: 검토·발표용 통합 워크북\n- \`csv/\`: 개발·분석 연동용 개별 데이터셋\n- \`json/realtime_snapshot.json\`: UI 데모용 현재 상태\n- \`json/manifest.json\`: 레코드 수와 SHA-256\n\n` +
  `## 공통 연결키\n\n- 공간: \`station_code → floor_code → zone_id\`\n- 상권: \`zone_id → store_id → period\`\n- 운영: \`zone_id → asset_id → event_id\`\n- 시나리오: \`scenario_id → alert/scenario result\`\n\n` +
  `## UI 권장 진입점\n\n1. \`json/realtime_snapshot.json\`으로 운영관제 첫 화면을 구성합니다.\n2. \`hourly_footfall.csv\`를 시간 슬라이더와 혼잡 히트맵에 연결합니다.\n3. \`monthly_sales.csv\`와 \`stores.csv\`를 상권 인사이트에 연결합니다.\n4. \`scenarios.csv\`를 What-if 모드에 연결합니다.\n5. 실제 데이터 도입 시 동일 컬럼을 유지하고 \`synthetic_flag\`를 실제 출처·기준시점 필드로 교체합니다.\n\n` +
  `## 공개 주의\n\n- 경진대회·대외 화면에 \`SYNTHETIC / 시연용 합성 데이터\` 배지를 유지하세요.\n- 숫자를 실제 성과나 예측 정확도로 주장하지 마세요.\n- CCTV 원본은 없으며 구역 집계값만 포함합니다.\n`;
await fs.writeFile(path.join(OUTPUT_DIR, "README.md"), readmeMd, "utf8");

console.log(JSON.stringify({
  xlsx: XLSX_PATH,
  csvDir: CSV_DIR,
  jsonDir: JSON_DIR,
  previewDir: PREVIEW_DIR,
  recordCounts: manifest.record_counts,
}, null, 2));
