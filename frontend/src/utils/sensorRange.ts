import type { Station } from "../types/station.ts";
import { TIER_CONFIGS, type SensorTier } from "../types/budget.ts";
import { getStationCategory } from "./mapLegend.ts";

export type CoverageRadii = Record<SensorTier, number>;
export const INITIAL_RADII: CoverageRadii = { air: TIER_CONFIGS.air.radiusKm, water: TIER_CONFIGS.water.radiusKm, noise: TIER_CONFIGS.noise.radiusKm };
export const MIN_RADIUS_KM = 0.05;
export const MAX_RADIUS_KM = 10;
export function validRadius(value: number) { return Number.isFinite(value) && value >= MIN_RADIUS_KM && value <= MAX_RADIUS_KM; }
export function sensorRangeKey(station: Pick<Station, "id" | "stationCode" | "station_type" | "sensorTier" | "lat" | "lng">) {
  return `${getStationCategory(station) ?? "air"}:${station.stationCode || station.id}`;
}
export function sensorRadius(station: Station, radii: CoverageRadii, overrides: Record<string, number>) {
  return overrides[sensorRangeKey(station)] ?? station.scenarioRadiusKm ?? radii[getStationCategory(station) ?? "air"];
}
// Match the planner's documented local distance model for scenario area shading.
export function scenarioDistanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  return Math.hypot((a.lat - b.lat) * 111.195, (a.lng - b.lng) * 111.195 * Math.cos(47.5316 * Math.PI / 180));
}
export function relativeRangeAt(point: { lat: number; lng: number }, stations: Station[], radii: CoverageRadii, overrides: Record<string, number>) {
  return stations.reduce((nearest, station) => Math.min(nearest, scenarioDistanceKm(point, station) / sensorRadius(station, radii, overrides)), Infinity);
}
