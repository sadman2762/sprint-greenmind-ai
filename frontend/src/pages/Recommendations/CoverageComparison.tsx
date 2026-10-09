import { useEffect, useState } from "react";
import { Alert, Box, Button, LinearProgress, Stack, Typography } from "@mui/material";
import type { JointPlan, JointPlanRequest } from "../../services/jointPlanService";

type Metric = { coveredKm2: number; coveragePercent: number };
type Comparison = { installed: Metric; chosen: Metric; areaKm2: number };
export default function CoverageComparison({ simulation, plan, before, onBeforeChange }: { simulation: JointPlanRequest["existingSimulation"]; plan: JointPlan | null; before: boolean; onBeforeChange: (value: boolean) => void }) {
  const [data, setData] = useState<Comparison | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const payload = JSON.stringify(simulation);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/plans/coverage", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ existingSimulation: JSON.parse(payload) }), signal: controller.signal })
      .then(async response => { if (!response.ok) throw new Error(); return response.json() as Promise<Comparison>; })
      .then(value => { if (!controller.signal.aborted) setData(value); })
      .catch(() => { if (!controller.signal.aborted) setError(true); });
    return () => controller.abort();
  }, [payload, attempt]);
  if (error) return <Alert severity="error" action={<Button onClick={() => { setError(false); setAttempt(attempt + 1); }}>Retry</Button>}>Could not calculate before/after coverage.</Alert>;
  if (!data) return <LinearProgress aria-label="Calculating before and after coverage" />;
  const after = plan?.jointPlan.metrics ?? data.chosen;
  const gain = after.coveredKm2 - data.installed.coveredKm2;
  return <Box>
    <Typography component="h2" variant="subtitle2" sx={{ mb: 1.5 }}>Network coverage</Typography>
    <Stack direction="row" sx={{ gap: 1 }} aria-label="Before and after coverage">
      {[{ label: "Before", metric: data.installed, value: true, color: "#7b8982" }, { label: "After", metric: after, value: false, color: "#176650" }].map(item => <Button key={item.label} aria-label={item.value ? "Before · installed only" : "After · chosen + suggested"} aria-pressed={before === item.value} onClick={() => onBeforeChange(item.value)} sx={{ flex: 1, p: 1.25, textAlign: "left", border: 1, borderColor: before === item.value ? "primary.main" : "divider", bgcolor: before === item.value ? "#f0f6f2" : "transparent", color: "text.primary" }}>
        <Box sx={{ width: "100%" }}><Typography variant="caption" color="text.secondary">{item.label}</Typography><Typography sx={{ fontSize: 25, fontWeight: 650, letterSpacing: "-1px", fontVariantNumeric: "tabular-nums", my: 0.25 }}>{item.metric.coveragePercent.toFixed(1)}<Box component="span" sx={{ fontSize: 15, ml: 0.25 }}>%</Box></Typography>
          <Box sx={{ height: 3, bgcolor: "#e4eae5", borderRadius: 1 }}><Box sx={{ width: `${item.metric.coveragePercent}%`, height: "100%", bgcolor: item.color, borderRadius: 1 }} /></Box>
        </Box>
      </Button>)}
    </Stack>
    <Typography variant="body2" sx={{ mt: 1.5, color: "primary.main", fontWeight: 650 }}>+{gain.toFixed(2)} km² <Box component="span" sx={{ color: "text.secondary", fontWeight: 400 }}>additional coverage</Box></Typography>
    {plan && simulation.some(s => s.category === "air") && <Typography variant="caption" color="text.secondary">This suggestion adds {plan.jointPlan.metrics.addedKm2.toFixed(2)} km² beyond your chosen locations.</Typography>}
    <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1, fontSize: 10, lineHeight: 1.6 }}>{before ? "Showing installed sensors only." : "Showing chosen and suggested locations."} Estimated over {data.areaKm2.toFixed(1)} km² with a 2 km reach.</Typography>
  </Box>;
}
