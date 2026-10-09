import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { MapInspectorContext, type MapSelection } from "./mapInspectorState";

export default function MapInspectorProvider({ children }: { children: ReactNode }) {
  const [selection, setSelection] = useState<MapSelection | null>(null);
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  const select = useCallback((next: MapSelection, trigger?: HTMLElement | null) => {
    triggerRef.current = trigger ?? null;
    setSelection(next);
  }, []);

  const close = useCallback((restoreFocus = true) => {
    setSelection(null);
    if (restoreFocus && triggerRef.current?.isConnected) {
      triggerRef.current.focus({ preventScroll: true });
    }
  }, []);

  useEffect(() => {
    if (!selection) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !event.defaultPrevented) {
        event.preventDefault();
        close();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [selection, close]);

  const dismiss = useCallback((featureId: string) => {
    setSelection((current) => current?.id === featureId ? null : current);
  }, []);

  const value = useMemo(() => ({ selection, host, setHost, select, close, dismiss }), [selection, host, select, close, dismiss]);
  return <MapInspectorContext.Provider value={value}>{children}</MapInspectorContext.Provider>;
}
