export const ACTIONS = ['get_context', 'set_network', 'set_layer', 'set_radius', 'suggest_sensors', 'apply_suggestions', 'discard_suggestions', 'add_sensor', 'move_sensor', 'move_suggestion', 'remove_sensor', 'focus_sensor', 'set_comparison', 'show_connections', 'open_basket', 'reset_view', 'zoom', 'select_step', 'export_plan', 'search_location'] as const;
export type Action = typeof ACTIONS[number];
export interface Command {
  action: Action;
  category?: 'air' | 'water' | 'noise' | 'all';
  layer?: 'stations' | 'coverage' | 'outlines' | 'historical_transit' | 'live_transit';
  visible?: boolean;
  radiusKm?: number;
  distanceKm?: number;
  scope?: 'category' | 'suggestions' | 'placement' | 'sensor';
  sensorId?: string;
  count?: 1 | 2 | 3;
  index?: number;
  latitude?: number;
  longitude?: number;
  view?: 'before' | 'after' | 'original' | 'both';
  direction?: 'in' | 'out';
  query?: string;
}
export type CommandResult = { ok: boolean; message: string; data?: unknown };
export type CommandHandler = (command: Command, signal: AbortSignal) => CommandResult | Promise<CommandResult>;
const allowed = new Set(['action', 'category', 'layer', 'visible', 'radiusKm', 'distanceKm', 'scope', 'sensorId', 'count', 'index', 'latitude', 'longitude', 'view', 'direction', 'query']);
const enums: Record<string, readonly unknown[]> = {
  action: ACTIONS, category: ['air', 'water', 'noise', 'all'], layer: ['stations', 'coverage', 'outlines', 'historical_transit', 'live_transit'],
  scope: ['category', 'suggestions', 'placement', 'sensor'], count: [1, 2, 3], view: ['before', 'after', 'original', 'both'], direction: ['in', 'out'],
};
export function parseCommand(input: unknown): Command {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Invalid command.');
  const c = input as Record<string, unknown>;
  if (!ACTIONS.includes(c.action as Action) || Object.keys(c).some(k => !allowed.has(k))) throw new Error('Unsupported command.');
  for (const [key, options] of Object.entries(enums)) if (c[key] !== undefined && !options.includes(c[key])) throw new Error(`Invalid ${key}.`);
  for (const [key, min, max] of [['radiusKm', .05, 10], ['distanceKm', .1, 10], ['latitude', -90, 90], ['longitude', -180, 180], ['index', 0, 100]] as const) {
    if (c[key] !== undefined && (typeof c[key] !== 'number' || !Number.isFinite(c[key]) || c[key] < min || c[key] > max)) throw new Error(`Invalid ${key}.`);
  }
  if (c.index !== undefined && !Number.isInteger(c.index)) throw new Error('Index must be an integer.');
  if (c.visible !== undefined && typeof c.visible !== 'boolean') throw new Error('Invalid visibility.');
  for (const key of ['sensorId', 'query']) if (c[key] !== undefined && (typeof c[key] !== 'string' || !c[key].trim() || c[key].length > 160)) throw new Error(`Invalid ${key}.`);
  const requirements: Partial<Record<Action, string[]>> = {
    set_network: ['category'], set_layer: ['layer', 'visible'], set_radius: ['scope', 'radiusKm'], suggest_sensors: ['count'],
    add_sensor: ['category', 'radiusKm', 'latitude', 'longitude'], move_sensor: ['sensorId', 'latitude', 'longitude'],
    move_suggestion: ['index', 'latitude', 'longitude'], remove_sensor: ['sensorId'], set_comparison: ['view'],
    open_basket: ['visible'], zoom: ['direction'], select_step: ['index'], search_location: ['query'],
  };
  for (const key of requirements[c.action as Action] ?? []) if (c[key] === undefined) throw new Error(`Missing ${key}.`);
  if (c.action === 'set_radius' && c.scope === 'sensor' && !c.sensorId) throw new Error('Select a sensor first.');
  if (c.action === 'set_radius' && ['category', 'placement'].includes(String(c.scope)) && (!c.category || c.category === 'all')) throw new Error('Choose air, water or noise.');
  if (c.action === 'add_sensor' && c.category === 'all') throw new Error('Choose one sensor category.');
  return c as unknown as Command;
}

/** A small allowlist dispatcher: no DOM clicking, eval, arbitrary URLs or shell commands. */
export class CommandRegistry {
  private handlers = new Map<string, Partial<Record<Action, CommandHandler>>>();
  private contexts = new Map<string, () => unknown>();
  register(scope: string, handlers: Partial<Record<Action, CommandHandler>>, context: () => unknown) {
    this.handlers.set(scope, handlers); this.contexts.set(scope, context);
    return () => { if (this.handlers.get(scope) === handlers) { this.handlers.delete(scope); this.contexts.delete(scope); } };
  }
  context() { return Object.fromEntries([...this.contexts].map(([name, get]) => [name, get()])); }
  async execute(input: unknown, signal: AbortSignal): Promise<CommandResult> {
    if (signal.aborted) return { ok: false, message: 'Voice session ended; action cancelled.' };
    try {
      const command = parseCommand(input);
      if (command.action === 'get_context') return { ok: true, message: 'Current workspace state.', data: this.context() };
      for (const [scope, handlers] of this.handlers) {
        if (command.action === 'set_radius' && scope !== (command.scope === 'suggestions' ? 'planner' : 'map')) continue;
        if (command.action === 'focus_sensor' && scope !== (command.index !== undefined ? 'planner' : 'viewport')) continue;
        const handler = handlers[command.action];
        if (handler) return await handler(command, signal);
      }
      return { ok: false, message: 'This action is unavailable in the current view.' };
    } catch (error) { return { ok: false, message: error instanceof Error ? error.message : 'Action failed.' }; }
  }
}
