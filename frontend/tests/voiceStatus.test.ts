import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { createServer, type ViteDevServer } from 'vite';
import type { LiveConnection as Connection } from '../src/voice/LiveConnection.ts';
let server: ViteDevServer;
let create: (statuses: string[]) => Connection;
before(async () => {
  server = await createServer({ server: { middlewareMode: true, watch: null, hmr: false }, appType: 'custom' });
  const { LiveConnection } = await server.ssrLoadModule('/src/voice/LiveConnection.ts');
  const { CommandRegistry } = await server.ssrLoadModule('/src/voice/commands.ts');
  create = statuses => new LiveConnection(new CommandRegistry(), { status: (s: string) => statuses.push(s), log: () => {}, closed: () => {} });
});
after(async () => { await server?.close(); });
function start(connection: Connection, id = 'task-1') {
  connection.handle({ type: 'session.started' });
  connection.handle({ type: 'session.delegation.created', delegation: { id } });
  connection.handle({ type: 'response.event', delegation_id: id, event: { type: 'response.in_progress', response: { id: `response-${id}` } } });
}
test('a spoken answer without tool calls returns from Processing to Listening', () => {
  const states: string[] = []; const connection = create(states); start(connection);
  assert.equal(states.at(-1), 'Processing');
  connection.handle({ type: 'response.event', delegation_id: 'task-1', event: { type: 'response.completed', response: { id: 'response-task-1', output: [] } } });
  assert.equal(states.at(-1), 'Listening');
});
test('provider errors clear Processing without revealing provider text', () => {
  const states: string[] = []; const connection = create(states); start(connection);
  connection.handle({ type: 'error', error: { code: 'server_error' } });
  assert.equal(states.at(-1), 'Listening');
});
test('completion of an older delegation cannot clear the active processing state', () => {
  const states: string[] = []; const connection = create(states); start(connection); start(connection, 'task-2');
  connection.handle({ type: 'response.event', delegation_id: 'task-1', event: { type: 'response.cancelled', response: { id: 'response-task-1' } } });
  assert.equal(states.at(-1), 'Processing');
});
