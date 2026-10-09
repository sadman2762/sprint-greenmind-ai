import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Box, Button, Card, Chip, Dialog, DialogContent, DialogTitle, Divider, Drawer, IconButton, Grid, LinearProgress, Slider, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, ToggleButton, ToggleButtonGroup, Typography } from "@mui/material";
import { Circle, Marker, Tooltip } from "react-leaflet";
import L from "leaflet";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import TuneRoundedIcon from "@mui/icons-material/TuneRounded";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import PlaceOutlinedIcon from "@mui/icons-material/PlaceOutlined";
import LocationAddress from "../../components/map/LocationAddress";
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
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [mobilePanelOpen, setMobilePanelOpen] = useState(false);
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
    return <Marker key={`${baseline}-${station.id}`} position={[station.lat, station.lng]} icon={icon} title={`${baseline ? "Baseline" : "Recommended"} station ${index + 1}`} eventHandlers={{ click: () => setBasketOpen(true) }}><Tooltip>{baseline ? "Baseline" : "Recommended"} location {index + 1} · {station.lat.toFixed(4)}, {station.lng.toFixed(4)}</Tooltip></Marker>;
  }
  const focusPin = (lat: number, lng: number) => { setBasketOpen(false); setMobilePanelOpen(false); setBefore(false); setView("joint"); if (plan) setStep(plan.steps.length); setFocusLocation(previous => ({ lat, lng, token: (previous?.token ?? 0) + 1 })); };
  return <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "332px minmax(0, 1fr)" }, height: "100%", minHeight: 0, overflow: "hidden", position: "relative" }}>
    <Stack component="aside" aria-label="Plan your network" sx={{ bgcolor: "background.paper", borderRight: { md: "1px solid #e0e6e1" }, minHeight: 0, display: { xs: mobilePanelOpen ? "flex" : "none", md: "flex" }, position: { xs: "absolute", md: "relative" }, bottom: 0, width: { xs: "100%", md: "auto" }, maxHeight: { xs: "80%", md: "100%" }, height: { xs: "80%", md: "100%" }, zIndex: 1200, borderRadius: { xs: "16px 16px 0 0", md: 0 }, boxShadow: { xs: "0 -8px 40px #20332820", md: "none" } }}>
      <Stack direction="row" sx={{ display: { xs: "flex", md: "none" }, px: 2, py: 1, alignItems: "center", justifyContent: "space-between", borderBottom: 1, borderColor: "divider" }}><Typography variant="subtitle2">Plan your network</Typography><IconButton aria-label="Close planning panel" onClick={() => setMobilePanelOpen(false)}><CloseRoundedIcon /></IconButton></Stack>
      <Box sx={{ flex: 1, minHeight: 0, overflowY: "auto", p: 2.5 }}>
        <Typography variant="overline" sx={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", color: "text.secondary" }}>AIR MONITORING</Typography>
        <Typography component="h1" sx={{ fontSize: 25, lineHeight: 1.2, letterSpacing: "-0.8px", fontWeight: 650, mt: 0.5 }}>Build your network.</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1, mb: 2.5 }}>Find the next locations that reach more uncovered areas.</Typography>
        <Button fullWidth variant="contained" endIcon={<ArrowForwardRoundedIcon />} disabled={invalid || loading} onClick={() => generate(3)} sx={{ height: 44 }}>Suggest 3 together</Button>
        <Stack direction="row" sx={{ gap: 1, mt: 1 }}>
          <Button fullWidth variant="outlined" disabled={invalid || loading} onClick={() => generate(1)} sx={{ fontSize: 12, whiteSpace: "nowrap", px: 0.75 }}>Suggest next 1</Button>
          <Button fullWidth variant="outlined" disabled={invalid || loading} onClick={() => generate(2)} sx={{ fontSize: 12, whiteSpace: "nowrap", px: 0.75 }}>Suggest 2 together</Button>
        </Stack>
        <Button size="small" startIcon={<TuneRoundedIcon sx={{ fontSize: 16 }} />} onClick={() => setPreferencesOpen(true)} sx={{ color: "text.secondary", mt: 1, mb: 2 }}>Planning preferences</Button>
        {loading && <Box role="status" sx={{ mb: 2 }}><Typography variant="caption" color="text.secondary">Finding the next useful locations…</Typography><LinearProgress sx={{ mt: 1, borderRadius: 2 }} /></Box>}
        {error && <Alert severity="error" sx={{ mb: 2 }} action={<Button color="inherit" onClick={() => generate()}>Retry</Button>}>{error}</Alert>}
        <Divider sx={{ mb: 2.5 }} />
        <CoverageComparison simulation={simulation} plan={plan} before={before} onBeforeChange={value => { setMobilePanelOpen(false); setBefore(value); setView("joint"); if (plan) setStep(plan.steps.length); }} />
        <Divider sx={{ my: 2.5 }} />
        {plan ? <>
          <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", mb: 1.5 }}><Typography component="h2" variant="subtitle2">Suggested locations</Typography><Chip label={`${plan.steps.length} new`} size="small" sx={{ color: "#6d28d9", bgcolor: "#f5f3ff" }} /></Stack>
          <Stack spacing={1}>
            {plan.steps.map((item, i) => <Box key={item.station.id} sx={{ p: 1.5, border: 1, borderColor: "divider", borderRadius: 2, bgcolor: "#fafbf9" }}>
              <Stack direction="row" sx={{ alignItems: "center", gap: 1, mb: 0.75 }}><Box sx={{ width: 23, height: 23, borderRadius: "50%", bgcolor: "#6d28d9", color: "white", display: "grid", placeItems: "center", fontSize: 11, fontWeight: 700 }}>{i + 1}</Box><Typography variant="body2" sx={{ fontWeight: 650, flex: 1 }}>+{item.marginalKm2.toFixed(2)} km²</Typography><IconButton size="small" aria-label={`Show suggestion ${i + 1} on map`} onClick={() => focusPin(item.station.lat, item.station.lng)}><PlaceOutlinedIcon fontSize="small" /></IconButton></Stack>
              <LocationAddress compact lat={item.station.lat} lng={item.station.lng} />
            </Box>)}
          </Stack>
          {plan.steps.every(s => s.overlapFraction >= 0.8) && <Alert severity="warning" sx={{ mt: 1.5 }}>Small extra reach. Review the cost before adding more.</Alert>}
          <Button size="small" onClick={() => setShowDetails(true)} sx={{ mt: 1.5, color: "text.secondary" }}>Compare methods &amp; results</Button>
        </> : <Box sx={{ py: 1 }}>
          <Typography variant="subtitle2">{simulatedStations.length ? `${simulatedStations.length} location${simulatedStations.length === 1 ? "" : "s"} in your plan` : "Your next step"}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>{simulatedStations.length ? "New suggestions account for every location you’ve chosen." : "Request suggestions, or use Add sensor to place a location yourself."}</Typography>
        </Box>}
      </Box>
      <Box sx={{ p: 2, borderTop: 1, borderColor: "divider", bgcolor: "background.paper" }}>
        <Button fullWidth variant={plan ? "contained" : "outlined"} onClick={() => setBasketOpen(true)} endIcon={<ArrowForwardRoundedIcon />}>Location basket · {simulatedStations.length + (plan?.steps.length ?? 0)}</Button>
        <Typography variant="caption" sx={{ display: "block", textAlign: "center", mt: 1, color: "text.secondary", fontSize: 10 }}>Planning estimates · Saved in this session</Typography>
      </Box>
    </Stack>
    <Box component="section" role="region" aria-label="Plan comparison map" ref={mapRef} sx={{ minWidth: 0, minHeight: 0, height: "100%", position: "relative" }}>
        <CityMap workspace compact focusLocation={focusLocation} includePlanned={!before} onStartPlacement={() => setBefore(false)} frameStations={frameStations} coverageStations={coverageStations}
          planningCaption={before ? "Before · installed sensors only" : plan ? `${view === "independent" ? "Baseline" : step === 0 ? "Current" : "Recommended"} air coverage · ${coverageStations.length} proposed ${coverageStations.length === 1 ? "station" : "stations"} · use + / − to zoom` : "Green: near · yellow: mid-range · red: monitoring gap · use + / − to zoom"}>
          {focusLocation && !before && <Circle center={[focusLocation.lat, focusLocation.lng]} radius={100} interactive={false} pathOptions={{ color: "#6d28d9", weight: 3, fillOpacity: 0.15 }} />}
          {plan && !before && view !== "joint" && plan.independentPlan.stations.map((s, i) => <Circle key={`baseline-${s.id}`} center={[s.lat, s.lng]} radius={2000} interactive={false} pathOptions={{ color: "#b45309", fillOpacity: 0.04, dashArray: "5 5" }}>{stationMarker(s, i, true)}</Circle>)}
          {plan && !before && view !== "independent" && plan.jointPlan.stations.slice(0, step).map((s, i) => <Circle key={`joint-${s.id}`} center={[s.lat, s.lng]} radius={2000} interactive={false} pathOptions={{ color: "#6d28d9", fillOpacity: 0.04 }}>{stationMarker(s, i, false)}</Circle>)}
        </CityMap>
    </Box>
    {!mobilePanelOpen && <Stack direction="row" sx={{ display: { xs: "flex", md: "none" }, position: "absolute", bottom: 24, left: 16, right: 16, gap: 1, zIndex: 1100 }}><Button variant="contained" sx={{ flex: 1, height: 44, boxShadow: "0 4px 16px #20332824" }} onClick={() => setMobilePanelOpen(true)}>Plan sensors</Button><Button variant="outlined" sx={{ bgcolor: "background.paper" }} onClick={() => setBasketOpen(true)}>Basket · {simulatedStations.length + (plan?.steps.length ?? 0)}</Button></Stack>}
    <Dialog open={preferencesOpen} onClose={() => setPreferencesOpen(false)} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>Planning preferences<IconButton aria-label="Close planning preferences" onClick={() => setPreferencesOpen(false)}><CloseRoundedIcon /></IconButton></DialogTitle>
      <DialogContent>        <Grid container spacing={3} sx={{ mt: 1, alignItems: "center" }}>
          <Grid size={12}><Typography variant="subtitle2">Give more priority to areas with higher estimated air pollution</Typography>
            <Slider value={environmentalWeight} min={0} max={3} step={0.25} valueLabelDisplay="auto" aria-label="Environmental importance" onChange={(_, value) => { reset(); setEnvironmentalWeight(value as number); }} />
            <Typography variant="caption" color="text.secondary">At zero, only extra area matters. Moving right gives pollution estimates more influence.</Typography>
          </Grid>
          <Grid size={12}><TextField size="small" label="Keep new sensors at least this far apart (km)" type="number" value={separation} error={invalid} helperText={invalid ? "Enter a distance from 0 to 5 km." : "Avoid placing the new sensors too close together."} onChange={(event) => { reset(); setSeparation(event.target.value); }} slotProps={{ htmlInput: { min: 0, max: 5, step: 0.25 } }} fullWidth /></Grid>
        </Grid></DialogContent>
    </Dialog>
    <Drawer anchor="right" open={showDetails && Boolean(plan)} onClose={() => { setShowDetails(false); setView("joint"); if (plan) setStep(plan.steps.length); }} sx={{ zIndex: 1400 }} slotProps={{ paper: { sx: { width: { xs: "100%", sm: 500 }, maxWidth: "100%", p: 2.5 } } }}>
      <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", mb: 2 }}><Typography variant="h6">Plan evaluation</Typography><IconButton aria-label="Close plan evaluation" onClick={() => { setShowDetails(false); setView("joint"); if (plan) setStep(plan.steps.length); }}><CloseRoundedIcon /></IconButton></Stack>
      {plan && <Stack spacing={2} id="case-study-details">          <Typography variant="subtitle2">Compare the networks</Typography>
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
        <Typography component="h2" variant="h6">How the recommendation was evaluated</Typography>
        <Typography variant="body2" color="text.secondary">For the case study, compare choosing each location separately with choosing locations together. The recommended plan recalculates uncovered area after every addition.</Typography>
        <Grid container spacing={2}>
          <Grid size={12}><MetricCard title="Existing network" metrics={plan.existingMetrics} color="#64748b" /></Grid>
          <Grid size={12}><MetricCard title="Independent top-k" metrics={plan.independentPlan.metrics} color="#b45309" /></Grid>
          <Grid size={12}><MetricCard title="Recommended network" metrics={plan.jointPlan.metrics} color="#6d28d9" /></Grid>
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
    </Drawer>
    {basketOpen && <LocationBasket open onDiscard={reset} onClose={() => setBasketOpen(false)} plan={plan} onDownload={() => { if (plan) downloadBrief(plan); }} onShow={focusPin} />}
  </Box>;
}
