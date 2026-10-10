import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
const fixture = JSON.parse(await readFile(new URL('./jointPlan.fixture.json', import.meta.url), 'utf8'));
import { chromium } from 'playwright';
const origin = process.env.MAP_TEST_URL ?? 'http://127.0.0.1:5173';

test('live vehicles: truthful source, positions, mode icons, snapshot replacement, failure, hide and mobile', async () => {
  const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL ?? 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors: string[] = [];
  let calls = 0;
  let state = 'first';
  page.on('pageerror', e => errors.push(e.message));
  const now = Math.floor(Date.now() / 1000);
  try {
    await page.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.pathname === '/api/official-stations/') return route.fulfill({ json: { stations: [{ id: 1, stationCode: 'SYNTHETIC', name: 'Synthetic air', lat: 47.53, lng: 21.62, station_type: 0, pm25: 12 }] } });
      if (url.pathname === '/api/plans/noise-sites') return route.fulfill({ json: { stations: [] } });
      if (url.pathname === '/traffic') return route.fulfill({ json: { locations: [] } });
      if (url.pathname === '/api/transit/vehicles') {
        calls++;
        if (state === 'failure') return route.fulfill({ status: 502, json: { detail: 'Synthetic unavailable' } });
        return route.fulfill({ json: { provider: 'BKK · Budapest', fetchedAt: now, feedTimestamp: now, refreshSeconds: 15, skippedPositions: 0,
          vehicles: state === 'empty' ? [] : [{ id: 'synthetic-1', vehicleId: 'TEST-1', label: null, routeId: 'r1', routeName: '10', tripId: null, mode: 'bus', latitude: state === 'moved' ? 47.535 : 47.53, longitude: 21.62, bearing: null, speedKmh: 0, observedAt: now, freshnessAt: now, stale: false },
          { id: 'synthetic-2', vehicleId: 'TEST-2', label: null, routeId: null, routeName: null, tripId: null, mode: 'default', latitude: 47.537, longitude: 21.622, bearing: null, speedKmh: null, observedAt: null, freshnessAt: now - 300, stale: true }].slice(0, state === 'moved' ? 1 : 2) } });
      }
      if (url.pathname === '/api/plans/coverage') return route.fulfill({ json: { installed: fixture.existingMetrics, chosen: fixture.existingMetrics, areaKm2: 205 } });
      if (url.pathname.startsWith('/api/')) return route.fulfill({ json: { available: false } });
      if (url.origin === origin) return route.continue();
      return route.abort();
    });
    await page.goto(origin);
    await page.getByRole('button', { name: 'Live transport', exact: true }).click();
    const panel = page.getByRole('region', { name: 'Live transport status' });
    await panel.getByText('1 recent · 1 old / unverified').waitFor();
    await panel.getByText('BKK feed · Budapest and regional services. DKV coverage is not confirmed.').waitFor();
    assert.equal(await page.locator('.live-vehicle-marker').count(), 2);
    // The screenshot regression: transport and inspector must not sit under the toolbar.
    await page.getByRole('button', { name: 'Connections', exact: true }).click();
    const inspector = page.getByRole('complementary', { name: 'Map feature details' });
    await inspector.waitFor();
    const toolbar = page.getByRole('toolbar', { name: 'Map controls' });
    const toolbarBounds = await toolbar.boundingBox();
    const transportBounds = await panel.boundingBox();
    const inspectorBounds = await inspector.boundingBox();
    assert.ok(toolbarBounds && transportBounds && inspectorBounds);
    assert.ok(toolbarBounds.y + toolbarBounds.height <= transportBounds.y, 'Transport must sit below the toolbar');
    assert.ok(toolbarBounds.y + toolbarBounds.height <= inspectorBounds.y, 'Inspector must sit below the toolbar');
    for (const name of ['Live transport', 'Layers', 'Add sensor']) {
      assert.ok(await toolbar.getByRole('button', { name, exact: true }).evaluate(el => {
        const box = el.getBoundingClientRect();
        return el.contains(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2));
      }), `${name} must remain clickable`);
    }
    await page.screenshot({ path: '/private/tmp/greenmind-panels-fixed.png', fullPage: true });
    await page.getByRole('button', { name: 'Close location details', exact: true }).click();

    await page.locator('.live-vehicle-marker[title="Route 10 · TEST-1"]').click();
    await page.getByText('Speed: 0 km/h', { exact: true }).waitFor();
    const before = await page.locator('.live-vehicle-marker[title="Route 10 · TEST-1"]').getAttribute('style');
    state = 'moved';
    await panel.getByRole('button', { name: 'Refresh', exact: true }).click();
    await panel.getByText('1 recent · 0 old / unverified').waitFor();
    assert.equal(await page.locator('.live-vehicle-marker').count(), 1);
    assert.notEqual(await page.locator('.live-vehicle-marker').getAttribute('style'), before);
    await page.setViewportSize({ width: 390, height: 844 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
    await page.screenshot({ path: '/tmp/greenmind-live-transit-mobile.png' });
    state = 'failure';
    await panel.getByRole('button', { name: 'Refresh', exact: true }).click();
    await panel.getByText('The transport feed is unavailable. Retrying automatically.').waitFor();
    assert.equal(await page.locator('.live-vehicle-marker').count(), 0);
    state = 'empty';
    await panel.getByRole('button', { name: 'Refresh', exact: true }).click();
    await panel.getByText('No vehicle positions in this snapshot.').waitFor();
    await panel.getByRole('button', { name: 'Hide', exact: true }).click();
    await panel.waitFor({ state: 'hidden' });
    const stoppedAt = calls;
    await page.waitForTimeout(15500);
    assert.equal(calls, stoppedAt);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
