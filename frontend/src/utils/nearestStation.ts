import type { Station } from "../types/station";
import { calculateDistanceKm } from "./distance.ts";
import { isCoverageStation } from "./mapLegend.ts";
import type { SensorTier } from "../types/budget";

export interface NearestStationResult {
  station: Station | null;
  distanceKm: number | null;
}

export function findNearestAirStation(latitude: number, longitude: number, stations: Station[]): NearestStationResult {
  return findNearestStation(latitude, longitude, stations, "air");
}

export function findNearestStation(
  latitude: number,
  longitude: number,
  stations: Station[],
  category: SensorTier,
): NearestStationResult {
  const compatibleStations = stations.filter((station) => isCoverageStation(station, category));

  if (compatibleStations.length === 0) {
    return {
      station: null,
      distanceKm: null,
    };
  }

  let nearestStation: Station | null = null;
  let nearestDistance: number | null = null;

  for (const station of compatibleStations) {
    const distance = calculateDistanceKm(
      latitude,
      longitude,
      station.lat,
      station.lng,
    );

    if (
      nearestDistance === null ||
      distance < nearestDistance
    ) {
      nearestStation = station;
      nearestDistance = distance;
    }
  }

  return {
    station: nearestStation,
    distanceKm: nearestDistance,
  };
}