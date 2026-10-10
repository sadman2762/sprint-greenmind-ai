import EnvironmentalKpiStrip from "./EnvironmentalKpiStrip";
import { lazy, Suspense, useEffect, useState } from "react";
import { Alert, Box, Button, Collapse, Grid, Skeleton, Stack, Typography, useMediaQuery, useTheme } from "@mui/material";
import { getEnvironmentalConditions, type ConditionCategory, type EnvironmentalConditions } from "../../services/environmentalConditionsService";
const EnvironmentalConditionCard = lazy(() => import("./EnvironmentalConditionCard"));

const categories: ConditionCategory[] = ["air", "water", "noise"];

export default function EnvironmentalOverview({ open, onOpen }: { open: boolean; onOpen: () => void }) {
  const theme = useTheme();
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const [data, setData] = useState<EnvironmentalConditions | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    getEnvironmentalConditions(controller.signal).then(result => {
      if (!controller.signal.aborted) setData(result);
    }).catch(() => {
      if (!controller.signal.aborted) setError("Environmental measurements could not be loaded. The planner is still available.");
    });
    return () => controller.abort();
  }, [attempt]);
  function refresh() {
    setData(null); setError(""); setAttempt(value => value + 1);
  }
  return <>
    {!open && <EnvironmentalKpiStrip data={data} error={error} onOpen={onOpen} />}
    <Collapse mountOnEnter in={open} timeout={reducedMotion ? 0 : theme.transitions.duration.standard} sx={{ flexShrink: 0 }}>
    <Box component="section" id="environmental-overview" aria-labelledby="environmental-overview-title" sx={{ px: { xs: 2, md: 3 }, py: 2, maxHeight: "48dvh", overflowY: "auto", bgcolor: "background.default", borderBottom: 1, borderColor: "divider" }}>
      <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", gap: 1, mb: 1 }}>
        <Box>
          <Typography component="h2" variant="h6" id="environmental-overview-title">Environmental overview</Typography>
          <Typography variant="caption" color="text.secondary">Historical measurements at monitored sites · Not live city-wide conditions</Typography>
        </Box>
        <Button size="small" onClick={refresh} disabled={!data && !error}>{error ? "Retry charts" : "Refresh"}</Button>
      </Stack>
      {error ? <Alert severity="error">{error}</Alert> : !data ? <Box role="status" aria-label="Loading environmental charts">
        <Typography variant="body2" sx={{ mb: 1 }}>Loading environmental charts…</Typography>
        <Grid container spacing={2}>{categories.map(category => <Grid key={category} size={{ xs: 12, md: 4 }}><Skeleton variant="rounded" animation={reducedMotion ? false : "pulse"} height={theme.spacing(28)} /></Grid>)}</Grid>
      </Box> : <>
        <Grid container spacing={2}>{categories.map(category => <Grid key={category} size={{ xs: 12, md: 4 }} sx={{ minWidth: 0 }}>
          <Suspense fallback={<Skeleton variant="rounded" height={240} />}><EnvironmentalConditionCard category={category} dataset={data.categories[category]} /></Suspense>
        </Grid>)}</Grid>
        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: "block" }}>{data.aggregation}</Typography>
      </>}
    </Box>
  </Collapse></>;
}
