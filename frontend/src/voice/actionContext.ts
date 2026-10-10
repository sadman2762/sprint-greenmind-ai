import { createContext, useContext, useLayoutEffect } from 'react';
import { CommandRegistry, type Action, type CommandHandler } from './commands';
export const ActionContext = createContext<CommandRegistry | null>(null);
export function useActionRegistry() {
  const registry = useContext(ActionContext);
  if (!registry) throw new Error('ActionProvider is required.');
  return registry;
}
export function useVoiceActions(scope: string, handlers: Partial<Record<Action, CommandHandler>>, context: () => unknown) {
  const registry = useActionRegistry();
  // Replace handlers after each commit so tools always use current state, including after planner remounts.
  useLayoutEffect(() => registry.register(scope, handlers, context), [registry, scope, handlers, context]);
}

/** Standalone legend renderers also work without a voice provider. */
export function useOptionalVoiceActions(scope: string, handlers: Partial<Record<Action, CommandHandler>>, context: () => unknown) {
  const registry = useContext(ActionContext);
  useLayoutEffect(() => registry?.register(scope, handlers, context), [registry, scope, handlers, context]);
}
