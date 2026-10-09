import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Box, Button, Card, Chip, Grid, LinearProgress, Slider, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, ToggleButton, ToggleButtonGroup, Typography } from "@mui/material";
import { Circle, Marker, Tooltip } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useSimulation } from "../../context/SimulationContext";
import { getJointPlan, type JointPlan, type PlanMetrics, type PlanStation } from "../../services/jointPlanService";
import type { Station } from "../../types/station";
import { getStationCategory } from "../../utils/mapLegend";
import LocationBasket from "./LocationBasket";
import CoverageComparison from "./CoverageComparison";
import CityMap from "../../components/map/CityMap";

function MetricCard({ title, metrics, color }: { title: string; metrics: PlanMetrics; color: string }) {
  return <Card variant="outlined" sx={{ p: 2, height: "100%", borderTop: `3px solid ${color}` }}>
    <Typography variant="subtitle2">{title}</Typography>
    <Typography variant="h5" sx={{ mt: 0.5, fontVariantNumeric: "tabular-nums" }}>{metrics.coveragePercent.toFixed(1)}%</Typography>
    <Typography variant="body2" color="text.secondary">modeled air coverage · {metrics.coveredKm2.toFixed(2)} km²</Typography>
    <Typography variant="body2" sx={{ mt: 1 }}>+{metrics.addedKm2.toFixed(2)} km² · {metrics.weightedGain.toFixed(2)} weighted gain</Typography>
  </Card>;
}

function downloadBrief(plan: JointPlan) {
  const content = [
    "# GreenMind AI — recommended sensor locations", "",
    `Add ${plan.steps.length} air sensors to reach ${plan.jointPlan.metrics.addedKm2.toFixed(2)} km² more.`,
    `Estimated coverage: ${plan.existingMetrics.coveragePercent.toFixed(1)}% with current chosen locations → ${plan.jointPlan.metrics.coveragePercent.toFixed(1)}% with the new sensors.`, "",
    ...plan.steps.map((s, i) => `- Location ${i + 1}: ${s.station.lat.toFixed(4)}, ${s.station.lng.toFixed(4)}. Adds ${s.marginalKm2.toFixed(2)} km² beyond the existing sensors and earlier locations in this list.`),
    "", "Planning estimate based on a 2 km reach per air sensor. Installation costs and site access still need checking.",
    "", "## Case-study evaluation", "",
    `Dataset: ${plan.datasetVersion} · Objective: ${plan.objectiveVersion}`, plan.method, "",
    `Existing coverage: ${plan.existingMetrics.coveragePercent.toFixed(2)}%`,
    `Independent plan: +${plan.independentPlan.metrics.addedKm2.toFixed(2)} km²; weighted gain ${plan.independentPlan.metrics.weightedGain.toFixed(2)}`,
    `Joint plan: +${plan.jointPlan.metrics.addedKm2.toFixed(2)} km²; weighted gain ${plan.jointPlan.metrics.weightedGain.toFixed(2)}`, "",
    ...plan.steps.map((s, i) => `${i + 1}. ${s.station.id} (${s.station.lat}, ${s.station.lng}): +${s.marginalKm2.toFixed(2)} km², weighted gain ${s.marginalWeightedGain.toFixed(2)}, overlap ${(s.overlapFraction * 100).toFixed(1)}%.`),
    "", plan.tradeoff, "", "## Assumptions and limitations", ...plan.assumptions.map((x) => `- ${x}`), ...plan.warnings.map((x) => `- ${x}`),
    "", plan.benchmark.method, `Runtime: ${plan.elapsedMs} ms for ${plan.candidateCount} candidates.`,
  ].join("\n");
  const url = URL.createObjectURL(new Blob([content], { type: "text/markdown" }));
  const anchor = document.createElement("a");
  anchor.href = url; anchor.download = "greenmind-joint-plan.md"; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function JointPlanner() {
  const { simulatedStations } = useSimulation();
  const [stationCount, setStationCount] = useState<1 | 2 | 3>(3);
  const [environmentalWeight, setEnvironmentalWeight] = useState(1);
  const [separation, setSeparation] = useState("1");
  const [basketOpen, setBasketOpen] = useState(false);
  const snapshot = JSON.stringify(simulatedStations.map((s) => [s.id, s.lat, s.lng, s.sensorTier]));
  return <JointPlannerWorkspace key={snapshot} basketOpen={basketOpen} setBasketOpen={setBasketOpen} stationCount={stationCount} setStationCount={setStationCount} environmentalWeight={environmentalWeight} setEnvironmentalWeight={setEnvironmentalWeight} separation={separation} setSeparation={setSeparation} />;
}

interface PlannerSettings {
  basketOpen: boolean; setBasketOpen: (open: boolean) => void;
  stationCount: 1 | 2 | 3; setStationCount: (count: 1 | 2 | 3) => void;
  environmentalWeight: number; setEnvironmentalWeight: (weight: number) => void;
  separation: string; setSeparation: (distance: string) => void;
}
function JointPlannerWorkspace({ basketOpen, setBasketOpen, stationCount, setStationCount, environmentalWeight, setEnvironmentalWeight, separation, setSeparation }: PlannerSettings) {
  const { simulatedStations } = useSimulation();
  const [before, setBefore] = useState(false);
  const [focusLocation, setFocusLocation] = useState<{ lat: number; lng: number; token: number }>();
  const mapRef = useRef<HTMLDivElement>(null);
  const [plan, setPlan] = useState<JointPlan | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(0);
  const [showDetails, setShowDetails] = useState(false);
  const [view, setView] = useState<"joint" | "independent" | "compare">("joint");
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  useEffect(() => { if (focusLocation) mapRef.current?.scrollIntoView({ block: "start" }); }, [focusLocation]);

  function reset() {
    request.current?.abort();
    setPlan(null); setLoading(false); setError(""); setStep(0); setView("joint"); setShowDetails(false);
  }
  async function generate(count: 1 | 2 | 3 = stationCount) {
    setStationCount(count); setBefore(false); setFocusLocation(undefined);
    request.current?.abort();
    const controller = new AbortController(); request.current = controller;
    setLoading(true); setError(""); setPlan(null);
    try {
      const result = await getJointPlan({
        stationCount: count, environmentalWeight, minSeparationKm: Number(separation),
        existingSimulation: simulatedStations.map((s) => ({ id: String(s.id), name: s.name, lat: s.lat, lng: s.lng, category: getStationCategory(s) ?? "air", hardwareGrade: "unspecified" })),
      }, controller.signal);
      if (!controller.signal.aborted) { setPlan(result); setStep(result.steps.length); setView("joint"); setShowDetails(false); }
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Could not generate a plan.");
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }
  const simulation = simulatedStations.map(s => ({ id: String(s.id), name: s.name, lat: s.lat, lng: s.lng, category: getStationCategory(s) ?? "air" as const, hardwareGrade: "unspecified" as const }));
  const current = plan && step > 0 ? plan.steps[step - 1] : null;
  const ranking: (PlanStation & { marginalWeightedGain?: number })[] | undefined = current?.updatedRanking ?? plan?.baselineRanking;
  const invalid = separation.trim() === "" || !Number.isFinite(Number(separation)) || Number(separation) < 0 || Number(separation) > 5;
  const frameStations = useMemo<Station[]>(() => plan ? [...plan.independentPlan.stations, ...plan.jointPlan.stations].map((s, index) => ({ id: -1000 - index, name: s.name, lat: s.lat, lng: s.lng, station_type: 0 })) : [], [plan]);
  const coverageStations = useMemo<Station[]>(() => {
    const selected = !plan || before ? [] : view === "independent" ? plan.independentPlan.stations : plan.jointPlan.stations.slice(0, step);
    return selected.map((s, index) => ({ id: -2000 - index, name: s.name, lat: s.lat, lng: s.lng, station_type: 0 }));
  }, [plan, view, step, before]);
  function stationMarker(station: PlanStation, index: number, baseline: boolean) {
    const color = baseline ? "#b45309" : "#6d28d9";
    const icon = L.divIcon({ className: "joint-plan-marker", html: `<span style="display:grid;place-items:center;width:30px;height:30px;border-radius:50%;background:${color};color:white;border:2px solid white;font-weight:700">${baseline ? "B" : ""}${index + 1}</span>`, iconSize: [30, 30], iconAnchor: [15, 15] });
    return <Marker key={`${baseline}-${station.id}`} position={[station.lat, station.lng]} icon={icon} title={`${baseline ? "Baseline" : "Recommended"} station ${index + 1}`}><Tooltip>{baseline ? "Baseline" : "Recommended"} location {index + 1} · {station.lat.toFixed(4)}, {station.lng.toFixed(4)}</Tooltip></Marker>;
  }
  return <Stack spacing={2} sx={{ pb: 4, minWidth: 0 }}>
    <Box>
      <Typography component="h1" variant="h4">Where to place your next sensors</Typography>
      <Typography color="text.secondary" sx={{ mt: 0.5 }}>More coverage. Fewer overlapping locations.</Typography>
    </Box>
    <Card variant="outlined" sx={{ p: 2 }}>
      <Typography variant="subtitle2" sx={{ mb: 1 }}>Add air sensors</Typography>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
        <Button variant={stationCount === 3 ? "contained" : "outlined"} disabled={invalid || loading} onClick={() => generate(3)}>Suggest 3 together</Button>
        <Button variant={stationCount === 1 ? "contained" : "outlined"} disabled={invalid || loading} onClick={() => generate(1)}>Suggest next 1</Button>
        <Button variant={stationCount === 2 ? "contained" : "outlined"} disabled={invalid || loading} onClick={() => generate(2)}>Suggest 2 together</Button>
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>Suggestions include your chosen locations. Review them in the basket before applying.</Typography>
      <Box component="details" sx={{ mt: 1 }}>
        <Typography component="summary" variant="body2" sx={{ cursor: "pointer", color: "text.secondary" }}>Adjust planning preferences</Typography>
        <Grid container spacing={3} sx={{ mt: 1, alignItems: "center" }}>
          <Grid size={{ xs: 12, sm: 7 }}><Typography variant="subtitle2">Give more priority to areas with higher estimated air pollution</Typography>
            <Slider value={environmentalWeight} min={0} max={3} step={0.25} valueLabelDisplay="auto" aria-label="Environmental importance" onChange={(_, value) => { reset(); setEnvironmentalWeight(value as number); }} />
            <Typography variant="caption" color="text.secondary">At zero, only extra area matters. Moving right gives pollution estimates more influence.</Typography>
          </Grid>
          <Grid size={{ xs: 12, sm: 5 }}><TextField size="small" label="Keep new sensors at least this far apart (km)" type="number" value={separation} error={invalid} helperText={invalid ? "Enter a distance from 0 to 5 km." : "Avoid placing the new sensors too close together."} onChange={(event) => { reset(); setSeparation(event.target.value); }} slotProps={{ htmlInput: { min: 0, max: 5, step: 0.25 } }} fullWidth /></Grid>
        </Grid>
      </Box>
    </Card>
    {loading && <Box role="status"><Typography variant="body2">Finding locations that add coverage without repeating the same area…</Typography><LinearProgress /></Box>}
    {error && <Alert severity="error" action={<Button color="inherit" onClick={() => generate()}>Retry</Button>}>{error}</Alert>}
    <Box ref={mapRef} sx={{ scrollMarginTop: 90 }}>
      <CoverageComparison simulation={simulation} plan={plan} before={before} onBeforeChange={value => { setBefore(value); setView("joint"); if (plan) setStep(plan.steps.length); }} />
    </Box>
    <Box component="section" aria-label="Monitoring map and legend">
      <Card variant="outlined" sx={{ p: 1.5, mb: 1 }}>
        <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 1 }}>
          <Box><Typography component="h2" variant="subtitle1" sx={{ fontWeight: 600 }}>{plan ? `${plan.steps.length} suggestion${plan.steps.length === 1 ? "" : "s"} · +${plan.jointPlan.metrics.addedKm2.toFixed(2)} km²` : "Your monitoring plan"}</Typography>
            <Typography variant="caption" color="text.secondary">{plan ? "Purple pins are ready for review." : "Add a manual pin or request suggestions."}</Typography></Box>
          <Stack direction="row" sx={{ gap: 1, flexWrap: "wrap" }}>
            {plan && <Button size="small" aria-expanded={showDetails} aria-controls="case-study-details" onClick={() => { setShowDetails(!showDetails); setBefore(false); setView("joint"); setStep(plan.steps.length); }}>{showDetails ? "Hide case-study details" : "Case-study details"}</Button>}
            <Button variant="contained" onClick={() => setBasketOpen(true)}>Location basket · {simulatedStations.length + (plan?.steps.length ?? 0)}</Button>
          </Stack>
        </Stack>
        {plan && plan.steps.every(s => s.overlapFraction >= 0.8) && <Alert severity="warning" sx={{ mt: 1, py: 0 }}>Small additional reach: these {plan.steps.length} sensors add only {plan.jointPlan.metrics.addedKm2.toFixed(2)} km². Review the cost in your basket.</Alert>}
        {plan && showDetails && <Stack spacing={1.5} sx={{ mt: 2, pt: 2, borderTop: 1, borderColor: "divider" }}>
          <Typography variant="subtitle2">Compare the networks</Typography>
          <Stack direction="row" sx={{ gap: 1.5, flexWrap: "wrap", alignItems: "center" }}>
            <ToggleButtonGroup exclusive size="small" value={view} onChange={(_, value) => { if (value) { setBefore(false); setView(value); } }} aria-label="Plan comparison">
              <ToggleButton value="independent">Baseline</ToggleButton><ToggleButton value="joint">Recommended</ToggleButton><ToggleButton value="compare">Both</ToggleButton>
            </ToggleButtonGroup>
            <Stack direction="row" sx={{ flexWrap: "wrap", gap: 0.75 }} aria-label="Selection steps">
              <Button size="small" variant={step === 0 ? "contained" : "outlined"} onClick={() => { setBefore(false); setView(view === "independent" ? "joint" : view); setStep(0); }}>Existing</Button>
              {plan.steps.map((s, i) => <Button size="small" key={s.station.id} variant={step === i + 1 ? "contained" : "outlined"} onClick={() => { setBefore(false); setView(view === "independent" ? "joint" : view); setStep(i + 1); }}>Step {i + 1} · +{s.marginalKm2.toFixed(2)} km²</Button>)}
            </Stack>
          </Stack>
          <Stack direction="row" sx={{ gap: 1, flexWrap: "wrap", alignItems: "center" }}>
            <Chip size="small" label="B · Independent baseline" sx={{ color: "#92400e", bgcolor: "#fff7ed" }} />
            <Chip size="small" label={`1–${plan.steps.length} · Recommended locations`} sx={{ color: "#6d28d9", bgcolor: "#f5f3ff" }} />
            <Typography variant="caption" color="text.secondary">{view === "compare" ? "In Both view, shading follows the recommended steps." : "Shading includes the displayed plan."}</Typography>
          </Stack>
        </Stack>}
      </Card>
      <Box role="region" aria-label="Plan comparison map">
        <CityMap compact focusLocation={focusLocation} includePlanned={!before} frameStations={frameStations} coverageStations={coverageStations}
          planningCaption={before ? "Before · installed sensors only" : plan ? `${view === "independent" ? "Baseline" : step === 0 ? "Current" : "Recommended"} air coverage · ${coverageStations.length} proposed ${coverageStations.length === 1 ? "station" : "stations"} · use + / − to zoom` : "Green: near · yellow: mid-range · red: monitoring gap · use + / − to zoom"}>
          {focusLocation && !before && <Circle center={[focusLocation.lat, focusLocation.lng]} radius={100} interactive={false} pathOptions={{ color: "#6d28d9", weight: 3, fillOpacity: 0.15 }} />}
          {plan && !before && view !== "joint" && plan.independentPlan.stations.map((s, i) => <Circle key={`baseline-${s.id}`} center={[s.lat, s.lng]} radius={2000} interactive={false} pathOptions={{ color: "#b45309", fillOpacity: 0.04, dashArray: "5 5" }}>{stationMarker(s, i, true)}</Circle>)}
          {plan && !before && view !== "independent" && plan.jointPlan.stations.slice(0, step).map((s, i) => <Circle key={`joint-${s.id}`} center={[s.lat, s.lng]} radius={2000} interactive={false} pathOptions={{ color: "#6d28d9", fillOpacity: 0.04 }}>{stationMarker(s, i, false)}</Circle>)}
        </CityMap>
      </Box>
    </Box>
    {plan && <>
      {showDetails && <Stack id="case-study-details" spacing={2} component="section" aria-label="Case-study details">
        <Typography component="h2" variant="h6">How the recommendation was evaluated</Typography>
        <Typography variant="body2" color="text.secondary">For the case study, compare choosing each location separately with choosing locations together. The recommended plan recalculates uncovered area after every addition.</Typography>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 4 }}><MetricCard title="Existing network" metrics={plan.existingMetrics} color="#64748b" /></Grid>
          <Grid size={{ xs: 12, md: 4 }}><MetricCard title="Independent top-k" metrics={plan.independentPlan.metrics} color="#b45309" /></Grid>
          <Grid size={{ xs: 12, md: 4 }}><MetricCard title="Recommended network" metrics={plan.jointPlan.metrics} color="#6d28d9" /></Grid>
        </Grid>
        <Card variant="outlined" sx={{ p: 2.5 }}>
          <Typography component="h3" variant="h6">{current ? `After adding location ${step}` : "Before adding any new sensors"}</Typography>
          <Typography variant="body2" sx={{ mt: 1 }}>{current?.explanation ?? "The original ranking scores each candidate against the existing network."}</Typography>
          <Typography component="h3" variant="subtitle1" sx={{ mt: 2 }}>{current ? "Ranking after this selection" : "Original independent ranking"}</Typography>
          <TableContainer><Table size="small" aria-label="Candidate ranking">
            <TableHead><TableRow><TableCell>Candidate</TableCell><TableCell align="right">Original score</TableCell><TableCell align="right">Score after selection</TableCell></TableRow></TableHead>
            <TableBody>{ranking?.slice(0, 5).map((s) => <TableRow key={s.id}><TableCell>{s.name}<Typography variant="caption" component="div" color="text.secondary">{s.lat.toFixed(4)}, {s.lng.toFixed(4)}</Typography></TableCell><TableCell align="right">{s.independentWeightedGain.toFixed(2)}</TableCell><TableCell align="right">{(s.marginalWeightedGain ?? s.independentWeightedGain).toFixed(2)}</TableCell></TableRow>)}</TableBody>
          </Table></TableContainer>
          <Typography variant="caption" color="text.secondary">Scores combine extra coverage and estimated pollution. They are not km². Candidates too close to selected locations are excluded.</Typography>
        </Card>
        {plan.independentPlan.constraintViolations.length > 0 && <Alert severity="warning">The independent plan has {plan.independentPlan.constraintViolations.length} station pairs closer than the selected {separation} km minimum.</Alert>}
        <Card variant="outlined" sx={{ p: 2.5 }}>
          <Typography component="h3" variant="h6">Why choosing locations together helps</Typography><Typography sx={{ mt: 1 }}>{plan.tradeoff}</Typography>
          <Box component="details" sx={{ mt: 2 }}><Typography component="summary" sx={{ cursor: "pointer" }}>Method, benchmark and limitations</Typography>
            <Typography variant="body2" sx={{ mt: 1 }}>{plan.method}</Typography><Typography variant="body2">{plan.benchmark.method}</Typography>
            {plan.benchmark.metrics && <Typography variant="body2">Shortlist benchmark: {plan.benchmark.metrics.weightedGain.toFixed(2)} weighted gain.</Typography>}
            <Typography variant="body2">{plan.candidateCount} candidates · {plan.studyArea.gridPoints} grid samples · {plan.elapsedMs} ms</Typography>
            <Typography variant="caption">Dataset snapshot {plan.datasetVersion} · {plan.objectiveVersion}</Typography>
            {[...plan.assumptions, ...plan.warnings].map((text) => <Typography key={text} variant="body2" sx={{ mt: 1 }}>{text}</Typography>)}
          </Box>
        </Card>
      </Stack>}
    </>}
    {basketOpen && <LocationBasket open onDiscard={reset} onClose={() => setBasketOpen(false)} plan={plan} onDownload={() => { if (plan) downloadBrief(plan); }} onShow={(lat, lng) => { setBasketOpen(false); setBefore(false); setView("joint"); if (plan) setStep(plan.steps.length); setFocusLocation({ lat, lng, token: Date.now() }); }} />}
  </Stack>;
}
