export interface OfficialDatasetSummary {
  rows: number;
  stations: number;
  startTimestamp: string;
  endTimestamp: string;
  measurementColumns: string[];
  missingValues: Record<string, number>;
}

export interface LatestStationMeasurement {
  stationCode: string;
  location: string;
  timestamp: string;

  pm25: number | null;
  pm10: number | null;
  no2: number | null;
  o3: number | null;
  co: number | null;
  co2: number | null;
  humidity: number | null;
  pressure: number | null;
  wind_speed: number | null;
  wind_direction: number | null;
}

interface LatestMeasurementsResponse {
  count: number;
  stations: LatestStationMeasurement[];
}

const API_BASE_URL = "/api/official-dataset";

export async function getOfficialDatasetSummary(): Promise<
  OfficialDatasetSummary
> {
  const response = await fetch(`${API_BASE_URL}/summary`);

  if (!response.ok) {
    throw new Error(
      `Failed to load official dataset summary: ${response.status}`,
    );
  }

  return response.json();
}

export async function getLatestOfficialMeasurements(): Promise<
  LatestStationMeasurement[]
> {
  const response = await fetch(`${API_BASE_URL}/latest`);

  if (!response.ok) {
    throw new Error(
      `Failed to load latest measurements: ${response.status}`,
    );
  }

  const data: LatestMeasurementsResponse = await response.json();

  return data.stations;
}