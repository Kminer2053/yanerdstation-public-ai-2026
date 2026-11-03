import { chromium } from "playwright";

const browser = await chromium.launch({
  headless: true,
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const errors = [];
const vworldResponses = [];
page.on("pageerror", (error) => errors.push(`pageerror ${error}`));
page.on("console", (message) => {
  if (message.type() === "error" || message.type() === "warning") errors.push(`${message.type()} ${message.text()}`);
});
page.on("response", (response) => {
  if (response.url().includes("S202103")) vworldResponses.push({ status: response.status(), url: response.url() });
});

await page.goto("http://127.0.0.1:4173/app/", { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => document.querySelector("#app")?.dataset.vworldStatus !== "loading", null, { timeout: 60000 });
await page.waitForTimeout(10000);
const diagnostic = await page.evaluate(() => {
  const api = window.__STATION_ONE_VWORLD__;
  const Cesium = window.Cesium;
  const cameraCartographic = api?.viewer && Cesium
    ? Cesium.Cartographic.fromCartesian(api.viewer.camera.positionWC)
    : null;
  return {
    appStatus: document.querySelector("#app")?.dataset.vworldStatus,
    sourceState: document.querySelector("#vworld-source-state")?.textContent,
    canvas: document.querySelector("#cesium-container canvas")?.getBoundingClientRect().toJSON(),
    ready: api?.ready,
    lastFloor: api?.lastFloor,
    tilesLoaded: api?.tileset?.tilesLoaded,
    memoryBytes: api?.tileset?.totalMemoryUsageInBytes,
    overlays: api?.overlays?.entities?.values?.length,
    camera: cameraCartographic && {
      longitude: Cesium.Math.toDegrees(cameraCartographic.longitude),
      latitude: Cesium.Math.toDegrees(cameraCartographic.latitude),
      height: cameraCartographic.height,
      heading: Cesium.Math.toDegrees(api.viewer.camera.heading),
      pitch: Cesium.Math.toDegrees(api.viewer.camera.pitch),
    },
    boundingRadius: api?.tileset?.boundingSphere?.radius,
    center: api?.tileset?.boundingSphere?.center,
  };
});
await page.screenshot({ path: "/private/tmp/station-one-vworld-diagnostic.png", fullPage: true });
console.log(JSON.stringify({
  diagnostic,
  responseCount: vworldResponses.length,
  statuses: vworldResponses.reduce((counts, item) => ({ ...counts, [item.status]: (counts[item.status] || 0) + 1 }), {}),
  samples: vworldResponses.slice(0, 12),
  errors,
}, null, 2));
await browser.close();
