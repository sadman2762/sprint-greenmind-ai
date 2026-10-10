export type ConditionCategory = "air" | "water" | "noise";

export interface ConditionPoint {
  date: string;
  value: number | null;
  stationCount: number;
  recordCount: number;
}

export interface ConditionMetric {
  key: string;
  label: string;
  unit: string;
  stationCount: number;
  recordCount: number;
  periodStart: string | null;
  periodEnd: string | null;
  points: ConditionPoint[];
}

export interface ConditionDataset {
  status: "available" | "empty" | "unavailable";
  message: string | null;
  sourceFile: string;
  description: string;
  metrics: ConditionMetric[];
}

export interface EnvironmentalConditions {
  schemaVersion: string;
  source: string;
  aggregation: string;
  categories: Record<ConditionCategory, ConditionDataset>;
}

export async function getEnvironmentalConditions(signal: AbortSignal): Promise<EnvironmentalConditions> {
  const response = await fetch("/api/official-dataset/conditions", { signal });
  if (!response.ok) throw new Error("Could not load environmental measurements.");
  const data: EnvironmentalConditions = await response.json();
  if (data.schemaVersion !== "1.0" || !["air", "water", "noise"].every(category =>
    Array.isArray(data.categories?.[category as ConditionCategory]?.metrics))) {
    throw new Error("The environmental summary response is unavailable.");
  }
  return data;
}
