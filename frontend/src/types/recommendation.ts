export type RecommendationType =
  | "full_station"
  | "air_sensor"
  | "noise_sensor"
  | "water_sensor";

export type MonitoringNeed =
  | "air"
  | "noise"
  | "water";

export interface SensorRecommendation {
  placementOnly?: boolean;
  id: number;
  lat: number;
  lng: number;

  nearestStation: string;
  distanceKm: number;

  recommendationType: RecommendationType;
  recommendedSensor: string;
  primaryMonitoringNeed: MonitoringNeed;

  estimatedPm25?: number | null;
  estimatedPm10?: number | null;
  estimatedNo2?: number | null;
  estimatedO3?: number | null;
  estimatedWindSpeed?: number | null;

  estimatedPm25Std?: number | null;
  estimatedPm10Std?: number | null;
  estimatedNo2Std?: number | null;

  estimatedDaytimeNoise?: number | null;
  estimatedNighttimeNoise?: number | null;

  estimatedConductivity?: number | null;
  estimatedWaterLevel?: number | null;
  estimatedWaterTemperature?: number | null;

  coverageScore: number;
  airCoverageScore: number;
  noiseCoverageScore: number;
  waterCoverageScore: number;

  pm25Risk: number;
  pm10Risk: number;
  no2Risk: number;
  o3Risk: number;

  pm25VariabilityRisk: number;
  pm10VariabilityRisk: number;
  no2VariabilityRisk: number;

  pollutionRisk: number;
  variabilityRisk: number;
  windRisk: number;
  noiseRisk: number;
  waterMonitoringPriority: number;

  airSuitability: number;
  noiseSuitability: number;
  waterSuitability: number;

  priorityScore: number;

  coverageConfidence: number;
  pollutionConfidence: number;
  variabilityConfidence: number;
  windConfidence: number;
  overallConfidence: number;

  airConfidence: number;
  noiseConfidence: number;
  waterConfidence: number;

  noiseStationCount: number;
  waterStationCount: number;

  trafficActivityScore: number;
  trafficRisk: number;
  trafficConfidence: number;

  nearestTrafficStop: string | null;
  trafficDistanceKm: number | null;

  nearbyTrafficStopCount: number;
  nearbyPassengerFrequency: number;
  nearbyPassengersIn: number;
  nearbyPassengersOut: number;

  // Machine Learning & Spatial Kriging Active Learning Metrics
  krigingUncertainty?: number;
  informationGainScore?: number;
  surrogateRiskScore?: number;
  mlConfidence?: number;
  mlModelUsed?: string;
  mlPredictedPm25?: number | null;
  mlPredictedNo2?: number | null;
  receptorsProtected?: number;
  anchorCategory?: string;
  anchorCategoryLabel?: string;
  placementRationale?: string;
}