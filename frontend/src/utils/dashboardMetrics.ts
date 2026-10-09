import type { AiCityAnalyticsResponse } from "../services/aiAnalyticsService.ts";
import type { Station } from "../types/station.ts";

export function finiteValue(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function measurement(value: number | null, unit: string): string {
  return value === null ? "Unavailable" : `${value.toFixed(1)} ${unit}`;
}

export function getDashboardMetrics(stations: Station[], analytics: AiCityAnalyticsResponse | null) {
  const readings = stations.filter((station) => station.station_type === 0)
    .map((station) => finiteValue(station.pm25))
    .filter((value): value is number => value !== null && value >= 0);
  const acoustics = analytics?.vitalSigns?.urbanAcoustics;
  const groundwater = analytics?.vitalSigns?.groundwater;
  const score = finiteValue(analytics?.cityHealth?.healthScore);
  return {
    averagePm25: readings.length ? readings.reduce((sum, value) => sum + value, 0) / readings.length : null,
    readingCount: readings.length,
    daytimeNoise: acoustics && acoustics.stationCount > 0 ? finiteValue(acoustics.daytimeNoiseDb) : null,
    nighttimeNoise: acoustics && acoustics.stationCount > 0 ? finiteValue(acoustics.nighttimeNoiseDb) : null,
    temperature: groundwater && groundwater.stationCount > 0 ? finiteValue(groundwater.temperatureC) : null,
    healthScore: score !== null && score >= 0 && score <= 100 ? score : null,
  };
}
