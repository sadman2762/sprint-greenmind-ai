import { createContext, useContext } from "react";
import type { Station } from "../types/station";
import type { SensorTier } from "../types/budget";
import type { CoverageRadii } from "../utils/sensorRange";

export interface RangeState {
  radii: CoverageRadii;
  placementRadii: Partial<CoverageRadii>;
  setPlacementRadius: (category: SensorTier, radius: number) => void;
  overrides: Record<string, number>;
  setRadius: (category: SensorTier, value: number) => void;
  setOverride: (key: string, value: number | null) => void;
  radiusFor: (station: Station) => number;
}
export const RangeContext = createContext<RangeState | null>(null);
export function useRanges() {
  const context = useContext(RangeContext);
  if (!context) throw new Error("RangeProvider is required");
  return context;
}
