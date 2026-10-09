export interface DistrictProfile {
  district: string;
  lat: number;
  lng: number;
  category: string;
  pm25: number | null;
  no2: number | null;
  krigingUncertainty: number;
  surrogateRiskScore: number;
  informationGainScore: number;
  mlConfidence: number;
  dayNoise: number;
  nightNoise: number;
  color: string;
}

export interface CityHealthAnalytics {
  healthScore: number;
  airScore: number;
  noiseScore: number;
  waterScore: number;
  vitalityLabel: string;
  vitalityColor: string;
  vitalityBg: string;
  headline: string;
  citizenTip: string;
  statusSummary: string;
}

export interface VitalSignTelemetry {
  averagePm25: number;
  averageNo2: number | null;
  validSensorCount: number;
  statusLabel: string;
  progressPercent: number;
}

export interface AcousticsTelemetry {
  daytimeNoiseDb: number;
  nighttimeNoiseDb: number;
  stationCount: number;
  recordCount: number;
  statusLabel: string;
  progressPercent: number;
}

export interface GroundwaterTelemetry {
  temperatureC: number;
  stationCount: number;
  recordCount: number;
  statusLabel: string;
  progressPercent: number;
}

export interface TelemetrySummary {
  airStationCount: number;
  validPm25Count: number;
  noiseStationCount: number;
  noiseRecordCount: number;
  groundwaterStationCount: number;
  groundwaterRecordCount: number;
  trafficStopCount: number;
  highActivityTransitCount: number;
}

export interface AiCityAnalyticsResponse {
  cityHealth: CityHealthAnalytics;
  districtProfiles: DistrictProfile[];
  vitalSigns: {
    airQuality: VitalSignTelemetry;
    urbanAcoustics: AcousticsTelemetry;
    groundwater: GroundwaterTelemetry;
  };
  telemetry: TelemetrySummary;
  modelMeta: {
    algorithm: string;
    epistemicUncertainty: string;
    lastCalculated: string;
  };
}

const API_BASE_URL = "/api/recommendations/ai-city-analytics";

export async function getAiCityAnalytics(signal?: AbortSignal): Promise<AiCityAnalyticsResponse> {
  const response = await fetch(API_BASE_URL, { signal });
  if (!response.ok) {
    throw new Error(`Failed to load AI city analytics: ${response.status}`);
  }
  return response.json();
}
