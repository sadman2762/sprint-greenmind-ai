import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { chromium, type Browser } from "playwright";

const origin = process.env.MAP_TEST_URL ?? "http://127.0.0.1:5173";
let browser: Browser;
before(async () => { browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL ?? "chromium", headless: true }); });
after(async () => { await browser?.close(); });

const stations = [{ id: 1, name: "Synthetic test station", station_type: 0, lat: 47.53, lng: 21.62, pm25: 0 }];
const analytics = {
  cityHealth: { healthScore: 42 },
  vitalSigns: {
    urbanAcoustics: { daytimeNoiseDb: 54, nighttimeNoiseDb: 40, stationCount: 2 },
    groundwater: { temperatureC: 12, stationCount: 2 },
  },
  districtProfiles: [
    { district: "Synthetic North", pm25: 0, dayNoise: 50, nightNoise: 40 },
    { district: "Synthetic South", pm25: null, dayNoise: 60, nightNoise: null },
  ],
};

test("dashboard recovers from API failure and supports mobile charts and glossary", async () => {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce" });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  let fail = true;
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.includes("/api/")) {
      if (url.pathname.includes("official-stations") || url.pathname.includes("ai-city-analytics")) {
        await route.fulfill(fail ? { status: 503, json: { error: "Synthetic outage" } } : { json: url.pathname.includes("official-stations") ? { stations } : analytics });
      } else await route.fulfill({ json: { orders: [], available: false } });
    } else if (url.origin === origin) await route.continue();
    else await route.abort();
  });
  await page.goto(origin);
  await page.getByRole("button", { name: "Retry", exact: true }).waitFor();
  assert.equal(await page.getByText("Unavailable", { exact: true }).count(), 3);
  assert.doesNotMatch(await page.locator("main").innerText(), /7\.9|56\.6|13\.5|Healthy & Safe/);
  fail = false;
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await page.getByRole("heading", { name: "0.0 µg/m³", exact: true }).waitFor();
  await page.getByLabel("Model index 42 out of 100").waitFor();
  await page.getByText("View estimate values", { exact: true }).click();
  assert.match(await page.getByRole("table", { name: "District estimates" }).innerText(), /Unavailable/);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: "/private/tmp/greenmind-dashboard-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForFunction(() => document.documentElement.scrollWidth <= window.innerWidth);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, JSON.stringify(await page.evaluate(() => Array.from(document.querySelectorAll("body *")).filter((node) => node.getBoundingClientRect().right > innerWidth).slice(0, 12).map((node) => ({ tag: node.tagName, cls: node.className, right: node.getBoundingClientRect().right })))));
  await page.getByRole("tab", { name: "Noise levels" }).click();
  await page.getByText("Estimated day and night noise", { exact: true }).waitFor();
  await page.getByRole("tab", { name: "Coverage", exact: true }).click();
  await page.getByText("Air-network proximity preview", { exact: true }).waitFor();
  await page.getByRole("button", { name: "About air quality" }).click();
  await page.getByRole("dialog").waitFor();
  await page.keyboard.press("Escape");
  await page.getByRole("dialog").waitFor({ state: "detached" });
  await page.screenshot({ path: "/private/tmp/greenmind-dashboard-mobile.png", fullPage: true });
  assert.deepEqual(errors, []);
  await page.close();
});

test("empty stations retain zero coverage while analytics failure remains explicit", async () => {
  const page = await browser.newPage();
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.includes("/api/")) {
      if (url.pathname.includes("official-stations")) await route.fulfill({ json: { stations: [] } });
      else if (url.pathname.includes("ai-city-analytics")) await route.fulfill({ status: 503, json: {} });
      else await route.fulfill({ json: { orders: [], available: false } });
    } else if (url.origin === origin) await route.continue();
    else await route.abort();
  });
  await page.goto(origin);
  await page.getByText("The station feed returned no stations.").waitFor();
  await page.getByRole("tab", { name: "Coverage", exact: true }).click();
  await page.getByText("0.0%", { exact: true }).waitFor();
  assert.match(await page.getByRole("tabpanel").innerText(), /100.0% beyond/);
  await page.close();
});
