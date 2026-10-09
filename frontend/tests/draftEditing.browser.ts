import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { chromium } from "playwright";
const origin = process.env.MAP_TEST_URL ?? "http://127.0.0.1:5173";
const fixture = JSON.parse(await readFile(new URL("./jointPlan.fixture.json", import.meta.url), "utf8"));

test("choose a placement radius, drag purple proposals before applying, and preserve the edited coordinates", async () => {
  const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL ?? "msedge", headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 }, reducedMotion: "reduce" });
  const errors: string[] = [];
  page.on("pageerror", e => errors.push(e.message));
  let evaluated: { id: string; name: string; lat: number; lng: number; category: string; radiusKm: number }[] = [];
  let latestCoverage: { existingSimulation: typeof evaluated; sensorRadiusOverridesKm: Record<string, number> } | undefined;
  let reject = false;
  try {
    await page.route("**/*", async route => {
      const url = new URL(route.request().url());
      if (url.pathname === "/api/official-stations/") return route.fulfill({ json: { stations: [{ id: 1, name: "Synthetic air", lat: 47.53, lng: 21.62, station_type: 0, pm25: 12 }] } });
      if (url.pathname === "/api/plans/noise-sites") return route.fulfill({ json: { stations: [] } });
      if (url.pathname === "/traffic") return route.fulfill({ json: { locations: [] } });
      if (url.pathname === "/api/plans/coverage") { latestCoverage = route.request().postDataJSON(); return route.fulfill({ json: { installed: fixture.existingMetrics, chosen: fixture.existingMetrics, areaKm2: 205 } }); }
      if (url.pathname === "/api/plans/joint") {
        const radius = route.request().postDataJSON().newSensorRadiusKm;
        return route.fulfill({ json: { ...fixture, studyArea: { ...fixture.studyArea, radiusKm: radius } } });
      }
      if (url.pathname === "/api/plans/evaluate") {
        if (reject) return route.fulfill({ status: 422, json: { detail: "Synthetic move rejection" } });
        evaluated = route.request().postDataJSON().proposedStations;
        const steps = evaluated.map((station, i) => ({ ...fixture.steps[i], station, recalculation: null, updatedRanking: [], marginalKm2: 1.25, overlapFraction: .4 }));
        return route.fulfill({ json: { schemaVersion: "1.0-draft", stations: evaluated, steps, existingMetrics: fixture.existingMetrics, metrics: { ...fixture.jointPlan.metrics, addedKm2: 3.75 }, warnings: [] } });
      }
      if (url.pathname === "/api/geocoding/reverse") return route.fulfill({ json: { displayName: "Synthetic address", address: { road: "Synthetic road" } } });
      if (url.pathname.includes("/api/")) return route.fulfill({ json: {} });
      if (url.origin === origin) return route.continue();
      return route.abort();
    });
    await page.goto(origin);
    await page.getByRole("button", { name: "Add sensor", exact: true }).click();
    const radius = page.getByRole("spinbutton", { name: "New sensor radius (km)", exact: true });
    await radius.fill("0.45"); await radius.press("Enter");
    const map = await page.locator(".leaflet-container").boundingBox(); assert.ok(map);
    await page.mouse.click(map.x + map.width / 2 + 40, map.y + map.height / 2);
    await page.getByRole("button", { name: "Location basket · 1", exact: true }).waitFor();
    await page.waitForFunction(() => document.body.innerText.includes("individual settings"));
    assert.equal(Object.values(latestCoverage!.sensorRadiusOverridesKm).includes(.45), true);
    await page.getByRole("spinbutton", { name: "Suggested sensor radius (km)", exact: true }).fill("0.8");
    await page.getByRole("spinbutton", { name: "Suggested sensor radius (km)", exact: true }).press("Enter");
    await page.getByRole("button", { name: "Suggest 3 together", exact: true }).click();
    await page.getByRole("heading", { name: "Joint suggestions", exact: true }).waitFor();
    const marker = page.locator('.joint-plan-marker[title="Joint station 1"]');
    async function dragBy(dx: number, dy: number) {
      await marker.hover();
      const b = await marker.boundingBox(); assert.ok(b);
      await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
      await page.mouse.down(); await page.mouse.move(b.x + b.width / 2 + dx, b.y + b.height / 2 + dy, { steps: 12 }); await page.mouse.up();
    }
    await dragBy(24, 12);
    await page.getByRole("heading", { name: "Adjusted suggestions", exact: true }).waitFor();
    assert.equal(await page.locator(".joint-plan-marker").count(), 3);
    assert.equal(await page.getByRole("button", { name: "Location basket · 4", exact: true }).count(), 1);
    assert.equal(evaluated[0].radiusKm, .8);
    assert.notEqual(evaluated[0].lng, fixture.jointPlan.stations[0].lng);
    assert.equal(evaluated[1].lat, fixture.jointPlan.stations[1].lat);
    assert.equal(await page.getByRole("button", { name: "Compare methods & results", exact: true }).count(), 0);
    await marker.hover();
    const accepted = await marker.boundingBox(); assert.ok(accepted);
    reject = true;
    await dragBy(-12, -6);
    await page.getByText("Synthetic move rejection", { exact: true }).waitFor();
    const restored = await marker.boundingBox(); assert.ok(restored);
    assert.ok(Math.abs(restored.x - accepted.x) < 2 && Math.abs(restored.y - accepted.y) < 2);
    await page.getByRole("button", { name: "Location basket · 4", exact: true }).click();
    await page.getByRole("button", { name: "Apply these 3 suggestions", exact: true }).click();
    await page.getByRole("button", { name: "Location basket · 4", exact: true }).waitFor();
    await page.getByRole("heading", { name: "Adjusted suggestions", exact: true }).waitFor({ state: "hidden" });
    await page.waitForFunction(() => !document.querySelector(".joint-plan-marker"));
    assert.equal(latestCoverage!.existingSimulation.length, 4);
    const applied = latestCoverage!.existingSimulation.find(s => Math.abs(s.lng - evaluated[0].lng) < 1e-9);
    assert.ok(applied);
    assert.equal(latestCoverage!.sensorRadiusOverridesKm[`air:${applied.id}`], .8);
    assert.deepEqual(errors, []);
    await page.screenshot({ path: "/tmp/greenmind-edited-proposals.png" });
  } catch (error) { await page.screenshot({ path: "/tmp/greenmind-draft-failure.png" }); throw error; } finally { await browser.close(); }
});
