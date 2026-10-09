export interface LiveVehicle {
  id: string;
  vehicleId: string | null;
  label: string | null;
  routeId: string | null;
  routeName: string | null;
  tripId: string | null;
  mode: string;
  latitude: number;
  longitude: number;
  bearing: number | null;
  speedKmh: number | null;
  observedAt: number | null;
  freshnessAt: number | null;
  stale: boolean;
}
export interface LiveSnapshot {
  provider: string;
  fetchedAt: number;
  feedTimestamp: number | null;
  refreshSeconds: number;
  skippedPositions: number;
  vehicles: LiveVehicle[];
}
export async function getLiveVehicles(signal: AbortSignal): Promise<LiveSnapshot> {
  const response = await fetch('/api/transit/vehicles', { signal, cache: 'no-store' });
  if (!response.ok) {
    throw new Error(response.status === 503
      ? 'Live transport is not configured. Set the feed URL and API key on the backend.'
      : 'The transport feed is unavailable. Retrying automatically.');
  }
  return response.json();
}
