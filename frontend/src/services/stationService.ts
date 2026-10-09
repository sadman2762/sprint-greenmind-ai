import type { Station } from "../types/station";

interface OfficialStationApiResponse {
  count: number;
  source: string;
  stations: Station[];
}

const API_URL = "/api/official-stations/";

export async function getStations(signal?: AbortSignal): Promise<Station[]> {
  const response = await fetch(API_URL, { signal });

  if (!response.ok) {
    throw new Error(
      `Failed to load official stations: ${response.status} ${response.statusText}`,
    );
  }

  const data: OfficialStationApiResponse = await response.json();

  if (!Array.isArray(data.stations)) {
    throw new Error("Invalid station response");
  }

  return data.stations;
}

export async function getNoiseSites(signal?: AbortSignal): Promise<Station[]> {
  const response = await fetch("/api/plans/noise-sites", { signal });
  if (!response.ok) throw new Error("Noise measurement sites are unavailable.");
  const data = await response.json();
  if (!Array.isArray(data.stations)) throw new Error("Invalid noise site response.");
  return data.stations;
}
