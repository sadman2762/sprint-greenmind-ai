import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { chromium } from "playwright";

const origin = process.env.MAP_TEST_URL ?? "http://127.0.0.1:5173";
const fixture = JSON.parse(await readFile(new URL("./jointPlan.fixture.json", import.meta.url), "utf8"));

test("reveal uses returned steps, pauses, scrubs, replays, and cancels when comparing", async () => {
  const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL ?? "msedge", headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: "no-preference" });
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  try {
    await page.route("**/*", async route => {
      const url = new URL(route.request().url());
      if (url.pathname === "/api/plans/joint") await route.fulfill({ json: fixture });
      else if (url.pathname === "/api/official-stations/") await route.fulfill({ json: { stations: [{ id: 1, name: "Synthetic test station", lat: 47.53, lng: 21.62, station_type: 0, pm25: 12 }] } });
      else if (url.pathname === "/api/plans/coverage") await route.fulfill({ json: { installed: fixture.existingMetrics, chosen: fixture.existingMetrics, areaKm2: fixture.studyArea.areaKm2 } });
      else if (url.pathname === "/api/plans/noise-sites") await route.fulfill({ json: { stations: [] } });
      else if (url.pathname === "/api/geocoding/reverse") await route.fulfill({ json: { displayName: "Synthetic address", address: {} } });
      else if (url.pathname === "/traffic") await route.fulfill({ json: { locations: [] } });
      else if (url.pathname.startsWith("/api/")) await route.fulfill({ json: {} });
      else if (url.origin === origin) await route.continue();
      else await route.abort();
    });
    await page.goto(origin);
    await page.getByRole("button", { name: "Suggest 3 together", exact: true }).click();
    const reveal = page.getByRole("region", { name: "Optimization playback" });
    await reveal.waitFor();
    assert.equal(await page.locator(".joint-plan-marker").count(), 0);
    await page.getByRole("button", { name: "Pause sensor reveal" }).click();
    await page.waitForTimeout(2400);
    assert.equal(await page.locator(".joint-plan-marker").count(), 0);
    await page.getByRole("button", { name: "Play sensor reveal" }).click();
    await page.waitForFunction(() => document.querySelectorAll(".joint-plan-marker").length === 1);
    await page.getByRole("button", { name: "Pause sensor reveal" }).click();
    assert.ok((await reveal.innerText()).includes(fixture.steps[0].marginalKm2.toFixed(2)));
    assert.ok((await reveal.innerText()).includes(fixture.steps[0].cumulative.coveragePercent.toFixed(1)));
    const slider = page.getByRole("slider", { name: "Revealed sensor count" });
    await slider.focus();
    await slider.press("End");
    assert.equal(await page.locator(".joint-plan-marker").count(), 3);
    await page.getByRole("button", { name: "Replay sensor reveal" }).click();
    assert.equal(await page.locator(".joint-plan-marker").count(), 0);
    await page.getByRole("button", { name: "Before · installed only", exact: true }).click();
    await page.waitForTimeout(2400);
    assert.equal(await page.locator(".joint-plan-marker").count(), 0);
    await page.getByRole("button", { name: "After · chosen + suggested", exact: true }).click();
    assert.equal(await page.getByRole("button", { name: "Pause sensor reveal" }).count(), 0);
    await page.getByRole("group", { name: "Build the network step by step" }).getByRole("button", { name: "+ 3", exact: true }).click();
    await page.getByRole("complementary", { name: "Plan your network" }).evaluate(el => el.querySelector("div[style]")?.scrollTo(0, 0));
    await page.screenshot({ path: "/private/tmp/greenmind-reveal-desktop.png", fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForFunction(() => document.documentElement.scrollWidth <= innerWidth);
    const panel = await reveal.boundingBox();
    const layers = await page.getByRole("button", { name: "Layers", exact: true }).boundingBox();
    assert.ok(panel && layers && panel.y + panel.height <= layers.y, "Mobile playback must not cover map controls");
    await page.screenshot({ path: "/private/tmp/greenmind-reveal-mobile.png", fullPage: true });
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
