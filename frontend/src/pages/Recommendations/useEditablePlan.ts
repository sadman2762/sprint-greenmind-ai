import { useEffect, useMemo, useRef, useState } from "react";
import { evaluateDraft, type DraftEvaluation, type JointPlan, type JointPlanRequest } from "../../services/jointPlanService";

export function useEditablePlan(source: JointPlan | null, inputs: JointPlanRequest) {
  const [receipt, setReceipt] = useState<{ source: JointPlan; result: DraftEvaluation } | null>(null);
  const [pending, setPending] = useState<JointPlan | null>(null);
  const [failure, setFailure] = useState<{ source: JointPlan; message: string } | null>(null);
  const controller = useRef<AbortController | null>(null);
  const inputKey = JSON.stringify(inputs);
  useEffect(() => () => { controller.current?.abort(); setPending(null); }, [source, inputKey]);
  const plan = useMemo(() => {
    if (!source || receipt?.source !== source) return source;
    const result = receipt.result;
    return { ...source, userAdjusted: true, steps: result.steps, existingMetrics: result.existingMetrics,
      jointPlan: { stations: result.stations, metrics: result.metrics }, baselineRanking: [],
      method: "User-adjusted proposal evaluated in the displayed order. No new optimization was performed.",
      warnings: result.warnings, originalComparison: "The proposal was adjusted manually; original optimizer comparisons are no longer shown.",
      tradeoff: "The area and overlap above describe your edited locations. The previous candidate ranking no longer describes these coordinates.",
      benchmark: { method: "No optimality benchmark for manually edited coordinates.", metrics: null },
    } satisfies JointPlan;
  }, [source, receipt]);
  async function move(index: number, lat: number, lng: number, signal?: AbortSignal) {
    if (!source || !plan) return false;
    controller.current?.abort();
    const next = new AbortController(); controller.current = next;
    const cancel = () => next.abort();
    signal?.addEventListener("abort", cancel, { once: true });
    setPending(source); setFailure(null);
    try {
      const stations = plan.jointPlan.stations.map((station, i) => ({ ...station,
        ...(i === index ? { lat, lng, name: `Adjusted location ${i + 1}` } : {}), radiusKm: station.radiusKm ?? source.studyArea.radiusKm,
      }));
      const result = await evaluateDraft(inputs, stations, next.signal);
      if (next.signal.aborted) return false;
      setReceipt({ source, result });
      return true;
    } catch (error) {
      if (!next.signal.aborted) setFailure({ source, message: error instanceof Error ? error.message : "Could not recalculate the move." });
      return false;
    } finally { signal?.removeEventListener("abort", cancel); if (!next.signal.aborted || signal?.aborted) setPending(null); }
  }
  return { plan, editing: !!source && pending === source, editError: failure?.source === source ? failure?.message : "", move };
}
