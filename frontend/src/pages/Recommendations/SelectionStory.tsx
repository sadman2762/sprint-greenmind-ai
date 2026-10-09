import { Box, Button, Stack, Typography } from "@mui/material";
import type { JointPlan } from "../../services/jointPlanService";

export function SelectionSteps({ plan, step, onSelect }: { plan: JointPlan; step: number; onSelect: (step: number) => void }) {
  return <Stack direction="row" role="group" aria-label="Build the network step by step" sx={{ gap: 0.75, alignItems: "center", flexWrap: "wrap" }}>
    <Typography variant="caption" color="text.secondary" sx={{ mr: 0.5 }}>Build the plan</Typography>
    {[0, ...plan.steps.map((_, i) => i + 1)].map(index => <Button key={index} size="small" aria-pressed={step === index} variant={step === index ? "contained" : "outlined"} onClick={() => onSelect(index)} sx={{ minWidth: 44 }}>
      {index === 0 ? "Start" : `+ ${index}`}
    </Button>)}
  </Stack>;
}

export default function SelectionStory({ plan, step, onShowAlternative }: { plan: JointPlan; step: number; onShowAlternative: (lat: number, lng: number) => void }) {
  const current = plan.steps[step - 1];
  const alternative = current?.recalculation;
  const next = plan.steps[step];
  return <Box component="section" aria-label="Why these locations" sx={{ mt: 2, p: 1.5, bgcolor: "#f5f3ff", borderRadius: 2, border: "1px solid #e9e2fa" }}>
    {plan.userAdjusted && <Typography variant="caption" color="text.secondary">Your edited locations · evaluated in this order</Typography>}
    <Typography component="h2" variant="subtitle2">{current ? `What location ${step} adds` : "Start with the current network"}</Typography>
    {current ? <>
      <Stack direction="row" sx={{ gap: 2, my: 1.25 }}>
        <Box><Typography sx={{ fontSize: 24, fontWeight: 650, color: "#6d28d9" }}>+{current.marginalKm2.toFixed(2)} <Box component="span" sx={{ fontSize: 12 }}>km²</Box></Typography><Typography variant="caption">new area</Typography></Box>
        <Box><Typography sx={{ fontSize: 24, fontWeight: 650 }}>{(current.overlapFraction * 100).toFixed(1)}<Box component="span" sx={{ fontSize: 12 }}>%</Box></Typography><Typography variant="caption">already covered</Typography></Box>
      </Stack>
      <Typography variant="body2">{current.cumulative.addedKm2.toFixed(2)} km² added by {step > 1 ? `locations 1–${step} together` : "location 1"}. Overlap counts only once.</Typography>
      {alternative && <Box sx={{ mt: 1.5, pt: 1.5, borderTop: "1px solid #e0d9ed" }}>
        <Typography variant="subtitle2">What changed after this placement?</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>The next-highest option before this placement could add {alternative.beforeKm2.toFixed(2)} km². After this placement, it would add {alternative.afterKm2.toFixed(2)} km².{Math.abs(alternative.beforeKm2 - alternative.afterKm2) < 0.005 ? " Its extra reach is unchanged at this precision." : " The lost benefit is area the new sensor now covers."}{alternative.excludedBySeparation ? " It is also too close to the new location to meet your spacing rule." : ""}</Typography>
        <Button size="small" onClick={() => onShowAlternative(alternative.station.lat, alternative.station.lng)} sx={{ px: 0, mt: 0.5 }}>Locate this alternative</Button>
      </Box>}
      <Typography variant="body2" sx={{ mt: 1.25 }}>{next ? `After recalculation, location ${step + 1} adds ${next.marginalKm2.toFixed(2)} km². Select + ${step + 1} above the map to see it.` : "This is the complete suggestion. Review the locations in your basket before applying them."}</Typography>
    </> : <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>{plan.planningCategory === "noise" ? "Historical noise sites and chosen noise sensors" : "Installed and already chosen air sensors"} cover {plan.existingMetrics.coveragePercent.toFixed(1)}% of the study area. Select + 1 above the map to see the first addition.</Typography>}
  </Box>;
}
