import assert from "node:assert/strict";
import { test } from "node:test";
import { chromium } from "playwright";
import { environmentalFixture } from "./environmentalConditions.fixture.ts";

const origin = process.env.MAP_TEST_URL ?? "http://127.0.0.1:5173";

test("environmental charts: loading, metrics, gaps, collapse, errors, recovery and mobile", async () => {
  const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL ?? "msedge", headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce" });
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  let mode = "loading";
  let release: (() => void) | undefined;
  const ready = new Promise<void>(resolve => { release = resolve; });
  try {
    await page.route("**/*", async route => {
      const url = new URL(route.request().url());
      if (url.pathname === "/api/official-dataset/conditions") {
        if (mode === "loading") await ready;
        if (mode === "failure") return route.fulfill({ status: 503, json: { detail: "Synthetic failure" } });
        const payload = structuredClone(environmentalFixture);
        if (mode === "empty") payload.categories.water = { ...payload.categories.water, status: "empty", message: "No valid measurements are available in this dataset.", metrics: payload.categories.water.metrics.map(metric => ({ ...metric, points: [] })) };
        return route.fulfill({ json: payload });
      }
      if (url.pathname === "/api/official-stations/") return route.fulfill({ json: { stations: [{ id: 1, stationCode: "SYNTHETIC", name: "Synthetic air", lat: 47.53, lng: 21.62, station_type: 0, pm25: 12 }] } });
      if (url.pathname === "/api/plans/noise-sites") return route.fulfill({ json: { stations: [] } });
      if (url.pathname === "/traffic") return route.fulfill({ json: { locations: [] } });
      if (url.pathname === "/api/plans/coverage") return route.fulfill({ json: { installed: { coveredKm2: 10, coveragePercent: 5 }, chosen: { coveredKm2: 10, coveragePercent: 5 }, areaKm2: 200 } });
      if (url.pathname.startsWith("/api/")) return route.fulfill({ json: { available: false } });
      if (url.origin === origin) return route.continue();
      return route.abort();
    });
    await page.goto(origin);
    await page.getByRole("region", { name: "Historical environmental KPIs" }).waitFor();
    await page.getByRole("button", { name: "Environmental overview", exact: true }).click();
    const overview = page.getByRole("region", { name: "Environmental overview", exact: true });
    await overview.getByRole("status", { name: "Loading environmental charts" }).waitFor();
    mode = "success"; release?.();
    const air = overview.getByRole("article", { name: "Air conditions" });
    const water = overview.getByRole("article", { name: "Water conditions" });
    const noise = overview.getByRole("article", { name: "Noise conditions" });
    for (const card of [air, water, noise]) {
      await card.getByText("Latest recorded day: 2026-05-23").waitFor();
      assert.ok(await card.locator(".recharts-surface").count());
    }
    await air.getByText("View daily values", { exact: true }).click();
    await air.getByRole("table").getByText("Unavailable / 0", { exact: true }).waitFor();
    await air.getByText("View daily values", { exact: true }).click();
    await water.getByRole("combobox", { name: "Water metric" }).click();
    await page.getByRole("option", { name: "Water temperature (°C)", exact: true }).click();
    await water.getByRole("img", { name: /daily trend in °C/ }).waitFor();
    await water.getByRole("combobox", { name: "Water metric" }).click();
    await page.getByRole("option", { name: "Water level (m)", exact: true }).click();
    await water.getByRole("img", { name: /daily trend in m\./ }).waitFor();
    const map = page.getByRole("region", { name: "Plan comparison map" });
    const before = await map.boundingBox();
    const toggle = page.getByRole("button", { name: "Environmental overview", exact: true });
    await toggle.click();
    await overview.waitFor({ state: "hidden" });
    assert.equal(await toggle.getAttribute("aria-expanded"), "false");
    const after = await map.boundingBox();
    assert.ok(before && after && after.height > before.height);
    await toggle.click();
    mode = "failure";
    await overview.getByRole("button", { name: "Refresh", exact: true }).click();
    await overview.getByRole("alert").getByText(/could not be loaded/).waitFor();
    assert.equal(await overview.getByRole("article").count(), 0);
    mode = "empty";
    await overview.getByRole("button", { name: "Retry charts", exact: true }).click();
    await water.getByRole("alert").waitFor();
    await air.getByRole("img").waitFor();
    mode = "success";
    await overview.getByRole("button", { name: "Refresh", exact: true }).click();
    await noise.getByRole("img").waitFor();
    await page.screenshot({ path: "/tmp/greenmind-conditions-desktop.png" });
    await page.setViewportSize({ width: 390, height: 844 });
    await noise.scrollIntoViewIfNeeded();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
    const airBox = await air.boundingBox();
    const waterBox = await water.boundingBox();
    assert.ok(airBox && waterBox && waterBox.y > airBox.y && Math.abs(waterBox.x - airBox.x) < 1);
    await page.screenshot({ path: "/tmp/greenmind-conditions-mobile.png" });
    await page.setViewportSize({ width: 320, height: 700 });
    const rangeButton = await page.getByRole("button", { name: "Sensor ranges", exact: true }).boundingBox();
    assert.ok(rangeButton && rangeButton.x + rangeButton.width <= 320);
    await toggle.focus();
    await page.keyboard.press("Enter");
    await overview.waitFor({ state: "hidden" });
    await page.getByRole("button", { name: "Plan sensors", exact: true }).click();
    await page.getByRole("button", { name: "Suggest 3 together", exact: true }).waitFor();
    assert.deepEqual(errors, []);
  } finally { release?.(); await browser.close(); }
});
