import { createContext, useContext } from "react";

export interface MapSelection {
  id: string;
  title: string;
  description?: string;
  subtitle?: string;
}

export interface MapInspectorState {
  selection: MapSelection | null;
  host: HTMLDivElement | null;
  setHost: (host: HTMLDivElement | null) => void;
  select: (selection: MapSelection, trigger?: HTMLElement | null) => void;
  close: (restoreFocus?: boolean) => void;
  dismiss: (featureId: string) => void;
}

export const MapInspectorContext = createContext<MapInspectorState | null>(null);

export function useMapInspector() {
  const context = useContext(MapInspectorContext);
  if (!context) throw new Error("Map inspector requires MapInspectorProvider");
  return context;
}
