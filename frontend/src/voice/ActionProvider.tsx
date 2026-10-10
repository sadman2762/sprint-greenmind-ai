import { useState, type ReactNode } from 'react';
import { ActionContext } from './actionContext';
import { CommandRegistry } from './commands';
export default function ActionProvider({ children }: { children: ReactNode }) {
  const [registry] = useState(() => new CommandRegistry());
  return <ActionContext.Provider value={registry}>{children}</ActionContext.Provider>;
}
