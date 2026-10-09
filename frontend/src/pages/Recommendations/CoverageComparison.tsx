import { useEffect, useState } from "react";
import { Alert, Box, Button, Card, LinearProgress, Stack, Typography } from "@mui/material";
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
  return <Card variant="outlined" sx={{ p: 1.5 }}>
    <Stack direction={{ xs: "column", sm: "row" }} sx={{ gap: 1.5, alignItems: { sm: "center" } }}>
      <Stack direction="row" sx={{ gap: 1, flex: 1 }} aria-label="Before and after coverage">
        {[{ label: "Before", detail: "Installed sensors", metric: data.installed, value: true, color: "#64748b" }, { label: "After", detail: `${simulation.filter(s => s.category === "air").length} chosen${plan ? ` + ${plan.steps.length} suggested` : ""}`, metric: after, value: false, color: "#6d28d9" }].map(item => <Button key={item.label} aria-label={item.value ? "Before · installed only" : "After · chosen + suggested"} aria-pressed={before === item.value} onClick={() => onBeforeChange(item.value)} variant={before === item.value ? "outlined" : "text"} sx={{ flex: 1, justifyContent: "flex-start", textTransform: "none", px: 1.5, py: 1, borderColor: item.color, bgcolor: before === item.value ? "action.hover" : undefined }}>
          <Box sx={{ width: "100%", textAlign: "left" }}><Stack direction="row" sx={{ alignItems: "baseline", justifyContent: "space-between", gap: 1 }}><Typography variant="body2">{item.label}</Typography><Typography component="span" variant="h5" sx={{ fontWeight: 600 }}>{item.metric.coveragePercent.toFixed(1)}%</Typography></Stack>
            <Box sx={{ mt: 0.5, height: 5, bgcolor: "action.hover", borderRadius: 1 }}><Box sx={{ width: `${item.metric.coveragePercent}%`, height: "100%", bgcolor: item.color, borderRadius: 1 }} /></Box>
            <Typography component="span" variant="caption" color="text.secondary">{item.detail} · {item.metric.coveredKm2.toFixed(1)} km²</Typography>
          </Box>
        </Button>)}
      </Stack>
      <Box sx={{ px: 1.5 }}><Typography variant="h6">+{gain.toFixed(2)} km²</Typography><Typography variant="caption" color="text.secondary">extra area · +{(after.coveragePercent - data.installed.coveragePercent).toFixed(1)} points</Typography></Box>
    </Stack>
    <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5, px: 1.5 }}>Map showing {before ? "installed sensors" : "chosen + suggested locations"} · Estimated air coverage over {data.areaKm2.toFixed(1)} km²</Typography>
  </Card>;
}
