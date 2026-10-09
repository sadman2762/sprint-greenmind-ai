import type { SensorRecommendation } from "../types/recommendation";
import type { Station } from "../types/station";
import { findNearestAirStation } from "./nearestStation.ts";

// A placement is a location, not a measuring instrument. Legacy numeric score
// fields remain neutral for compatibility; placementOnly forbids presenting them
// as an assessment. Environmental observations are explicitly unavailable.
export function createCustomRecommendation(lat: number, lng: number, stations: Station[], existingId?: number): SensorRecommendation {
  const nearest = findNearestAirStation(lat, lng, stations);
  return {
    id: existingId ?? Date.now(), lat, lng, placementOnly: true,
    nearestStation: nearest.station?.name ?? "No compatible station available",
    distanceKm: nearest.distanceKm ?? Number.NaN,
    recommendationType: "air_sensor", recommendedSensor: "Planned sensor", primaryMonitoringNeed: "air",
    estimatedPm25: null, estimatedPm10: null, estimatedNo2: null, estimatedO3: null, estimatedWindSpeed: null,
    estimatedDaytimeNoise: null, estimatedNighttimeNoise: null,
    estimatedConductivity: null, estimatedWaterLevel: null, estimatedWaterTemperature: null,
    coverageScore: 0, airCoverageScore: 0, noiseCoverageScore: 0, waterCoverageScore: 0,
    pm25Risk: 0, pm10Risk: 0, no2Risk: 0, o3Risk: 0,
    pm25VariabilityRisk: 0, pm10VariabilityRisk: 0, no2VariabilityRisk: 0,
    pollutionRisk: 0, variabilityRisk: 0, windRisk: 0, noiseRisk: 0, waterMonitoringPriority: 0,
    airSuitability: 0, noiseSuitability: 0, waterSuitability: 0, priorityScore: 0,
    coverageConfidence: 0, pollutionConfidence: 0, variabilityConfidence: 0, windConfidence: 0, overallConfidence: 0,
    airConfidence: 0, noiseConfidence: 0, waterConfidence: 0,
    noiseStationCount: 0, waterStationCount: 0, trafficActivityScore: 0, trafficRisk: 0, trafficConfidence: 0,
    nearestTrafficStop: null, trafficDistanceKm: null, nearbyTrafficStopCount: 0,
    nearbyPassengerFrequency: 0, nearbyPassengersIn: 0, nearbyPassengersOut: 0,
  };
}
