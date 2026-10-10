import type { ConditionMetric, EnvironmentalConditions } from "../src/services/environmentalConditionsService.ts";

function metric(key: string, label: string, unit: string, values: (number | null)[]): ConditionMetric {
  return {
    key, label, unit, stationCount: 2, recordCount: 4, periodStart: "2026-05-21", periodEnd: "2026-05-23",
    points: values.map((value, index) => ({ date: `2026-05-${21 + index}`, value, stationCount: value === null ? 0 : 2, recordCount: value === null ? 0 : 2 })),
  };
}

export const environmentalFixture: EnvironmentalConditions = {
  schemaVersion: "1.0",
  source: "Synthetic historical test fixture; not live telemetry.",
  aggregation: "Each reporting site has equal weight after daily aggregation. Missing days remain gaps; site counts can change. Noise is averaged in sound energy, then converted back to dB.",
  categories: {
    air: { status: "available", message: null, sourceFile: "synthetic-air.csv", description: "Daily PM2.5 across reporting sites, not a city-wide exposure estimate or an AQI.", metrics: [metric("pm25", "PM2.5", "µg/m³", [10, null, 0])] },
    water: { status: "available", message: null, sourceFile: "synthetic-water.csv", description: "Historical water measurements, not a drinking-water safety assessment.", metrics: [metric("conductivity", "Conductivity", "mS/cm", [1.1, null, 1.3]), metric("waterTemperature", "Water temperature", "°C", [12, null, 14]), metric("waterLevel", "Water level", "m", [7, null, 8])] },
    noise: { status: "available", message: null, sourceFile: "synthetic-noise.csv", description: "Separate daytime and nighttime sound-energy averages across reporting sites.", metrics: [metric("daytimeNoise", "Daytime", "dB", [50, null, 55]), metric("nighttimeNoise", "Nighttime", "dB", [40, null, 42])] },
  },
};
