import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright';
const origin = process.env.MAP_TEST_URL ?? 'http://127.0.0.1:5173';
const fixture = JSON.parse(await readFile(new URL('./jointPlan.fixture.json', import.meta.url), 'utf8'));

test('GPT-Live events execute real map actions once, preserve radii and stop microphone on end', async () => {
  const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL ?? 'msedge', headless: true, args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    const harness = { sent: [] as Record<string, unknown>[], stopped: false, channel: null as unknown as { onmessage: (e: { data: string }) => void }, emit: (event: unknown) => harness.channel.onmessage({ data: JSON.stringify(event) }) };
    Object.assign(window, { voiceFixture: harness });
    const getMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', { value: async () => {
      const stream = await getMedia({ audio: true });
      for (const track of stream.getTracks()) {
        const stop = track.stop.bind(track);
        track.stop = () => { harness.stopped = true; stop(); };
      }
      return stream;
    } });
    const NativeSocket = window.WebSocket;
    class VoiceSocket {
      static OPEN = 1;
      readyState = 1; bufferedAmount = 0;
      onmessage: (event: { data: string }) => void = () => {};
      onclose = () => {}; onerror = () => {};
      constructor(url: string | URL, protocols?: string | string[]) {
        if (!String(url).endsWith('/api/voice/stream')) return new NativeSocket(url, protocols) as unknown as VoiceSocket;
        harness.channel = this;
        setTimeout(() => harness.emit({ type: 'session.started', session: { id: 'synthetic-session' } }), 30);
      }
      send(json: string) { harness.sent.push(JSON.parse(json)); }
      close() { this.readyState = 3; }
    }
    Object.defineProperty(window, 'WebSocket', { value: VoiceSocket });
  });
  try {
    await page.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.pathname === '/api/voice/status') return route.fulfill({ json: { configured: true, localOnly: false, missing: [], model: 'gpt-live-1', reasoningModel: 'synthetic', reason: 'Synthetic test config' } });
      if (url.pathname === '/api/voice/session') return route.fulfill({ json: { sdp: 'v=0\r\nsynthetic answer', sessionId: 'synthetic-session' } });
      if (url.pathname === '/api/official-stations/') return route.fulfill({ json: { stations: [{ id: 1, stationCode: 'AIR-A', name: 'Synthetic station', lat: 47.53, lng: 21.62, station_type: 0, pm25: 10 }] } });
      if (url.pathname === '/api/plans/noise-sites') return route.fulfill({ json: { stations: [] } });
      if (url.pathname === '/traffic') return route.fulfill({ json: { locations: [] } });
      if (url.pathname === '/api/plans/coverage') return route.fulfill({ json: { installed: fixture.existingMetrics, chosen: fixture.existingMetrics, areaKm2: 205 } });
      if (url.pathname === '/api/plans/joint') return route.fulfill({ json: fixture });
      if (url.pathname === '/api/geocoding/reverse') return route.fulfill({ json: { displayName: 'Synthetic address', address: {} } });
      if (url.pathname.startsWith('/api/')) return route.fulfill({ json: { available: false } });
      if (url.origin === origin) return route.continue();
      return route.abort();
    });
    await page.goto(origin);
    await page.getByRole('button', { name: 'Voice', exact: true }).click();
    const panel = page.getByRole('region', { name: 'Voice map control' });
    await panel.getByRole('button', { name: 'Start voice control' }).click();
    await panel.getByText('Listening', { exact: true }).waitFor();
    await page.evaluate(() => {
      const h = (window as unknown as { voiceFixture: { emit: (event: unknown) => void } }).voiceFixture;
      h.emit({ type: 'session.output_audio.delta', delta: btoa(String.fromCharCode(...new Uint8Array(24000))) });
    });
    await panel.getByText('Speaking', { exact: true }).waitFor();
    await panel.getByText('Listening', { exact: true }).waitFor();
    await page.evaluate(() => (window as unknown as { voiceFixture: { emit: (event: unknown) => void } }).voiceFixture.emit({ type: 'session.delegation.created', delegation: { id: 'task-1', target: 'responses' } }));
    await panel.getByText('Processing', { exact: true }).waitFor();
    let sequence = 0;
    async function command(args: Record<string, unknown>, reusedId?: string) {
      const response = `response-${++sequence}`; const call = reusedId ?? `call-${sequence}`;
      await page.evaluate(({ response, call, args }) => {
        const h = (window as unknown as { voiceFixture: { emit: (event: unknown) => void; sent: unknown[] } }).voiceFixture;
        h.sent = [];
        h.emit({ type: 'session.delegation.created', delegation: { id: 'task-1', target: 'responses' } });
        const emit = (event: unknown) => h.emit({ type: 'response.event', delegation_id: 'task-1', event });
        // Real Azure follow-up tool calls start with in_progress, without created.
        emit({ type: 'response.in_progress', response: { id: response } });
        emit({ type: 'response.output_item.done', item: { type: 'function_call', call_id: call, name: 'control_map', arguments: JSON.stringify(args) } });
        emit({ type: 'response.completed', response: { id: response, output: [] } });
      }, { response, call, args });
      await page.waitForFunction(call => (window as unknown as { voiceFixture: { sent: { type: string; item?: { call_id: string } }[] } }).voiceFixture.sent.some(event => event.type === 'response.item.create' && event.item?.call_id === call), call);
      return page.evaluate(call => {
        const output = (window as unknown as { voiceFixture: { sent: { item?: { call_id: string; output: string } }[] } }).voiceFixture.sent.find(event => event.item?.call_id === call)!.item!.output;
        return JSON.parse(output);
      }, call);
    }
    assert.equal((await command({ action: 'set_network', category: 'water' })).ok, true);
    await page.getByRole('button', { name: 'Add water sensor', exact: true }).waitFor();
    assert.equal((await command({ action: 'suggest_sensors', count: 3 })).ok, false);
    const added = await command({ action: 'add_sensor', category: 'water', latitude: 47.53, longitude: 21.62, radiusKm: .3 }, 'add-once');
    assert.equal(added.ok, true);
    await command({ action: 'add_sensor', category: 'water', latitude: 47.53, longitude: 21.62, radiusKm: .3 }, 'add-once');
    const state = await command({ action: 'get_context' });
    assert.equal(state.data.planner.chosenCount, 1);
    const sensor = state.data.map.sensors.find((s: { id: string }) => s.id === added.data.id);
    assert.equal(sensor.radiusKm, .3);
    assert.equal((await command({ action: 'remove_sensor', sensorId: 'station-1' })).ok, false);
    assert.equal((await command({ action: 'move_sensor', sensorId: sensor.id, latitude: 0, longitude: 0 })).ok, false);
    assert.equal((await command({ action: 'remove_sensor', sensorId: sensor.id })).ok, true);
    assert.equal((await command({ action: 'set_network', category: 'air' })).ok, true);
    assert.equal((await command({ action: 'suggest_sensors', count: 3 })).ok, true);
    await page.getByRole('heading', { name: 'Joint suggestions', exact: true }).waitFor();
    assert.equal((await command({ action: 'set_comparison', view: 'before' })).ok, true);
    assert.equal((await command({ action: 'get_context' })).data.planner.before, true);
    assert.equal((await command({ action: 'apply_suggestions' })).ok, true);
    assert.equal((await command({ action: 'get_context' })).data.planner.chosenCount, 3);
    await page.setViewportSize({ width: 390, height: 844 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.screenshot({ path: '/tmp/greenmind-voice-mobile.png' });
    await panel.getByRole('button', { name: 'End conversation' }).click();
    await panel.getByText('Disconnected', { exact: true }).waitFor();
    assert.ok(await page.evaluate(() => (window as unknown as { voiceFixture: { stopped: boolean } }).voiceFixture.stopped));
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
