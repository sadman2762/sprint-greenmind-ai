export interface SensorMetrics {
  uptimePct: number;
  recordedHours: number;
  expectedHours: number;
  averagePm25?: number;
  pm25Std?: number;
  signalJitter: number;
  driftPct: number;
  missingDataPct: number;
}

export interface SensorDiagnostic {
  stationCode: string;
  stationId: number | null;
  name: string;
  latitude: number;
  longitude: number;
  sensorCategory: "AIR" | "NOISE" | "WATER";
  sensorType: string;
  healthScore: number;
  estimatedDaysToService: number;
  status: "OPTIMAL" | "WARNING" | "CRITICAL";
  maintenancePriority: number;
  primaryRiskFactor: string;
  recommendedAction: string;
  metrics: SensorMetrics;
  lastTelemetryTimestamp: string;
  isCustom?: boolean;
}

export interface FleetHealthSummary {
  fleetHealthScore: number;
  totalStations: number;
  criticalCount: number;
  warningCount: number;
  optimalCount: number;
  avgDaysToService: number;
  earliestServiceStation?: string;
  earliestDays?: number;
}

export interface SensorHealthResponse {
  fleetSummary: FleetHealthSummary;
  stations: SensorDiagnostic[];
}

export interface RegisterSensorInput {
  stationCode?: string;
  name: string;
  sensorCategory?: "AIR" | "NOISE" | "WATER";
  sensorType?: string;
  latitude?: number;
  longitude?: number;
  healthScore?: number;
  estimatedDaysToService?: number;
}

const API_BASE_URL = "/api/sensor-health";

export async function fetchSensorHealth(): Promise<SensorHealthResponse> {
  const response = await fetch(`${API_BASE_URL}/`);
  if (!response.ok) {
    throw new Error(`Failed to fetch sensor health: ${response.statusText}`);
  }
  return response.json();
}

export async function registerNewSensorApi(
  input: RegisterSensorInput
): Promise<{ message: string; station: SensorDiagnostic; fleetReport: SensorHealthResponse }> {
  const response = await fetch(`${API_BASE_URL}/stations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    throw new Error(`Failed to register sensor: ${response.statusText}`);
  }
  return response.json();
}

export async function removeSensorApi(
  stationCode: string
): Promise<{ message: string; removedStationCode: string; fleetReport: SensorHealthResponse }> {
  const response = await fetch(
    `${API_BASE_URL}/stations/${encodeURIComponent(stationCode)}`,
    {
      method: "DELETE",
    }
  );
  if (!response.ok) {
    throw new Error(`Failed to decommission sensor: ${response.statusText}`);
  }
  return response.json();
}

