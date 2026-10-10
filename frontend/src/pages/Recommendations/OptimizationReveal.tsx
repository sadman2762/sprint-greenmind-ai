import { Box, Button, IconButton, Slider, Stack, Typography } from "@mui/material";
import PlayArrowRoundedIcon from "@mui/icons-material/PlayArrowRounded";
import PauseRoundedIcon from "@mui/icons-material/PauseRounded";
import ReplayRoundedIcon from "@mui/icons-material/ReplayRounded";
import type { JointPlan } from "../../services/jointPlanService";

export default function OptimizationReveal({ plan, step, playing, onPlay, onPause, onSelect, onCompare }: {
  plan: JointPlan; step: number; playing: boolean; onPlay: () => void; onPause: () => void; onSelect: (step: number) => void; onCompare: () => void;
}) {
  const current = plan.steps[step - 1];
  const complete = step === plan.steps.length;
  const metrics = current?.cumulative ?? plan.existingMetrics;
  return <Box component="section" aria-label="Optimization playback" className="optimization-reveal">
    <Stack direction="row" sx={{ alignItems: "center", gap: 1, mb: 1.5 }}>
      <Box className={playing ? "reveal-status is-playing" : "reveal-status"} />
      <Typography variant="overline" sx={{ flex: 1, fontSize: 10, letterSpacing: ".13em", fontWeight: 700 }}>{plan.userAdjusted ? "Proposal walkthrough" : "Greedy optimization"}</Typography>
      <Typography variant="caption" color="text.secondary">{step} / {plan.steps.length}</Typography>
      <IconButton size="small" aria-label={playing ? "Pause sensor reveal" : complete ? "Replay sensor reveal" : "Play sensor reveal"} onClick={playing ? onPause : onPlay}>
        {playing ? <PauseRoundedIcon /> : complete ? <ReplayRoundedIcon /> : <PlayArrowRoundedIcon />}
      </IconButton>
    </Stack>
    <Box className="reveal-details" aria-live="polite" aria-atomic="true">
      <Typography component="h2" sx={{ fontSize: 20, fontWeight: 650, letterSpacing: "-.6px", lineHeight: 1.25 }}>{current ? complete ? "A wider view of your city." : `Location ${step}. More ground covered.` : "Every gap is an opportunity."}</Typography>
      <Stack direction="row" sx={{ alignItems: "baseline", gap: .75, mt: 1.5 }}>
        <Typography key={step} className="reveal-value" sx={{ fontSize: 39, lineHeight: 1.1, letterSpacing: "-1.8px", fontWeight: 600, color: "primary.main", fontVariantNumeric: "tabular-nums" }}>{metrics.coveragePercent.toFixed(1)}<Box component="span" sx={{ fontSize: 19 }}>%</Box></Typography>
        <Typography variant="caption" color="text.secondary">modeled {plan.planningCategory ?? "air"} coverage</Typography>
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 1, minHeight: 40 }}>{current ? <>Location {step} adds <strong style={{ color: "#584388" }}>{current.marginalKm2.toFixed(2)} km²</strong> beyond the preceding network. Overlap counted once.</> : "The existing network, including your chosen locations. Watch each returned proposal close a coverage gap."}</Typography>
    </Box>
    <Slider aria-label="Revealed sensor count" value={step} min={0} max={plan.steps.length} step={1} marks valueLabelDisplay="auto" onChange={(_, value) => onSelect(value as number)} sx={{ mt: .5, mb: 0, color: "#7961b4" }} />
    <Stack className="reveal-footer" direction="row" sx={{ justifyContent: "space-between", alignItems: "center" }}>
      <Typography variant="caption" color="text.secondary">Current network → proposed network</Typography>
      {complete && <Button size="small" onClick={onCompare} sx={{ minWidth: 0 }}>Compare</Button>}
    </Stack>
  </Box>;
}
