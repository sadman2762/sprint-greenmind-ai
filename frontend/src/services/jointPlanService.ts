export interface PlanStation {
  id: string; name: string; lat: number; lng: number; category: "air";
  hardwareGrade: string; estimatedPm25: number | null;
  independentWeightedGain: number; independentAddedKm2: number;
}
export interface PlanMetrics {
  coveredKm2: number; coveragePercent: number; addedKm2: number; weightedGain: number;
}
export interface JointPlan {
  schemaVersion: string; datasetVersion: string; objectiveVersion: string; method: string;
  studyArea: { name: string; areaKm2: number; gridPoints: number; radiusKm: number; distanceModel: string };
  assumptions: string[]; warnings: string[];
  existingStations: { id: string; name: string; lat: number; lng: number }[];
  existingMetrics: PlanMetrics;
  baselineRanking: PlanStation[];
  independentPlan: { stations: PlanStation[]; metrics: PlanMetrics; constraintViolations: string[] };
  jointPlan: { stations: PlanStation[]; metrics: PlanMetrics };
  steps: { station: PlanStation; marginalKm2: number; marginalWeightedGain: number; overlapFraction: number;
    cumulative: PlanMetrics; updatedRanking: (PlanStation & { marginalWeightedGain: number })[]; explanation: string }[];
  tradeoff: string; benchmark: { method: string; metrics: PlanMetrics | null }; candidateCount: number; elapsedMs: number;
}
export interface JointPlanRequest {
  stationCount: 1 | 2 | 3; environmentalWeight: number; minSeparationKm: number;
  existingSimulation: { id: string; name: string; lat: number; lng: number; category: "air" | "noise" | "water"; hardwareGrade: "unspecified" }[];
}
export async function getJointPlan(request: JointPlanRequest, signal: AbortSignal): Promise<JointPlan> {
  const response = await fetch("/api/plans/joint", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(request), signal });
  if (!response.ok) {
    if (response.status >= 500) throw new Error("The planning service is unavailable. Check that the local backend is running, then retry.");
    const error = await response.json().catch(() => ({}));
    throw new Error(typeof error.detail === "string" ? error.detail : `Planning request failed (${response.status}). Check the inputs and retry.`);
  }
  return response.json();
}
