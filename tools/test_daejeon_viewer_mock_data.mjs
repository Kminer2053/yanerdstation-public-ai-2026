import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

const root = path.resolve("public/data/station-one-daejeon");

function parseCsv(text) {
  const lines = text.replace(/^\uFEFF/, "").trim().split(/\r?\n/);
  const headers = lines.shift().split(",");
  return lines.map((line) => Object.fromEntries(line.split(",").map((value, index) => [headers[index], value])));
}

async function load(name) {
  return parseCsv(await fs.readFile(path.join(root, "csv", `${name}.csv`), "utf8"));
}

const [floors, zones, adjacency, stores, sales, footfall, trains, facilities, alerts, scenarios, snapshot, appSource] = await Promise.all([
  load("floors"), load("zones"), load("zone_adjacency"), load("stores"), load("monthly_sales"),
  load("hourly_footfall"), load("train_events"), load("facilities"), load("alerts"), load("scenarios"),
  fs.readFile(path.join(root, "json", "realtime_snapshot.json"), "utf8").then(JSON.parse),
  fs.readFile("app/app.js", "utf8"),
]);

assert.deepEqual(floors.map((row) => row.floor_code), ["1F", "2F", "3F", "4F", "5F", "RF"]);
assert.equal(zones.length, 12);
assert.equal(stores.length, 15);
assert.equal(sales.length, 90);
assert.equal(footfall.length, 1596);
assert.equal(trains.length, 168);
assert.equal(facilities.length, 48);
assert.equal(alerts.length, 6);
assert.equal(scenarios.length, 6);
assert.equal(snapshot.meta.station_code, "DAEJEON_KTX");
assert.equal(snapshot.meta.synthetic_flag, "SYNTHETIC");
assert.match(snapshot.meta.disclaimer, /실제 대전역 운영값이 아닙니다/);

const zoneIds = new Set(zones.map((row) => row.zone_id));
const storeIds = new Set(stores.map((row) => row.store_id));
for (const row of adjacency) {
  assert(zoneIds.has(row.from_zone_id));
  assert(zoneIds.has(row.to_zone_id));
}
for (const row of [...stores, ...footfall, ...facilities, ...alerts]) assert(zoneIds.has(row.zone_id));
for (const row of sales) {
  assert(zoneIds.has(row.zone_id));
  assert(storeIds.has(row.store_id));
}
for (const row of trains) assert(zoneIds.has(row.linked_zone_id));

const selectedRows = footfall.filter((row) => row.date === "2026-09-02" && row.hour === "18");
assert.equal(selectedRows.length, zones.length);
assert(selectedRows.some((row) => Number(row.crowd_index) >= .8), "대전역 피크 혼잡 가상 신호가 필요합니다");
assert(trains.some((row) => row.service_date === "2026-09-02" && Number(row.delay_min) >= 15), "지연 열차 가상 신호가 필요합니다");

assert.match(appSource, /dataDirectory: "station-one-daejeon"/);
assert.match(appSource, /vworld\.overlays\.show = !CATALOG_FOCUS/);
assert.match(appSource, /store-bar:/);
assert.match(appSource, /LIVE 3D · 가상 데이터/);

console.log("Daejeon viewer mock data test passed", {
  floors: floors.length,
  zones: zones.length,
  stores: stores.length,
  footfall: footfall.length,
  trains: trains.length,
});
