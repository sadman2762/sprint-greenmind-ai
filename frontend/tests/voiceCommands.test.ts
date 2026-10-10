import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CommandRegistry, parseCommand } from '../src/voice/commands.ts';

test('voice commands reject unsupported actions, unknown fields, missing coordinates and invalid radii', () => {
  for (const input of [null, { action: 'run_code' }, { action: 'add_sensor', category: 'air' }, { action: 'set_radius', scope: 'category', category: 'air', radiusKm: -1 }, { action: 'set_network', category: 'air', code: 'alert(1)' }, { action: 'move_suggestion', index: 1.5, latitude: 47.53, longitude: 21.62 }]) {
    assert.throws(() => parseCommand(input));
  }
  assert.equal(parseCommand({ action: 'set_radius', scope: 'placement', category: 'water', radiusKm: .3 }).radiusKm, .3);
});

test('voice registry reads fresh handlers and cancelled commands cannot mutate state', async () => {
  const registry = new CommandRegistry();
  let calls = 0;
  registry.register('map', { add_sensor: () => { calls++; return { ok: true, message: 'added' }; } }, () => ({ count: calls }));
  const abort = new AbortController(); abort.abort();
  const command = { action: 'add_sensor', category: 'air', latitude: 47.53, longitude: 21.62, radiusKm: 1 };
  assert.equal((await registry.execute(command, abort.signal)).ok, false);
  assert.equal(calls, 0);
  const active = new AbortController();
  await registry.execute(command, active.signal);
  assert.equal(calls, 1);
  registry.register('map', { add_sensor: () => ({ ok: false, message: 'changed view' }) }, () => ({ count: calls }));
  assert.equal((await registry.execute(command, active.signal)).message, 'changed view');
  assert.deepEqual((await registry.execute({ action: 'get_context' }, active.signal)).data, { map: { count: 1 } });
});
