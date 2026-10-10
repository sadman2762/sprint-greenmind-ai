import policy from '../../../shared/voice-policy.json' with { type: 'json' };
export type Action = keyof typeof policy.actions;
export const ACTIONS = Object.keys(policy.actions) as Action[];
export interface Command {
  action: Action;
  city?: 'debrecen' | 'budapest';
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
  legendMode?: 'hidden' | 'compact' | 'expanded';
  band?: 'near' | 'intermediate' | 'gap';
  panel?: 'ranges' | 'preferences' | 'planning' | 'layers';
  filter?: 'all' | 'sensors' | 'transit';
  mode?: 'all' | 'bus' | 'tram' | 'trolley' | 'subway' | 'suburban' | 'train' | 'ferry' | 'default';
  reason?: 'policy_override' | 'secret_request' | 'unsupported';
  environmentalWeight?: number;
  minSeparationKm?: number;
}
export type CommandResult = { ok: boolean; message: string; data?: unknown };
export type CommandHandler = (command: Command, signal: AbortSignal) => CommandResult | Promise<CommandResult>;
export function parseCommand(input: unknown): Command {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Invalid command.');
  const c = input as Record<string, unknown>;
  if (typeof c.action !== 'string' || !ACTIONS.includes(c.action as Action)) throw new Error('Unsupported command.');
  const spec = policy.actions[c.action as Action];
  const fields = new Set(['action', ...spec.required, ...spec.optional]);
  if (Object.keys(c).some(k => !fields.has(k))) throw new Error('Unsupported command fields.');
  for (const key of spec.required) if (c[key] === undefined) throw new Error(`Missing ${key}.`);
  for (const [key, value] of Object.entries(c)) {
    const property = policy.properties[key as keyof typeof policy.properties];
    if (property.type === 'string' && (typeof value !== 'string' || !value.trim() || value.length > 160)) throw new Error(`Invalid ${key}.`);
    if ('enum' in property && !(property.enum as readonly unknown[]).includes(value)) throw new Error(`Invalid ${key}.`);
    if (property.type === 'boolean' && typeof value !== 'boolean') throw new Error(`Invalid ${key}.`);
    if (property.type === 'number' || property.type === 'integer') {
      const [min, max] = policy.limits[key as keyof typeof policy.limits];
      if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max || (property.type === 'integer' && !Number.isInteger(value))) throw new Error(`Invalid ${key}.`);
    }
  }
  if (c.action === 'set_radius' && c.scope === 'sensor' && !c.sensorId) throw new Error('Select a sensor first.');
  if (c.action === 'set_radius' && ['category', 'placement'].includes(String(c.scope)) && (!c.category || c.category === 'all')) throw new Error('Choose air, water or noise.');
  if (c.action === 'add_sensor' && c.category === 'all') throw new Error('Choose one sensor category.');
  if (c.action === 'set_placement' && c.visible && (!c.category || c.category === 'all')) throw new Error('Choose one sensor category.');
  if (c.action === 'set_planning_preferences' && c.environmentalWeight === undefined && c.minSeparationKm === undefined) throw new Error('Choose a planning preference.');
  if (c.action === 'focus_sensor') {
    const targets = Number(c.sensorId !== undefined) + Number(c.index !== undefined) + Number(c.latitude !== undefined || c.longitude !== undefined);
    if (targets !== 1 || (c.latitude !== undefined) !== (c.longitude !== undefined)) throw new Error('Choose one complete focus target.');
  }
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
      const planningActions: Action[] = ['suggest_sensors', 'apply_suggestions', 'add_sensor', 'move_sensor', 'move_suggestion', 'remove_sensor', 'set_placement', 'set_radius', 'set_planning_preferences'];
      if (planningActions.includes(command.action) && (this.context().city as { city?: string } | undefined)?.city === 'budapest') return { ok: false, message: 'Sensor planning is available in Debrecen. Switch city to Debrecen first.' };
      if (command.action === 'refuse_request') return { ok: false, message: 'Request declined under GreenMind voice policy. I can help with permitted map and sensor planning actions.' };
      if (command.action === 'get_context') return { ok: true, message: 'Current workspace state.', data: this.context() };
      for (const [scope, handlers] of this.handlers) {
        if (command.action === 'open_panel' && scope !== (command.panel === 'ranges' ? 'ranges' : command.panel === 'layers' ? 'map' : 'planner')) continue;
        if (command.action === 'set_radius' && scope !== (command.scope === 'suggestions' ? 'planner' : 'map')) continue;
        if (command.action === 'focus_sensor' && scope !== (command.index !== undefined ? 'planner' : 'viewport')) continue;
        const handler = handlers[command.action];
        if (handler) return await handler(command, signal);
      }
      return { ok: false, message: 'This action is unavailable in the current view.' };
    } catch (error) { return { ok: false, message: error instanceof Error ? error.message : 'Action failed.' }; }
  }
}
