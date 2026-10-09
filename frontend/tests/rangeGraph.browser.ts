import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { chromium } from "playwright";
const origin = process.env.MAP_TEST_URL ?? "http://127.0.0.1:5173";
const fixture = JSON.parse(await readFile(new URL("./jointPlan.fixture.json", import.meta.url), "utf8"));
test("water access, range controls, graph navigation and scenario invalidation", async () => {
  const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL ?? "msedge", headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce" });
  const errors: string[] = [];
  const requests: Record<string, unknown>[] = [];
  page.on("pageerror", e => errors.push(e.message));
  try {
    await page.route("**/*", async route => {
      const url = new URL(route.request().url());
      if (url.pathname === "/api/official-stations/") return route.fulfill({ json: { stations: [
        { id: 1, stationCode: "AIR-A", name: "Synthetic air A", lat: 47.53, lng: 21.62, station_type: 0, pm25: 12 },
        { id: 2, name: "Synthetic air B", lat: 47.535, lng: 21.63, station_type: 0, pm25: 10 },
        { id: 3, name: "Synthetic water", lat: 47.531, lng: 21.62, station_type: 1 },
      ] } });
      if (url.pathname === "/api/plans/noise-sites") return route.fulfill({ json: { stations: [{ id: -10, stationCode: "NOISE-A", name: "Synthetic noise", lat: 47.532, lng: 21.62, station_type: 2, sensorTier: "noise", nighttimeNoise: 50 }] } });
      if (url.pathname === "/traffic") return route.fulfill({ json: { locations: [{ stopName: "Synthetic DKV stop", latitude: 47.5315, longitude: 21.62, trafficActivityScore: 44, passengerFrequencyTotal: 100 }] } });
      if (url.pathname === "/api/plans/coverage") { requests.push(route.request().postDataJSON()); return route.fulfill({ json: { installed: fixture.existingMetrics, chosen: fixture.existingMetrics, areaKm2: 205 } }); }
      if (url.pathname === "/api/plans/joint") { requests.push(route.request().postDataJSON()); return route.fulfill({ json: fixture }); }
      if (url.pathname === "/api/geocoding/reverse") return route.fulfill({ json: { displayName: "Synthetic address", address: { road: "Synthetic road" } } });
      if (url.pathname.includes("/api/")) return route.fulfill({ json: { available: false } });
      if (url.origin === origin) return route.continue();
      return route.abort();
    });
    await page.goto(origin);
    await page.getByRole("button", { name: "Connections", exact: true }).waitFor();
    const chooser = page.getByRole("group", { name: "Network to plan" });
    await chooser.getByRole("button", { name: "Water", exact: true }).click();
    await page.getByRole("button", { name: "Add water sensor", exact: true }).waitFor();
    assert.equal(await page.getByRole("button", { name: "Suggest 3 together", exact: true }).count(), 0);
    await page.getByRole("button", { name: "Add water sensor", exact: true }).click();
    await page.getByText("Click the map to place this water quality sensor. Drag the marker to adjust.").waitFor();
    await chooser.getByRole("button", { name: "Air", exact: true }).click();
    await page.getByRole("button", { name: "Sensor ranges", exact: true }).click();
    await page.getByRole("spinbutton", { name: "Air radius", exact: true }).fill("0.75");
    await page.getByRole("spinbutton", { name: "Air radius", exact: true }).press("Enter");
    await page.getByRole("spinbutton", { name: "Water radius", exact: true }).fill("0.3");
    await page.getByRole("spinbutton", { name: "Water radius", exact: true }).press("Enter");
    await page.getByRole("button", { name: "Done", exact: true }).click();
    await page.getByRole("button", { name: "Near coverage band" }).getByText("≤ 0.75 km").waitFor();
    await page.getByRole("button", { name: "Connections", exact: true }).click();
    await page.getByRole("group", { name: "Sensor and transit relationship graph" }).waitFor();
    await page.getByRole("button", { name: "Explore Synthetic DKV stop", exact: true }).click();
    await page.getByRole("heading", { name: "Synthetic DKV stop", exact: true }).waitFor();
    await page.getByRole("button", { name: "Explore Synthetic air A", exact: true }).click();
    await page.getByText("Adjust this sensor’s radius", { exact: true }).click();
    const radius = page.getByRole("spinbutton", { name: "This sensor’s scenario radius", exact: true });
    await radius.fill("0.25"); await radius.press("Enter");
    await page.getByRole("button", { name: "Use category radius", exact: true }).waitFor();
    await page.getByRole("button", { name: "Near coverage band" }).getByText("≤ 1 × radius").waitFor();
    await page.getByText("Adjust this sensor’s radius", { exact: true }).click();
    await page.screenshot({ path: "/tmp/greenmind-range-graph.png" });
    await page.getByRole("button", { name: "Close location details", exact: true }).click();
    await page.getByRole("button", { name: "Suggest 3 together", exact: true }).click();
    await page.getByRole("heading", { name: "Joint suggestions", exact: true }).waitFor();
    const last = requests.at(-1) as { coverageRadiiKm: { air: number; water: number }; sensorRadiusOverridesKm: Record<string, number> };
    assert.equal(last.coverageRadiiKm.air, .75); assert.equal(last.coverageRadiiKm.water, .3); assert.equal(last.sensorRadiusOverridesKm["air:AIR-A"], .25);
    await page.getByRole("button", { name: "Sensor ranges", exact: true }).click();
    await page.getByRole("spinbutton", { name: "Air radius", exact: true }).fill("1.2");
    await page.getByRole("spinbutton", { name: "Air radius", exact: true }).press("Enter");
    await page.getByRole("button", { name: "Done", exact: true }).click();
    assert.equal(await page.getByRole("heading", { name: "Joint suggestions", exact: true }).count(), 0);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole("button", { name: "Connections", exact: true }).first().click();
    await page.getByRole("group", { name: "Sensor and transit relationship graph" }).waitFor();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
    await page.getByRole("button", { name: "Collapse details", exact: true }).click();
    await page.getByRole("group", { name: "Sensor and transit relationship graph" }).waitFor({ state: "hidden" });
    await page.getByRole("group", { name: "Location inspector view" }).getByRole("button", { name: "Connections", exact: true }).click();
    await page.getByRole("group", { name: "Sensor and transit relationship graph" }).waitFor();
    await page.screenshot({ path: "/tmp/greenmind-range-graph-mobile.png" });
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
