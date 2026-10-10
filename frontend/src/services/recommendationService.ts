import type { Station } from "../types/station";
import type { SensorRecommendation } from "../types/recommendation";

interface RecommendationApiResponse {
  count: number;
  simulatedStationCount: number;
  source: string;
  recommendations: SensorRecommendation[];
}

const BASE_URL = "/api/recommendations";

export async function getRecommendations(
  simulatedStations: Station[] = [],
): Promise<SensorRecommendation[]> {
  const hasSimulation = simulatedStations.length > 0;

  const response = await fetch(
    hasSimulation ? `${BASE_URL}/simulate` : `${BASE_URL}/`,
    hasSimulation
      ? {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            simulatedStations,
          }),
        }
      : undefined,
  );

  if (!response.ok) {
    throw new Error(
      `Failed to load recommendations: ${response.status} ${response.statusText}`,
    );
  }

  const data: RecommendationApiResponse = await response.json();

  return data.recommendations;
}

export async function optimizeBudget(
  budget: number,
  strategy: string,
  simulatedStations: Station[] = [],
  constraints?: import("../types/budget").OptimizationConstraints,
): Promise<import("../types/budget").BudgetOptimizationResult> {
  const response = await fetch(`${BASE_URL}/optimize-budget`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      budget,
      strategy,
      simulatedStations,
      min_reference: constraints?.minReference ?? 0,
      min_micro: constraints?.minMicro ?? 0,
      max_annual_om: constraints?.maxAnnualOm ?? null,
      include_five_year_tco: constraints?.includeFiveYearTco ?? false,
      custom_tier_specs: constraints?.customTierSpecs ?? null,
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Failed to optimize budget: ${response.status} ${response.statusText}`,
    );
  }

  return response.json();
}
