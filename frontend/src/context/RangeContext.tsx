import { RangeContext } from "./rangeState";
import { useState, type ReactNode } from "react";
import { INITIAL_RADII, sensorRadius, validRadius, type CoverageRadii } from "../utils/sensorRange";

export function RangeProvider({ children }: { children: ReactNode }) {
  const [radii, setRadii] = useState<CoverageRadii>({ ...INITIAL_RADII });
  const [placementRadii, setPlacementRadii] = useState<Partial<CoverageRadii>>({});
  const [overrides, setOverrides] = useState<Record<string, number>>({});
  return <RangeContext.Provider value={{ radii, overrides, placementRadii, setPlacementRadius: (category, radius) => { if (validRadius(radius)) setPlacementRadii(previous => ({ ...previous, [category]: radius })); },
    setRadius: (category, value) => { if (validRadius(value)) setRadii(previous => ({ ...previous, [category]: value })); },
    setOverride: (key, value) => {
      if (value !== null && !validRadius(value)) return;
      setOverrides(previous => { const next = { ...previous }; if (value === null) delete next[key]; else next[key] = value; return next; });
    },
    radiusFor: station => sensorRadius(station, radii, overrides),
  }}>{children}</RangeContext.Provider>;
}
