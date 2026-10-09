export interface PlanStation {
  radiusKm?: number;
  id: string; name: string; lat: number; lng: number; category: "air" | "noise";
  hardwareGrade: string; estimatedPm25: number | null;
  estimatedNightNoise?: number | null;
  originalPriorityScore?: number | null;
  independentWeightedGain: number; independentAddedKm2: number;
}
export interface PlanMetrics {
  coveredKm2: number; coveragePercent: number; addedKm2: number; weightedGain: number;
}
export interface JointPlan {
  userAdjusted?: boolean;
  rangeSettings?: { newSensorRadiusKm?: number; coverageRadiiKm: Record<"air" | "water" | "noise", number>; sensorRadiusOverridesKm: Record<string, number> };
  planningCategory?: "air" | "noise";
  schemaVersion: string; datasetVersion: string; objectiveVersion: string; method: string;
  studyArea: { name: string; areaKm2: number; gridPoints: number; radiusKm: number; distanceModel: string };
  assumptions: string[]; warnings: string[];
  existingStations: { id: string; name: string; lat: number; lng: number }[];
  existingMetrics: PlanMetrics;
  originalPlan: {
    status: "available" | "partial" | "unavailable";
    source: { repository: string; commit: string; file: string; sha256: string };
    method: string; stations: PlanStation[]; metrics: PlanMetrics | null;
    steps: { station: PlanStation; marginalKm2: number; marginalWeightedGain: number }[];
    warnings: string[]; constraintViolations: string[];
  };
  originalComparison: string;
  baselineRanking: PlanStation[];
  independentPlan: { stations: PlanStation[]; metrics: PlanMetrics; constraintViolations: string[] };
  jointPlan: { stations: PlanStation[]; metrics: PlanMetrics };
  steps: { station: PlanStation; marginalKm2: number; marginalWeightedGain: number; overlapFraction: number;
    recalculation?: { station: PlanStation; beforeKm2: number; afterKm2: number;
      beforeWeightedGain: number; afterWeightedGain: number; excludedBySeparation: boolean } | null;
    cumulative: PlanMetrics; updatedRanking: (PlanStation & { marginalWeightedGain: number })[]; explanation: string }[];
  tradeoff: string; benchmark: { method: string; metrics: PlanMetrics | null }; candidateCount: number; elapsedMs: number;
}
export interface JointPlanRequest {
  newSensorRadiusKm?: number;
  coverageRadiiKm?: Record<"air" | "water" | "noise", number>;
  sensorRadiusOverridesKm?: Record<string, number>;
  planningCategory?: "air" | "noise";
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
  const plan = await response.json() as JointPlan;
  if (!plan.originalPlan) throw new Error("The planning service needs to be restarted to load the Original comparison.");
  return plan;
}

export interface DraftEvaluation {
  schemaVersion: string;
  stations: PlanStation[];
  steps: JointPlan["steps"];
  metrics: PlanMetrics;
  existingMetrics: PlanMetrics;
  warnings: string[];
}
export async function evaluateDraft(request: JointPlanRequest, stations: PlanStation[], signal: AbortSignal): Promise<DraftEvaluation> {
  const response = await fetch("/api/plans/evaluate", { method: "POST", headers: { "Content-Type": "application/json" }, signal,
    body: JSON.stringify({ ...request, proposedStations: stations.map(s => ({ id: s.id, name: s.name, lat: s.lat, lng: s.lng, category: s.category, radiusKm: s.radiusKm, hardwareGrade: "unspecified" })) }),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(typeof error.detail === "string" ? error.detail : "Could not recalculate this move. The previous proposal was kept.");
  }
  return response.json();
}
