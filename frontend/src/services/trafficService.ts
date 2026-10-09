export interface TrafficLocation {
  stopName: string;
  latitude: number;
  longitude: number;
  trafficActivityScore: number;
  passengerFrequencyTotal: number;
  passengersInTotal: number;
  passengersOutTotal: number;
}

interface TrafficResponse {
  count: number;
  source: string;
  locations: TrafficLocation[];
}

export async function getTrafficLocations(signal?: AbortSignal): Promise<TrafficLocation[]> {
  const response = await fetch("/traffic", { signal });

  if (!response.ok) {
    throw new Error("Failed to load DKV traffic locations.");
  }

  const data: TrafficResponse = await response.json();

  return data.locations;
}
