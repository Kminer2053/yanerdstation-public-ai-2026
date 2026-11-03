import { chromium } from "playwright";

const browser = await chromium.launch({
  headless: true,
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
});
for (const width of [1024, 736, 360]) {
  const page = await browser.newPage({ viewport: { width, height: 1200 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  await page.goto("file:///private/tmp/seoul-station-command-center-preview.html");
  await page.waitForTimeout(250);
  const frame = page.frameLocator("iframe");
  await frame.locator('[data-mode="commerce"]').click();
  await frame.locator('[data-mode="simulation"]').click();
  await frame.locator('#station-ax-demand').fill("150");
  await frame.locator('[data-mode="story"]').click();
  await frame.locator('#station-ax-story-next').click();
  const inner = page.frames().find((item) => item !== page.mainFrame());
  const layout = await inner.evaluate(() => {
    const root = document.getElementById("seoul-station-ax-concept-20260814");
    return {
      width: root.getBoundingClientRect().width,
      height: root.getBoundingClientRect().height,
      scrollWidth: root.scrollWidth,
      clientWidth: root.clientWidth,
      heading: document.getElementById("station-ax-heading").textContent,
      story: document.getElementById("station-ax-story-step").textContent,
    };
  });
  await frame.locator('#seoul-station-ax-concept-20260814').screenshot({ path: `/private/tmp/station-visual-${width}.png` });
  console.log(JSON.stringify({ width, layout, errors }));
  await page.close();
}
await browser.close();
