import { chromium } from "playwright";

const baseUrl = process.env.STATION_ONE_BASE_URL || "http://127.0.0.1:4173/app/";
const browser = await chromium.launch({
  headless: true,
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
});

const results = [];
for (const width of [1440, 1024, 390]) {
  const page = await browser.newPage({ viewport: { width, height: width <= 420 ? 1100 : 900 }, deviceScaleFactor: 1 });
  const errors = [];
  const requestFailures = [];
  const vworldTileResponses = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  page.on("requestfailed", (request) => {
    const failure = request.failure()?.errorText || "failed";
    const cameraCancelledTile = request.url().includes("/S202103/") && failure.includes("ERR_ABORTED");
    if (!cameraCancelledTile) requestFailures.push(`${request.url()} ${failure}`);
  });
  page.on("response", (response) => {
    if (response.url().includes("/S202103/") && response.url().endsWith(".b3dm") && response.status() === 200) {
      vworldTileResponses.push(response.url());
    }
  });

  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => document.querySelector("#data-status")?.textContent?.includes("READY"));
  await page.waitForFunction(() => document.querySelector("#app")?.dataset.vworldStatus !== "loading", null, { timeout: 60000 });
  await page.locator("#loading").waitFor({ state: "hidden" });

  const initialZones = await page.locator(".zone-group").count();
  if (initialZones < 1) throw new Error(`No zones rendered at ${width}px`);

  await page.locator('[data-mode="commerce"]').click();
  await page.waitForFunction(() => document.querySelector("#app")?.dataset.mode === "commerce");
  const commerceHero = await page.locator("#hero-value").textContent();
  if (width === 1440) await page.screenshot({ path: "/private/tmp/station-one-commerce-1440.png", fullPage: true });

  await page.locator('[data-mode="simulation"]').click();
  await page.locator("#scenario-select").selectOption("SCN-EVENT-35");
  await page.locator("#demand-range").fill("150");
  const simulationHero = await page.locator("#hero-value").textContent();
  const scenarioVisible = await page.locator("#scenario-panel").isVisible();
  if (width === 1440) await page.screenshot({ path: "/private/tmp/station-one-simulation-1440.png", fullPage: true });

  await page.locator('[data-mode="story"]').click();
  await page.locator("#story-next").click();
  const storyStep = await page.locator("#story-step").textContent();
  if (width === 1440) await page.screenshot({ path: "/private/tmp/station-one-story-1440.png", fullPage: true });

  await page.locator('[data-mode="operations"]').click();
  await page.locator('[data-floor="2F"]').click();
  await page.waitForTimeout(1400);
  await page.locator("#hour-range").fill("20");
  await page.locator("#decision-button").click();
  await page.locator("#toast.is-visible").waitFor({ state: "visible", timeout: 1200 });
  const toastVisible = await page.locator("#toast").isVisible();

  const layout = await page.evaluate(() => ({
    mode: document.querySelector("#app")?.dataset.mode,
    floor: document.querySelector(".floor-button.is-active")?.dataset.floor,
    time: document.querySelector("#time-output")?.textContent,
    bodyScrollWidth: document.body.scrollWidth,
    viewportWidth: window.innerWidth,
    zoneCount: document.querySelectorAll(".zone-group").length,
    signalCount: document.querySelectorAll(".signal-item").length,
    loadingHidden: document.querySelector("#loading")?.classList.contains("is-hidden"),
    vworldStatus: document.querySelector("#app")?.dataset.vworldStatus,
    vworldSource: document.querySelector("#vworld-source-state")?.textContent,
    cesiumCanvasVisible: Boolean(document.querySelector("#cesium-container canvas")?.getBoundingClientRect().width),
  }));

  await page.screenshot({ path: `/private/tmp/station-one-${width}.png`, fullPage: true });
  const overflow = layout.bodyScrollWidth - layout.viewportWidth;
  const passed = errors.length === 0 && requestFailures.length === 0 && overflow <= 1 && scenarioVisible && toastVisible
    && Boolean(commerceHero) && Boolean(simulationHero) && storyStep?.startsWith("02")
    && layout.vworldStatus === "ready" && layout.cesiumCanvasVisible && vworldTileResponses.length > 0;
  results.push({ width, passed, overflow, commerceHero, simulationHero, storyStep, scenarioVisible, toastVisible, vworldTileCount: vworldTileResponses.length, layout, errors, requestFailures });
  await page.close();
}

await browser.close();
console.log(results.map((result) => JSON.stringify(result)).join("\n"));
if (results.some((result) => !result.passed)) process.exit(1);
