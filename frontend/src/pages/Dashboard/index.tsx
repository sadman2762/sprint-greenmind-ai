import { useEffect, useMemo, useState } from "react";
import { Alert, Box, Button, Grid, LinearProgress, Stack, Typography } from "@mui/material";
import { Air, VolumeUp, WaterDrop } from "@mui/icons-material";
import CitizenHealthHero from "../../components/dashboard/CitizenHealthHero";
import VitalSignCard from "../../components/dashboard/VitalSignCard";
import DashboardCharts from "../../components/dashboard/DashboardCharts";
import CitizenGlossaryDialog from "../../components/dashboard/CitizenGlossaryDialog";
import { getStations } from "../../services/stationService";
import { getAiCityAnalytics, type AiCityAnalyticsResponse } from "../../services/aiAnalyticsService";
import { calculateCoverageMetrics } from "../../utils/calculateCoverageMetrics";
import { getDashboardMetrics, measurement } from "../../utils/dashboardMetrics";
import type { Station } from "../../types/station";

interface DashboardData {
  stations: Station[];
  analytics: AiCityAnalyticsResponse | null;
  stationsAvailable: boolean;
  errors: string[];
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [glossaryOpen, setGlossaryOpen] = useState(false);
  const loading = data === null;

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      const [stations, analytics] = await Promise.allSettled([
        getStations(controller.signal), getAiCityAnalytics(controller.signal),
      ]);
      if (controller.signal.aborted) return;
      setData({
        stations: stations.status === "fulfilled" ? stations.value : [],
        analytics: analytics.status === "fulfilled" ? analytics.value : null,
        stationsAvailable: stations.status === "fulfilled",
        errors: [
          ...(stations.status === "rejected" ? ["Station readings could not be loaded."] : []),
          ...(analytics.status === "rejected" ? ["Environmental summaries and district estimates could not be loaded."] : []),
        ],
      });
    }
    void load();
    return () => controller.abort();
  }, [attempt]);

  const metrics = useMemo(() => getDashboardMetrics(data?.stations ?? [], data?.analytics ?? null), [data]);
  const coverage = useMemo(() => data?.stationsAvailable ? calculateCoverageMetrics(data.stations).coveragePercentage : null, [data]);
  const cards = [
    { category: "Air quality", icon: <Air />, value: metrics.averagePm25, unit: "µg/m³", detail: `PM2.5 · ${metrics.readingCount} valid station readings`, color: "#38785b", bg: "#edf5ef" },
    { category: "Urban acoustics", icon: <VolumeUp />, value: metrics.daytimeNoise, unit: "dB", detail: `Daytime summary · Night: ${measurement(metrics.nighttimeNoise, "dB")}`, color: "#7c3aed", bg: "#f5f3ff" },
    { category: "Groundwater", icon: <WaterDrop />, value: metrics.temperature, unit: "°C", detail: "Temperature summary · Does not establish water quality", color: "#2563eb", bg: "#eff6ff" },
  ];

  return (
    <Box sx={{ pb: 4, minWidth: 0 }}>
      <CitizenHealthHero healthScore={metrics.healthScore} loading={loading} onOpenGlossary={() => setGlossaryOpen(true)} />
      {loading && <Box role="status" sx={{ mb: 3 }}><Typography variant="body2" sx={{ mb: 1 }}>Loading dashboard data…</Typography><LinearProgress aria-label="Loading dashboard data" /></Box>}
      {data && data.errors.length > 0 && <Alert severity={data.errors.length === 2 ? "error" : "warning"} sx={{ mb: 3 }} action={<Button color="inherit" onClick={() => { setData(null); setAttempt((value) => value + 1); }}>Retry</Button>}>{data.errors.join(" ")}</Alert>}
      {data?.stationsAvailable && data.stations.length === 0 && <Alert severity="info" sx={{ mb: 3 }}>The station feed returned no stations.</Alert>}
      <Grid container spacing={2.5}>
        {cards.map((card) => <Grid key={card.category} size={{ xs: 12, md: 4 }}>
          <VitalSignCard category={card.category} icon={card.icon}
            statusBadge={{ label: loading ? "Loading" : card.value === null ? "No data" : card.category === "Air quality" ? "Station mean" : "Dataset summary", color: card.color, bg: card.bg }}
            humanValue={loading ? "—" : measurement(card.value, card.unit)} technicalValue={card.detail}
            onInfoClick={() => setGlossaryOpen(true)} />
        </Grid>)}
      </Grid>
      <Stack spacing={0.5} sx={{ mt: 2 }}>
        <Typography variant="caption" color="text.secondary">Observation periods vary by source and are not supplied for all summaries. A dashboard refresh does not imply a new observation.</Typography>
        <Typography variant="caption" color="text.secondary">Noise, groundwater and model outputs come from the analytics service, which can include assumed values. They require source validation before operational decisions.</Typography>
      </Stack>
      <DashboardCharts districtProfiles={data?.analytics?.districtProfiles} coveragePercentage={coverage} loading={loading} />
      <CitizenGlossaryDialog open={glossaryOpen} onClose={() => setGlossaryOpen(false)} />
    </Box>
  );
}
