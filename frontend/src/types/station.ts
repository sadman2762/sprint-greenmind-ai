export interface Station {
  id: number;

  name: string;

  lat: number;
  lng: number;

  station_type: number;
  scenarioRadiusKm?: number;
  sensorTier?: "air" | "water" | "noise";
  daytimeNoise?: number | null;
  nighttimeNoise?: number | null;
  periodStart?: string;
  periodEnd?: string;

  stationCode?: string;
  location?: string;
  timestamp?: string;

  pm25?: number | null;
  pm10?: number | null;
  no2?: number | null;
  o3?: number | null;
  co?: number | null;
  co2?: number | null;

  humidity?: number | null;
  pressure?: number | null;

  windSpeed?: number | null;
  windDirection?: number | null;
}