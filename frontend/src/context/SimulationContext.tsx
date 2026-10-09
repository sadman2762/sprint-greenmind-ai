import {
  createContext,
  useContext,
  useMemo,
  useState,
} from "react";

import type { Station } from "../types/station";
import type { SensorRecommendation } from "../types/recommendation";
import { createCustomRecommendation } from "../utils/createCustomRecommendation";

import { TIER_CONFIGS, type SensorTier, type OptimizedStation, type TierConfig } from "../types/budget";

export interface SimulatedStation extends Station {
  recommendation: SensorRecommendation;
  isCustom?: boolean;
  sensorTier?: SensorTier;
  tierName?: string;
  tierBadge?: string;
  unitCost?: number;
  annualOm?: number;
}

interface SimulationContextType {
  simulatedStations: SimulatedStation[];

  simulateRecommendation: (
    recommendation: SensorRecommendation,
  ) => void;

  deployOptimizedPlan: (stations: OptimizedStation[]) => void;
  applySuggestedLocations: (locations: { id: string; lat: number; lng: number; category?: "air" | "noise"; radiusKm?: number }[]) => { id: number; category: SensorTier; radiusKm?: number }[];

  addCustomPin: (
    lat: number,
    lng: number,
    stations: Station[],
    tier?: SensorTier,
  ) => number;

  updateCustomPin: (
    id: number,
    lat: number,
    lng: number,
    stations: Station[],
  ) => void;

  updateStationPosition: (
    id: number,
    lat: number,
    lng: number,
    stations: Station[],
  ) => void;

  updateStationTier: (
    id: number,
    tier: SensorTier,
    tierConfig: TierConfig,
  ) => void;

  removeSimulatedStation: (id: number) => void;

  clearSimulation: () => void;

  isPlacingCustomPin: boolean;
  setIsPlacingCustomPin: (placing: boolean | ((prev: boolean) => boolean)) => void;

  customPinTier: SensorTier;
  setCustomPinTier: (tier: SensorTier) => void;
}

const SimulationContext =
  createContext<SimulationContextType | null>(null);

export function SimulationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [simulatedStations, setSimulatedStations] = useState<
    SimulatedStation[]
  >([]);

  const [isPlacingCustomPin, setIsPlacingCustomPin] = useState(false);
  const [customPinTier, setCustomPinTier] = useState<SensorTier>("air");

  function simulateRecommendation(
    recommendation: SensorRecommendation,
  ) {
    const rawTier = (recommendation as any).recommendedHardwareTier;
    const sensorTier: SensorTier =
      rawTier === "air" || rawTier === "water" || rawTier === "noise"
        ? rawTier
        : recommendation.recommendationType === "water_sensor" || recommendation.primaryMonitoringNeed === "water"
        ? "water"
        : recommendation.recommendationType === "noise_sensor" || recommendation.primaryMonitoringNeed === "noise"
        ? "noise"
        : "air";
    const tierConfig = TIER_CONFIGS[sensorTier] || TIER_CONFIGS.air;

    const station: SimulatedStation = {
      id: recommendation.id || Date.now(),
      name: (recommendation as any).name || `${tierConfig.badge}: ${recommendation.recommendedSensor || tierConfig.name} #${recommendation.id}`,
      lat: recommendation.lat,
      lng: recommendation.lng,
      station_type: 0,
      pm25: recommendation.estimatedPm25,
      pm10: recommendation.estimatedPm10,
      no2: recommendation.estimatedNo2,
      o3: recommendation.estimatedO3,
      windSpeed: recommendation.estimatedWindSpeed,
      windDirection: 0,
      recommendation,
      isCustom: false,
      sensorTier,
      tierName: tierConfig.name,
      tierBadge: tierConfig.badge,
      unitCost: tierConfig.unitCost,
      annualOm: tierConfig.annualOm,
    };

    setSimulatedStations((previous) => {
      const alreadySimulated = previous.some(
        (existing) =>
          existing.lat === recommendation.lat &&
          existing.lng === recommendation.lng,
      );

      if (alreadySimulated) {
        return previous;
      }

      return [...previous, station];
    });
  }

  function addCustomPin(
    lat: number,
    lng: number,
    stations: Station[],
    tier?: SensorTier,
  ): number {
    const pinId = Date.now();
    const recommendation = createCustomRecommendation(lat, lng, stations, pinId);
    const selectedTier = tier || customPinTier || "air";
    const tierConfig = TIER_CONFIGS[selectedTier] || TIER_CONFIGS.air;

    const station: SimulatedStation = {
      id: pinId,
      name: `Custom ${tierConfig.name} #${pinId.toString().slice(-4)}`,
      lat,
      lng,
      station_type: 0,
      pm25: recommendation.estimatedPm25,
      pm10: recommendation.estimatedPm10,
      no2: recommendation.estimatedNo2,
      o3: recommendation.estimatedO3,
      windSpeed: recommendation.estimatedWindSpeed,
      windDirection: 0,
      recommendation,
      isCustom: true,
      sensorTier: selectedTier,
      tierName: tierConfig.name,
      tierBadge: tierConfig.badge,
      unitCost: tierConfig.unitCost,
      annualOm: tierConfig.annualOm,
    };

    setSimulatedStations((previous) => [...previous, station]);
    return pinId;
  }

  function updateCustomPin(
    id: number,
    lat: number,
    lng: number,
    stations: Station[],
  ) {
    updateStationPosition(id, lat, lng, stations);
  }

  function updateStationPosition(
    id: number,
    lat: number,
    lng: number,
    stations: Station[],
  ) {
    setSimulatedStations((previous) =>
      previous.map((station) => {
        if (station.id !== id) {
          return station;
        }

        const recommendation = createCustomRecommendation(
          lat,
          lng,
          stations,
          id,
        );

        return {
          ...station,
          lat,
          lng,
          pm25: recommendation.estimatedPm25,
          pm10: recommendation.estimatedPm10,
          no2: recommendation.estimatedNo2,
          o3: recommendation.estimatedO3,
          windSpeed: recommendation.estimatedWindSpeed,
          recommendation: {
            ...station.recommendation,
            ...recommendation,
            lat,
            lng,
          },
        };
      }),
    );
  }

  function updateStationTier(
    id: number,
    tier: SensorTier,
    tierConfig: TierConfig,
  ) {
    setSimulatedStations((previous) =>
      previous.map((station) => {
        if (station.id !== id) return station;
        return {
          ...station,
          sensorTier: tier,
          tierName: tierConfig.name,
          tierBadge: tierConfig.badge,
          unitCost: tierConfig.unitCost,
          annualOm: tierConfig.annualOm,
          name: station.isCustom
            ? `Custom ${tierConfig.name} #${station.id.toString().slice(-4)}`
            : `${tierConfig.badge}: Sensor #${station.id}`,
        };
      }),
    );
  }

  function removeSimulatedStation(id: number) {
    setSimulatedStations((previous) =>
      previous.filter((station) => station.id !== id),
    );
  }

  function deployOptimizedPlan(stations: OptimizedStation[]) {
    const newSimulatedStations: SimulatedStation[] = stations.map((st) => ({
      id: st.id,
      name: `${st.tierBadge}: Sensor #${st.id}`,
      lat: st.lat,
      lng: st.lng,
      station_type: 0,
      pm25: st.estimatedPm25,
      pm10: st.estimatedPm10,
      no2: st.estimatedNo2,
      o3: st.estimatedO3,
      windSpeed: st.estimatedWindSpeed,
      windDirection: 0,
      recommendation: st,
      isCustom: false,
      sensorTier: st.sensorTier,
      tierName: st.tierName,
      tierBadge: st.tierBadge,
      unitCost: st.unitCost,
      annualOm: st.annualOm,
    }));

    setSimulatedStations(newSimulatedStations);
  }

  function applySuggestedLocations(locations: { id: string; lat: number; lng: number; category?: "air" | "noise"; radiusKm?: number }[]) {
    const seed = Math.max(Date.now(), ...simulatedStations.map(s => s.id + 1));
    const added: SimulatedStation[] = [];
    const ranges: { id: number; category: SensorTier; radiusKm?: number }[] = [];
    for (const [index, location] of locations.entries()) {
      const category = location.category ?? "air";
      const config = TIER_CONFIGS[category];
      if ([...simulatedStations, ...added].some(s => (s.sensorTier ?? "air") === category && Math.abs(s.lat - location.lat) < 1e-6 && Math.abs(s.lng - location.lng) < 1e-6)) continue;
      const id = seed + index;
      added.push({ id, lat: location.lat, lng: location.lng, name: `Suggested ${category} sensor ${simulatedStations.filter(s => !s.isCustom).length + added.length + 1}`,
        station_type: category === "noise" ? 2 : 0, sensorTier: category, isCustom: false,
        recommendation: createCustomRecommendation(location.lat, location.lng, [], id),
        tierName: config.name, tierBadge: config.badge, unitCost: config.unitCost, annualOm: config.annualOm });
      ranges.push({ id, category, radiusKm: location.radiusKm });
    }
    setSimulatedStations(previous => [...previous, ...added.filter(s => !previous.some(p => p.id === s.id || ((p.sensorTier ?? "air") === s.sensorTier && Math.abs(p.lat - s.lat) < 1e-6 && Math.abs(p.lng - s.lng) < 1e-6)))]);
    return ranges;
  }

  function clearSimulation() {
    setSimulatedStations([]);
  }

  const value = useMemo(
    () => ({
      simulatedStations,
      simulateRecommendation,
      deployOptimizedPlan,
      applySuggestedLocations,
      addCustomPin,
      updateCustomPin,
      updateStationPosition,
      updateStationTier,
      removeSimulatedStation,
      clearSimulation,
      isPlacingCustomPin,
      setIsPlacingCustomPin,
      customPinTier,
      setCustomPinTier,
    }),
    [simulatedStations, isPlacingCustomPin, customPinTier],
  );

  return (
    <SimulationContext.Provider value={value}>
      {children}
    </SimulationContext.Provider>
  );
}

export function useSimulation() {
  const context = useContext(SimulationContext);

  if (!context) {
    throw new Error(
      "useSimulation must be used inside SimulationProvider",
    );
  }

  return context;
}