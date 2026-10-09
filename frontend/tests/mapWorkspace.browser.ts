import assert from "node:assert/strict";
import { after, afterEach, before, beforeEach, test } from "node:test";
import { chromium, type Browser, type Page } from "playwright";

let browser: Browser;
let page: Page;
let errors: string[];
const origin = process.env.MAP_TEST_URL ?? "http://localhost:5173";
const stations = [
  { id: 1, name: "Test Air Alpha", stationCode: "TEST-A", station_type: 0, lat: 47.53, lng: 21.62, pm25: 7.4, pm10: 22.9, no2: 2, o3: 120.8, co: 0.29, timestamp: "2026-06-19T12:00:00Z" },
  { id: 2, name: "Test Air Beta", stationCode: "TEST-B", station_type: 0, lat: 47.545, lng: 21.65, pm25: 17 },
  { id: 3, name: "Test Water Gamma", stationCode: "TEST-C", station_type: 1, lat: 47.51, lng: 21.635 },
];

before(async () => { browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL ?? "chromium" }); });
after(async () => { await browser?.close(); });
beforeEach(async () => {
  page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce" });
  errors = [];
  page.setDefaultTimeout(10000);
  page.on("pageerror", (error) => { errors.push(error.message); console.error(error.message); });
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.port === "8000" || url.pathname.startsWith("/api/") || url.pathname === "/traffic") {
      const body = url.pathname === "/traffic"
        ? { locations: [{ stopName: "Test Transit Stop", latitude: 47.52, longitude: 21.655, trafficActivityScore: 50, passengerFrequencyTotal: 12, passengersInTotal: 5, passengersOutTotal: 7 }] }
        : { stations, count: stations.length, source: "Synthetic browser-test fixture" };
      await route.fulfill({ json: body, headers: { "access-control-allow-origin": "*" } });
    } else if (url.pathname === "/__map-test__") {
      await route.fulfill({ contentType: "text/html", body: `<html><head><meta name="viewport" content="width=device-width, initial-scale=1.0"></head><body><div id="root"></div><script type="module">
        import RefreshRuntime from '/@react-refresh';
        RefreshRuntime.injectIntoGlobalHook(window);
        window.$RefreshReg$ = () => {};
        window.$RefreshSig$ = () => (type) => type;
        window.__vite_plugin_react_preamble_installed__ = true;
        await import('/tests/mapWorkspace.fixture.tsx');
      </script></body></html>` });
    } else if (url.origin === origin) {
      await route.continue();
    } else {
      await route.abort();
    }
  });
  await page.goto(`${origin}/__map-test__`);
  await page.getByRole("button", { name: "Test Air Alpha", exact: true }).waitFor();
  await page.getByRole("button", { name: "Air coverage", exact: true }).click();
});
afterEach(async () => {
  await page?.close();
  assert.deepEqual(errors, [], "Browser must not report uncaught exceptions");
});

async function geometry() {
  const map = await page.locator(".leaflet-container").boundingBox();
  const marker = await page.getByRole("button", { name: "Test Air Alpha", exact: true }).boundingBox();
  assert.ok(map && marker);
  return { map, x: marker.x + marker.width / 2 - map.x - map.width / 2, y: marker.y + marker.height / 2 - map.y - map.height / 2 };
}

async function waitForPaintedCoverage() {
  await page.waitForFunction(() => Array.from(document.querySelectorAll<HTMLCanvasElement>(".leaflet-coverage-grid-pane canvas")).some((canvas) => {
    const context = canvas.getContext("2d");
    return context && context.getImageData(0, 0, canvas.width, canvas.height).data.some((value, index) => index % 4 === 3 && value > 0);
  }));
}

test("selecting and switching stations uses one non-overlapping inspector and preserves map position", async () => {
  await waitForPaintedCoverage();
  const before = await geometry();
  await page.getByRole("button", { name: "Test Air Alpha", exact: true }).click();
  const panel = page.getByRole("complementary", { name: "Map feature details" });
  await panel.getByText("Recorded 19 Jun 2026, 12:00 UTC").waitFor();
  await page.waitForFunction(() => {
    const map = document.querySelector(".leaflet-container")!.getBoundingClientRect();
    const panel = document.querySelector("aside")!.getBoundingClientRect();
    return map.right <= panel.left + 1;
  });
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  await waitForPaintedCoverage();
  const after = await geometry();
  assert.ok(after.map.width < before.map.width);
  if (process.env.MAP_SCREENSHOT_DIR) await page.screenshot({ path: `${process.env.MAP_SCREENSHOT_DIR}/greenmind-map-desktop.png`, fullPage: true });
  assert.ok(Math.abs(after.x - before.x) < 3 && Math.abs(after.y - before.y) < 3, `Map center must stay stable: ${JSON.stringify({ before, after })}`);
  assert.equal(await page.locator(".leaflet-popup").count(), 0);
  assert.equal(await page.locator(".leaflet-marker-icon.is-selected").count(), 1);
  assert.notEqual(
    await page.locator(".leaflet-marker-icon.is-selected").evaluate((node) => getComputedStyle(node).boxShadow),
    await page.getByRole("button", { name: "Test Air Beta", exact: true }).evaluate((node) => getComputedStyle(node).boxShadow),
    "Selected markers must retain a visible ring even when Leaflet suppresses pointer-focus outlines",
  );
  await page.getByRole("button", { name: "Test Air Beta", exact: true }).click();
  await panel.getByText("Recording time unavailable").waitFor();
  assert.equal(await page.getByRole("complementary").count(), 1);
  assert.match(await panel.innerText(), /17.0/);
  assert.doesNotMatch(await panel.innerText(), /WHO target/);
  if (process.env.MAP_SCREENSHOT_DIR) await page.screenshot({ path: `${process.env.MAP_SCREENSHOT_DIR}/greenmind-map-desktop.png`, fullPage: true });
  await page.keyboard.press("Escape");
  await panel.waitFor({ state: "detached" });
  assert.equal(await page.getByRole("button", { name: "Test Air Beta", exact: true }).evaluate((node) => node === document.activeElement), true);
});

test("legend expands, hides, restores, persists and does not place a sensor", async () => {
  await page.getByRole("button", { name: "Add sensor" }).click();
  await page.getByRole("button", { name: "Expand map legend" }).click();
  await page.getByRole("heading", { name: "PM2.5 · µg/m³" }).waitFor();
  await page.getByRole("button", { name: "Hide map legend" }).click();
  assert.equal(await page.getByLabel("Simulation count").innerText(), "0");
  await page.reload();
  await page.getByRole("button", { name: "Show map legend" }).click();
  await page.getByRole("button", { name: "Expand map legend" }).waitFor();
});

test("coverage category and band controls update the map without inventing noise data", async () => {
  await page.getByRole("button", { name: "Water coverage", exact: true }).click();
  await page.getByText("1 existing · 0 planned", { exact: true }).waitFor();
  assert.match(await page.getByRole("button", { name: "Near coverage band" }).innerText(), /1.5/);
  await page.getByRole("button", { name: "About coverage and readings" }).click();
  await page.getByText(/not hydrological catchments/).waitFor();
  await page.keyboard.press("Escape");
  for (const name of ["Near coverage band", "Mid-range coverage band", "Gap coverage band"]) {
    await page.getByRole("button", { name, exact: true }).click();
  }
  await page.getByText("No bands selected", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Show all", exact: true }).click();
  assert.equal(await page.getByRole("button", { name: "Gap coverage band" }).getAttribute("aria-pressed"), "true");
  await page.getByRole("button", { name: "Noise coverage", exact: true }).click();
  await page.getByText("No noise locations in feed", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Add pin", exact: true }).click();
  await page.locator(".leaflet-container").click({ position: { x: 700, y: 300 } });
  await page.getByText("0 existing · 1 planned · Simulation only", { exact: true }).waitFor();
  assert.equal(await page.locator(".custom-pin-marker-noise").count(), 1);
  if (process.env.MAP_SCREENSHOT_DIR) await page.screenshot({ path: `${process.env.MAP_SCREENSHOT_DIR}/greenmind-map-coverage-controls.png`, fullPage: true });
});

test("keyboard selection and hiding a selected station layer dismiss details cleanly", async () => {
  const marker = page.getByRole("button", { name: "Test Air Alpha", exact: true });
  for (const key of ["Enter", "Space"]) {
    await marker.focus();
    await page.keyboard.press(key);
    await page.getByRole("complementary").waitFor();
    await page.keyboard.press("Escape");
    await page.getByRole("complementary").waitFor({ state: "detached" });
  }
  await marker.focus();
  await page.keyboard.press("Enter");
  await page.getByRole("complementary").waitFor();
  await page.getByRole("switch", { name: "Stations", exact: true }).click();
  await page.getByRole("complementary").waitFor({ state: "detached" });
});

test("water and transit points use category-specific inspector content", async () => {
  await page.getByRole("button", { name: "Water coverage", exact: true }).click();
  await page.getByRole("button", { name: "Test Water Gamma", exact: true }).click();
  const panel = page.getByRole("complementary");
  await panel.getByText("Water measurements are not included in this station response.").waitFor();
  assert.doesNotMatch(await panel.innerText(), /Key Pollutant/);
  await page.getByRole("switch", { name: "DKV Transit", exact: true }).click();
  await page.getByRole("button", { name: "Test Transit Stop", exact: true }).click();
  await panel.getByText("Test Transit Stop", { exact: true }).first().waitFor();
  assert.equal(await page.locator(".leaflet-popup").count(), 0);
});

test("proposed and custom placements retain controls in the inspector", async () => {
  await page.getByRole("button", { name: "Add test proposal" }).click();
  const proposed = page.locator('.leaflet-marker-icon[class*="simulated-sensor-marker"]');
  await proposed.click();
  const panel = page.getByRole("complementary");
  await panel.getByText("Planned location · not an installed sensor.").waitFor();
  await panel.getByRole("button", { name: "Remove From Simulation" }).click();
  await panel.waitFor({ state: "detached" });
  assert.equal(await page.getByLabel("Simulation count").innerText(), "0");
  await page.getByRole("button", { name: "Add sensor" }).click();
  await page.locator(".leaflet-container").click({ position: { x: 700, y: 300 } });
  const custom = page.locator('.leaflet-marker-icon[class*="custom-pin-marker"]');
  await custom.click();
  await panel.getByText("Planned location · not an installed sensor.").waitFor();
  assert.equal(await page.locator(".leaflet-popup").count(), 0);
  await panel.getByRole("button", { name: "Remove This Custom Sensor" }).click();
  await panel.waitFor({ state: "detached" });
});

test("mobile inspector docks below the map and expands without horizontal overflow", async () => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Hide map legend" }).click();
  await page.getByRole("button", { name: "Reset view" }).click();
  await page.getByRole("button", { name: "Test Air Alpha", exact: true }).click();
  const panel = page.getByRole("complementary");
  await panel.getByRole("button", { name: "Expand details" }).click();
  await panel.getByText("PM2.5").waitFor();
  const mapBox = await page.locator(".leaflet-container").boundingBox();
  const panelBox = await panel.boundingBox();
  assert.ok(mapBox && panelBox && panelBox.y >= mapBox.y + mapBox.height - 1);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
  if (process.env.MAP_SCREENSHOT_DIR) await page.screenshot({ path: `${process.env.MAP_SCREENSHOT_DIR}/greenmind-map-mobile.png`, fullPage: true });
  await panel.getByRole("button", { name: "Collapse details" }).click();
  await panel.getByRole("button", { name: "Close location details" }).click();
  await panel.waitFor({ state: "detached" });
});

test("overview and category switching preserve usable controls without a coverage-description crash", async () => {
  await page.getByRole("button", { name: "All networks", exact: true }).click();
  assert.equal(await page.getByRole("group", { name: "Visible coverage bands", exact: true }).count(), 0);
  await page.getByRole("button", { name: "About coverage and readings" }).click();
  await page.getByText(/Colors and shapes identify sensor categories/).waitFor();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Air coverage", exact: true }).click();
  await waitForPaintedCoverage();
});
