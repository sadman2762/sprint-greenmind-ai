import { useEditablePlan } from "./useEditablePlan";
import RadiusInput from "../../components/map/RadiusInput";
import SuggestedStationMarker from "../../components/map/SuggestedStationMarker";
import { useRanges } from "../../context/rangeState";
import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Box, Button, Card, Chip, Dialog, DialogContent, DialogTitle, Divider, Drawer, IconButton, Grid, LinearProgress, Link, Slider, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, ToggleButton, ToggleButtonGroup, Typography } from "@mui/material";
import { Circle, Marker, Popup, Tooltip } from "react-leaflet";
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
import MethodComparison from "./MethodComparison";
import SelectionStory, { SelectionSteps } from "./SelectionStory";
import CityMap from "../../components/map/CityMap";

function MetricCard({ title, metrics, color }: { title: string; metrics: PlanMetrics; color: string }) {
  return <Card variant="outlined" sx={{ p: 2, height: "100%", borderTop: `3px solid ${color}` }}>
    <Typography variant="subtitle2">{title}</Typography>
    <Typography variant="h5" sx={{ mt: 0.5, fontVariantNumeric: "tabular-nums" }}>{metrics.coveragePercent.toFixed(1)}%</Typography>
    <Typography variant="body2" color="text.secondary">modeled coverage · {metrics.coveredKm2.toFixed(2)} km²</Typography>
    <Typography variant="body2" sx={{ mt: 1 }}>+{metrics.addedKm2.toFixed(2)} km² · {metrics.weightedGain.toFixed(2)} weighted gain</Typography>
  </Card>;
}

function downloadBrief(plan: JointPlan) {
  const content = [
    "# GreenMind AI — recommended sensor locations", "",
    `Add ${plan.steps.length} ${plan.planningCategory ?? "air"} sensors to reach ${plan.jointPlan.metrics.addedKm2.toFixed(2)} km² more.`,
    `Scenario coverage: ${plan.existingMetrics.coveragePercent.toFixed(1)}% with current chosen locations → ${plan.jointPlan.metrics.coveragePercent.toFixed(1)}% with the new sensors.`, "",
    ...plan.steps.map((s, i) => `- Location ${i + 1} (radius ${s.station.radiusKm ?? plan.studyArea.radiusKm} km): ${s.station.lat.toFixed(4)}, ${s.station.lng.toFixed(4)}. Adds ${s.marginalKm2.toFixed(2)} km² beyond the existing sensors and earlier locations in this list.`),
    "", `Scenario radius for new ${plan.planningCategory ?? "air"} sensors: ${plan.studyArea.radiusKm} km. Configured input, not verified detection range. Installation costs and site access still need checking.`,
    ...(plan.rangeSettings ? [`Category radii (km): ${JSON.stringify(plan.rangeSettings.coverageRadiiKm)}`, `Individual radii (km): ${JSON.stringify(plan.rangeSettings.sensorRadiusOverridesKm)}`] : []),
    "", ...(plan.userAdjusted ? ["## User-adjusted proposal", "Coordinates were edited manually. The original algorithm comparison is omitted."] : ["## Original method comparison", "",
    `Source: ${plan.originalPlan.source.repository} @ ${plan.originalPlan.source.commit}`,
    `Status: ${plan.originalPlan.status}. ${plan.originalComparison}`,
    ...plan.originalPlan.steps.map((s, i) => `Original ${i + 1}: ${s.station.lat}, ${s.station.lng}; +${s.marginalKm2.toFixed(2)} km².`),
    ...plan.originalPlan.warnings, ...plan.originalPlan.constraintViolations]),
    "", "## Case-study evaluation", "",
    `Dataset: ${plan.datasetVersion} · Objective: ${plan.objectiveVersion}`, plan.method, "",
    `Existing coverage: ${plan.existingMetrics.coveragePercent.toFixed(2)}%`,
    `Independent control (new objective): +${plan.independentPlan.metrics.addedKm2.toFixed(2)} km²; weighted gain ${plan.independentPlan.metrics.weightedGain.toFixed(2)}`,
    `${plan.userAdjusted ? "User-adjusted proposal" : "Joint plan"}: +${plan.jointPlan.metrics.addedKm2.toFixed(2)} km²; weighted gain ${plan.jointPlan.metrics.weightedGain.toFixed(2)}`, "",
    ...plan.steps.map((s, i) => `${i + 1}. ${s.station.id} (${s.station.lat}, ${s.station.lng}): +${s.marginalKm2.toFixed(2)} km², weighted gain ${s.marginalWeightedGain.toFixed(2)}, overlap ${(s.overlapFraction * 100).toFixed(1)}%.`),
    "", "## What changes after each placement", "",
    ...plan.steps.flatMap((s, i) => s.recalculation ? [
      `After location ${i + 1}, the previously next-highest option (${s.recalculation.station.lat}, ${s.recalculation.station.lng}) changes from ${s.recalculation.beforeKm2.toFixed(2)} to ${s.recalculation.afterKm2.toFixed(2)} additional km².${s.recalculation.excludedBySeparation ? " It also fails the requested spacing rule after this placement." : ""}`,
    ] : []),
    "", plan.tradeoff, "", "## Assumptions and limitations", ...plan.assumptions.map((x) => `- ${x}`), ...plan.warnings.map((x) => `- ${x}`),
    "", plan.benchmark.method, `Runtime: ${plan.elapsedMs} ms for ${plan.candidateCount} candidates.`,
  ].join("\n");
  const url = URL.createObjectURL(new Blob([content], { type: "text/markdown" }));
  const anchor = document.createElement("a");
  anchor.href = url; anchor.download = "greenmind-joint-plan.md"; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function JointPlanner() {
  const { simulatedStations, setIsPlacingCustomPin } = useSimulation();
  const [category, setCategory] = useState<"air" | "water" | "noise">("air");
  const [stationCount, setStationCount] = useState<1 | 2 | 3>(3);
  const [environmentalWeight, setEnvironmentalWeight] = useState(1);
  const [separation, setSeparation] = useState("1");
  const [basketOpen, setBasketOpen] = useState(false);
  const [mobilePanelOpen, setMobilePanelOpen] = useState(false);
  const snapshot = JSON.stringify(simulatedStations.map((s) => [s.id, s.lat, s.lng, s.sensorTier]));
  return <JointPlannerWorkspace key={`${category}-${snapshot}`} mobilePanelOpen={mobilePanelOpen} setMobilePanelOpen={setMobilePanelOpen} category={category} setCategory={value => { setIsPlacingCustomPin(false); setCategory(value); }} basketOpen={basketOpen} setBasketOpen={setBasketOpen} stationCount={stationCount} setStationCount={setStationCount} environmentalWeight={environmentalWeight} setEnvironmentalWeight={setEnvironmentalWeight} separation={separation} setSeparation={setSeparation} />;
}

interface PlannerSettings {
  mobilePanelOpen: boolean; setMobilePanelOpen: (open: boolean) => void;
  category: "air" | "water" | "noise"; setCategory: (category: "air" | "water" | "noise") => void;
  basketOpen: boolean; setBasketOpen: (open: boolean) => void;
  stationCount: 1 | 2 | 3; setStationCount: (count: 1 | 2 | 3) => void;
  environmentalWeight: number; setEnvironmentalWeight: (weight: number) => void;
  separation: string; setSeparation: (distance: string) => void;
}
function JointPlannerWorkspace({ mobilePanelOpen, setMobilePanelOpen, category, setCategory, basketOpen, setBasketOpen, stationCount, setStationCount, environmentalWeight, setEnvironmentalWeight, separation, setSeparation }: PlannerSettings) {
  const { simulatedStations, setCustomPinTier, setIsPlacingCustomPin } = useSimulation();
  const { radii, overrides } = useRanges();
  const [suggestionRadius, setSuggestionRadius] = useState(radii[category]);
  const [suggestionRadiusValid, setSuggestionRadiusValid] = useState(true);
  const [before, setBefore] = useState(false);
  const [alternativeLocation, setAlternativeLocation] = useState<{ lat: number; lng: number }>();
  const [focusLocation, setFocusLocation] = useState<{ lat: number; lng: number; token: number }>();
  const mapRef = useRef<HTMLDivElement>(null);
  const [receivedPlan, setPlan] = useState<{ value: JointPlan; signature: string } | null>(null);
  const rangeSignature = JSON.stringify([radii, overrides, suggestionRadius]);
  const sourcePlan = receivedPlan?.signature === rangeSignature ? receivedPlan.value : null;
  const simulation = simulatedStations.map(s => ({ id: String(s.id), name: s.name, lat: s.lat, lng: s.lng, category: getStationCategory(s) ?? "air" as const, hardwareGrade: "unspecified" as const }));
  const { plan, editing, editError, move } = useEditablePlan(sourcePlan, { planningCategory: category === "water" ? "air" : category, stationCount, environmentalWeight, minSeparationKm: Number(separation), newSensorRadiusKm: suggestionRadius, coverageRadiiKm: radii, sensorRadiusOverridesKm: overrides, existingSimulation: simulation });
  const [error, setError] = useState("");
  const [pendingRange, setPendingRange] = useState<string | null>(null);
  const loading = pendingRange === rangeSignature;
  const setLoading = (value: boolean) => setPendingRange(value ? rangeSignature : null);
  const [step, setStep] = useState(0);
  const [showDetails, setShowDetails] = useState(false);
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [view, setView] = useState<"joint" | "original" | "compare">("joint");
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => { request.current?.abort(); setPendingRange(null); }, [rangeSignature]);
  useEffect(() => { if (focusLocation) mapRef.current?.scrollIntoView({ block: "start" }); }, [focusLocation]);

  function reset() {
    request.current?.abort();
    setPlan(null); setLoading(false); setError(""); setStep(0); setView("joint"); setShowDetails(false);
  }
  async function generate(count: 1 | 2 | 3 = stationCount) {
    if (category === "water") return;
    setStationCount(count); setAlternativeLocation(undefined); setBefore(false); setFocusLocation(undefined);
    request.current?.abort();
    const controller = new AbortController(); request.current = controller;
    setLoading(true); setError(""); setPlan(null);
    try {
      const result = await getJointPlan({
        planningCategory: category, newSensorRadiusKm: suggestionRadius, coverageRadiiKm: radii, sensorRadiusOverridesKm: overrides, stationCount: count, environmentalWeight, minSeparationKm: Number(separation),
        existingSimulation: simulatedStations.map((s) => ({ id: String(s.id), name: s.name, lat: s.lat, lng: s.lng, category: getStationCategory(s) ?? "air", hardwareGrade: "unspecified" })),
      }, controller.signal);
      if (!controller.signal.aborted) { setPlan({ value: result, signature: rangeSignature }); setStep(result.steps.length); setView("joint"); setShowDetails(false); }
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Could not generate a plan.");
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }
  const current = plan && step > 0 ? plan.steps[step - 1] : null;
  const ranking: (PlanStation & { marginalWeightedGain?: number })[] | undefined = current?.updatedRanking ?? plan?.baselineRanking;
  const invalid = separation.trim() === "" || !Number.isFinite(Number(separation)) || Number(separation) < 0 || Number(separation) > 5;
  const frameStations = useMemo<Station[]>(() => sourcePlan ? [...sourcePlan.originalPlan.stations, ...sourcePlan.jointPlan.stations].map((s, index) => ({ id: -1000 - index, name: s.name, lat: s.lat, lng: s.lng, station_type: category === "noise" ? 2 : category === "water" ? 1 : 0, sensorTier: category })) : [], [sourcePlan, category]);
  const coverageStations = useMemo<Station[]>(() => {
    const selected = !plan || before ? [] : view === "original" ? plan.originalPlan.stations : plan.jointPlan.stations.slice(0, step);
    return selected.map((s, index) => ({ id: -2000 - index, scenarioRadiusKm: s.radiusKm ?? plan?.studyArea.radiusKm, name: s.name, lat: s.lat, lng: s.lng, station_type: category === "noise" ? 2 : category === "water" ? 1 : 0, sensorTier: category }));
  }, [plan, view, step, before, category]);
  function stationMarker(station: PlanStation, index: number, baseline: boolean) {
    const color = baseline ? "#b45309" : "#6d28d9";
    const icon = L.divIcon({ className: "joint-plan-marker", html: `<span style="display:grid;place-items:center;width:30px;height:30px;border-radius:50%;background:${color};color:white;border:2px solid white;font-weight:700">${baseline ? "O" : ""}${index + 1}</span>`, iconSize: [30, 30], iconAnchor: [15, 15] });
    if (!baseline) return <SuggestedStationMarker station={station} index={index} icon={icon} disabled={editing} onMove={async (i, lat, lng) => { setView("joint"); setShowDetails(false); setAlternativeLocation(undefined); return move(i, lat, lng); }} />;
    return <Marker key={`${baseline}-${station.id}`} position={[station.lat, station.lng]} icon={icon} title={`${baseline ? "Original" : "Joint"} station ${index + 1}`} eventHandlers={baseline ? undefined : { click: () => setBasketOpen(true) }}><Tooltip>{baseline ? "Original" : "Joint"} location {index + 1} · {station.lat.toFixed(4)}, {station.lng.toFixed(4)}</Tooltip>{baseline && <Popup><Typography variant="subtitle2">Original location {index + 1}</Typography><LocationAddress lat={station.lat} lng={station.lng} /></Popup>}</Marker>;
  }
  function selectStep(next: number) {
    setBefore(false); setView("joint"); setStep(next); setAlternativeLocation(undefined); setFocusLocation(undefined);
  }
  const focusPin = (lat: number, lng: number) => { setBasketOpen(false); setMobilePanelOpen(false); setBefore(false); setView("joint"); if (plan) setStep(plan.steps.length); setFocusLocation(previous => ({ lat, lng, token: (previous?.token ?? 0) + 1 })); };
  return <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "332px minmax(0, 1fr)" }, height: "100%", minHeight: 0, overflow: "hidden", position: "relative" }}>
    <Stack component="aside" aria-label="Plan your network" sx={{ bgcolor: "background.paper", borderRight: { md: "1px solid #e0e6e1" }, minHeight: 0, display: { xs: mobilePanelOpen ? "flex" : "none", md: "flex" }, position: { xs: "absolute", md: "relative" }, bottom: 0, width: { xs: "100%", md: "auto" }, maxHeight: { xs: "80%", md: "100%" }, height: { xs: "80%", md: "100%" }, zIndex: 1200, borderRadius: { xs: "16px 16px 0 0", md: 0 }, boxShadow: { xs: "0 -8px 40px #20332820", md: "none" } }}>
      <Stack direction="row" sx={{ display: { xs: "flex", md: "none" }, px: 2, py: 1, alignItems: "center", justifyContent: "space-between", borderBottom: 1, borderColor: "divider" }}><Typography variant="subtitle2">Plan your network</Typography><IconButton aria-label="Close planning panel" onClick={() => setMobilePanelOpen(false)}><CloseRoundedIcon /></IconButton></Stack>
      <Box sx={{ flex: 1, minHeight: 0, overflowY: "auto", p: 2.5 }}>
        <Typography variant="overline" sx={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", color: "text.secondary" }}>{category.toUpperCase()} MONITORING</Typography>
        <Typography component="h1" sx={{ fontSize: 25, lineHeight: 1.2, letterSpacing: "-0.8px", fontWeight: 650, mt: 0.5 }}>Build your network.</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1, mb: 2.5 }}>Find the next locations that reach more uncovered areas.</Typography>
        <ToggleButtonGroup exclusive fullWidth size="small" value={category} aria-label="Network to plan" onChange={(_, value) => { if (value) setCategory(value); }} sx={{ mb: 2 }}><ToggleButton value="air">Air</ToggleButton><ToggleButton value="water">Water</ToggleButton><ToggleButton value="noise">Noise</ToggleButton></ToggleButtonGroup>
        {category === "noise" && <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1.5 }}>Historical noise sites · configured {radii.noise} km scenario radius</Typography>}
        {category === "water" ? <Stack spacing={1.5} sx={{ mb: 2 }}>
          <Typography variant="body2" color="text.secondary">Explore water stations and add proposed monitoring locations to your basket.</Typography>
          <Button fullWidth variant="contained" onClick={() => { setBefore(false); setCustomPinTier("water"); setIsPlacingCustomPin(true); setMobilePanelOpen(false); }}>Add water sensor</Button>
          <Typography variant="caption" color="text.secondary">Automatic water suggestions are not available yet. Locations need a suitable water body or sampling point; distance shading alone does not establish water coverage.</Typography>
        </Stack> : <>
        <Box sx={{ mb: 1 }}><RadiusInput key={`${category}-${suggestionRadius}`} label="Suggested sensor radius (km)" value={suggestionRadius} onChange={setSuggestionRadius} onValidityChange={setSuggestionRadiusValid} /></Box>
        <Button fullWidth variant="contained" endIcon={<ArrowForwardRoundedIcon />} disabled={invalid || loading || editing || !suggestionRadiusValid} onClick={() => generate(3)} sx={{ height: 44 }}>Suggest 3 together</Button>
        <Stack direction="row" sx={{ gap: 1, mt: 1 }}>
          <Button fullWidth variant="outlined" disabled={invalid || loading || editing || !suggestionRadiusValid} onClick={() => generate(1)} sx={{ fontSize: 12, whiteSpace: "nowrap", px: 0.75 }}>Suggest next 1</Button>
          <Button fullWidth variant="outlined" disabled={invalid || loading || editing || !suggestionRadiusValid} onClick={() => generate(2)} sx={{ fontSize: 12, whiteSpace: "nowrap", px: 0.75 }}>Suggest 2 together</Button>
        </Stack>
        <Button size="small" startIcon={<TuneRoundedIcon sx={{ fontSize: 16 }} />} onClick={() => setPreferencesOpen(true)} sx={{ color: "text.secondary", mt: 1, mb: 2 }}>Planning preferences</Button>
        {loading && <Box role="status" sx={{ mb: 2 }}><Typography variant="caption" color="text.secondary">Finding the next useful locations…</Typography><LinearProgress sx={{ mt: 1, borderRadius: 2 }} /></Box>}
        {error && <Alert severity="error" sx={{ mb: 2 }} action={<Button color="inherit" onClick={() => generate()}>Retry</Button>}>{error}</Alert>}
        <Divider sx={{ mb: 2.5 }} />
        <CoverageComparison category={category} step={step} method={view === "original" ? "original" : "joint"} simulation={simulation} plan={plan} before={before} onBeforeChange={value => { setMobilePanelOpen(false); setBefore(value); setAlternativeLocation(undefined); }} />
        </>}
        <Divider sx={{ my: 2.5 }} />
        {editing && <Typography role="status" variant="body2" sx={{ mb: 1 }}>Recalculating the moved proposal…</Typography>}
        {editError && <Alert severity="error" sx={{ mb: 1 }}>{editError}</Alert>}
        {plan?.userAdjusted && <Alert severity="info" sx={{ mb: 1 }}>Adjusted manually · area and overlap recalculated. Still a proposal until you apply it.</Alert>}
        {plan?.userAdjusted && plan.warnings.filter(text => text.includes("closer than")).map(text => <Alert severity="warning" key={text} sx={{ mb: 1 }}>{text}</Alert>)}
        {plan ? <>
          <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", mb: 1.5 }}><Typography component="h2" variant="subtitle2">{plan.userAdjusted ? "Adjusted suggestions" : "Joint suggestions"}</Typography><Chip label={`${plan.steps.length} new`} size="small" sx={{ color: "#6d28d9", bgcolor: "#f5f3ff" }} /></Stack>
          <Typography variant="caption" color="text.secondary">Drag purple markers to adjust them before applying.</Typography>
          {!before && view !== "original" && <SelectionStory plan={plan} step={step} onShowAlternative={(lat, lng) => {
            setAlternativeLocation({ lat, lng }); setMobilePanelOpen(false);
            setFocusLocation(previous => ({ lat, lng, token: (previous?.token ?? 0) + 1 }));
          }} />}
          <Stack spacing={1} sx={{ mt: 1.5 }}>
            {plan.steps.map((item, i) => <Box key={item.station.id} sx={{ p: 1.5, border: 1, borderColor: "divider", borderRadius: 2, bgcolor: "#fafbf9" }}>
              <Stack direction="row" sx={{ alignItems: "center", gap: 1, mb: 0.75 }}><Box sx={{ width: 23, height: 23, borderRadius: "50%", bgcolor: "#6d28d9", color: "white", display: "grid", placeItems: "center", fontSize: 11, fontWeight: 700 }}>{i + 1}</Box><Typography variant="body2" sx={{ fontWeight: 650, flex: 1 }}>+{item.marginalKm2.toFixed(2)} km²</Typography><IconButton size="small" aria-label={`Show suggestion ${i + 1} on map`} onClick={() => focusPin(item.station.lat, item.station.lng)}><PlaceOutlinedIcon fontSize="small" /></IconButton></Stack>
              <LocationAddress compact lat={item.station.lat} lng={item.station.lng} />
            </Box>)}
          </Stack>
          {plan.steps.every(s => s.overlapFraction >= 0.8) && <Alert severity="warning" sx={{ mt: 1.5 }}>Small extra reach. Review the cost before adding more.</Alert>}
          {!plan.userAdjusted && <Button size="small" onClick={() => setShowDetails(true)} sx={{ mt: 1.5, color: "text.secondary" }}>Compare methods &amp; results</Button>}
        </> : <Box sx={{ py: 1 }}>
          <Typography variant="subtitle2">{simulatedStations.length ? `${simulatedStations.length} location${simulatedStations.length === 1 ? "" : "s"} in your plan` : "Your next step"}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>{simulatedStations.length ? category === "water" ? "Review your chosen locations in the basket or add another water sampling point." : "New suggestions account for every location you’ve chosen." : "Request suggestions, or use Add sensor to place a location yourself."}</Typography>
        </Box>}
      </Box>
      <Box sx={{ p: 2, borderTop: 1, borderColor: "divider", bgcolor: "background.paper" }}>
        <Button fullWidth variant={plan ? "contained" : "outlined"} onClick={() => setBasketOpen(true)} endIcon={<ArrowForwardRoundedIcon />}>Location basket · {simulatedStations.length + (plan?.steps.length ?? 0)}</Button>
        <Typography variant="caption" sx={{ display: "block", textAlign: "center", mt: 1, color: "text.secondary", fontSize: 10 }}>Planning estimates · Saved in this session</Typography>
      </Box>
    </Stack>
    <Box component="section" role="region" aria-label="Plan comparison map" ref={mapRef} sx={{ minWidth: 0, minHeight: 0, height: "100%", position: "relative", display: "flex", flexDirection: "column" }}>
      {plan && !plan.userAdjusted && category === "air" && <Stack direction="row" sx={{ px: 2, py: 1, bgcolor: "background.paper", borderBottom: 1, borderColor: "divider", alignItems: "center", gap: 1, flexWrap: "wrap" }}><Typography variant="caption" sx={{ flex: 1 }}>{view === "compare" ? `O: Original · Numbers: Joint · Shading follows Joint` : view === "original" ? "Original · previous repository method" : "Joint · new planning method"}</Typography><ToggleButtonGroup size="small" exclusive value={view} aria-label="Map method" onChange={(_, next) => { if (next) { setBefore(false); setView(next); setStep(plan.steps.length); } }}><ToggleButton value="original" disabled={!plan.originalPlan.metrics}>Original</ToggleButton><ToggleButton value="joint">Joint</ToggleButton><ToggleButton value="compare" disabled={!plan.originalPlan.metrics}>Both</ToggleButton></ToggleButtonGroup></Stack>}
      {plan && <Box sx={{ px: 2, py: 1, bgcolor: "background.paper", borderBottom: 1, borderColor: "divider" }}><SelectionSteps plan={plan} step={before || view === "original" ? -1 : step} onSelect={selectStep} /></Box>}
      <Box sx={{ flex: 1, minHeight: 0 }}>
        <CityMap planningCategory={category} onPlanningCategoryChange={setCategory} workspace compact focusLocation={focusLocation} includePlanned={!before} onStartPlacement={() => setBefore(false)} frameStations={frameStations} coverageStations={coverageStations}
          planningCaption={before ? category === "noise" ? "Before · historical noise sites" : "Before · installed sensors only" : plan ? `${view === "original" ? "Original" : step === 0 ? "Current" : plan.userAdjusted ? "Adjusted" : "Recommended"} ${category} coverage · ${coverageStations.length} proposed ${coverageStations.length === 1 ? "station" : "stations"} · use + / − to zoom` : "Green: near · yellow: mid-range · red: monitoring gap · use + / − to zoom"}>
          {alternativeLocation && !before && view !== "original" && <Circle center={[alternativeLocation.lat, alternativeLocation.lng]} radius={(plan?.studyArea.radiusKm ?? 2) * 1000} pathOptions={{ color: "#475569", dashArray: "3 6", weight: 2, fillOpacity: 0.02 }}><Tooltip permanent direction="top">Alternative · comparison only</Tooltip></Circle>}
          {focusLocation && !before && <Circle center={[focusLocation.lat, focusLocation.lng]} radius={100} interactive={false} pathOptions={{ color: "#6d28d9", weight: 3, fillOpacity: 0.15 }} />}
          {plan && !before && view !== "joint" && plan.originalPlan.stations.map((s, i) => <Circle key={`baseline-${s.id}`} center={[s.lat, s.lng]} radius={(plan?.studyArea.radiusKm ?? 2) * 1000} interactive={false} pathOptions={{ color: "#b45309", fillOpacity: 0.04, dashArray: "5 5" }}>{stationMarker(s, i, true)}</Circle>)}
          {plan && !before && view !== "original" && plan.jointPlan.stations.slice(0, step).map((s, i) => <Circle key={`joint-${s.id}`} center={[s.lat, s.lng]} radius={(plan?.studyArea.radiusKm ?? 2) * 1000} interactive={false} pathOptions={{ color: "#6d28d9", fillOpacity: 0.04 }}>{stationMarker(s, i, false)}</Circle>)}
        </CityMap>
      </Box>
    </Box>
    {!mobilePanelOpen && <Stack direction="row" sx={{ display: { xs: "flex", md: "none" }, position: "absolute", bottom: 24, left: 16, right: 16, gap: 1, zIndex: 1100 }}><Button variant="contained" sx={{ flex: 1, height: 44, boxShadow: "0 4px 16px #20332824" }} onClick={() => setMobilePanelOpen(true)}>Plan sensors</Button><Button variant="outlined" sx={{ bgcolor: "background.paper" }} onClick={() => setBasketOpen(true)}>Basket · {simulatedStations.length + (plan?.steps.length ?? 0)}</Button></Stack>}
    <Dialog open={preferencesOpen} onClose={() => setPreferencesOpen(false)} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>Planning preferences<IconButton aria-label="Close planning preferences" onClick={() => setPreferencesOpen(false)}><CloseRoundedIcon /></IconButton></DialogTitle>
      <DialogContent>        <Grid container spacing={3} sx={{ mt: 1, alignItems: "center" }}>
          <Grid size={12}><Typography variant="subtitle2">{category === "noise" ? "Give more priority to higher estimated nighttime noise" : "Give more priority to areas with higher estimated air pollution"}</Typography>
            <Slider value={environmentalWeight} min={0} max={3} step={0.25} valueLabelDisplay="auto" aria-label="Environmental importance" onChange={(_, value) => { reset(); setEnvironmentalWeight(value as number); }} />
            <Typography variant="caption" color="text.secondary">At zero, only extra area matters. Moving right gives {category === "noise" ? "nighttime noise" : "pollution"} estimates more influence.</Typography>
          </Grid>
          <Grid size={12}><TextField size="small" label="Keep new sensors at least this far apart (km)" type="number" value={separation} error={invalid} helperText={invalid ? "Enter a distance from 0 to 5 km." : "Avoid placing the new sensors too close together."} onChange={(event) => { reset(); setSeparation(event.target.value); }} slotProps={{ htmlInput: { min: 0, max: 5, step: 0.25 } }} fullWidth /></Grid>
        </Grid></DialogContent>
    </Dialog>
    <Drawer anchor="right" open={showDetails && Boolean(plan)} onClose={() => { setShowDetails(false); setView("joint"); if (plan) setStep(plan.steps.length); }} sx={{ zIndex: 1400 }} slotProps={{ paper: { sx: { width: { xs: "100%", sm: 500 }, maxWidth: "100%", p: 2.5 } } }}>
      <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", mb: 2 }}><Typography variant="h6">Plan evaluation</Typography><IconButton aria-label="Close plan evaluation" onClick={() => { setShowDetails(false); setView("joint"); if (plan) setStep(plan.steps.length); }}><CloseRoundedIcon /></IconButton></Stack>
      {plan && <Stack spacing={2} id="case-study-details">          <Typography variant="subtitle2">Compare the networks</Typography>
          <Stack direction="row" sx={{ gap: 1.5, flexWrap: "wrap", alignItems: "center" }}>
            {category === "air" && <ToggleButtonGroup exclusive size="small" value={view} onChange={(_, value) => { if (value) { setBefore(false); setView(value); } }} aria-label="Plan comparison">
              <ToggleButton value="original" disabled={!plan.originalPlan.metrics}>Original</ToggleButton><ToggleButton value="joint">Joint</ToggleButton><ToggleButton value="compare">Both</ToggleButton>
            </ToggleButtonGroup>}
            <Stack direction="row" sx={{ flexWrap: "wrap", gap: 0.75 }} aria-label="Selection steps">
              <Button size="small" variant={step === 0 ? "contained" : "outlined"} onClick={() => { setBefore(false); setView(view === "original" ? "joint" : view); setStep(0); setAlternativeLocation(undefined); }}>Existing</Button>
              {plan.steps.map((s, i) => <Button size="small" key={s.station.id} variant={step === i + 1 ? "contained" : "outlined"} onClick={() => { setBefore(false); setView(view === "original" ? "joint" : view); setStep(i + 1); setAlternativeLocation(undefined); }}>Step {i + 1} · +{s.marginalKm2.toFixed(2)} km²</Button>)}
            </Stack>
          </Stack>
          <Stack direction="row" sx={{ gap: 1, flexWrap: "wrap", alignItems: "center" }}>
            {category === "air" && <Chip size="small" label="O · Original method" sx={{ color: "#92400e", bgcolor: "#fff7ed" }} />}
            <Chip size="small" label={`1–${plan.steps.length} · Recommended locations`} sx={{ color: "#6d28d9", bgcolor: "#f5f3ff" }} />
            <Typography variant="caption" color="text.secondary">{view === "compare" ? "In Both view, shading follows the recommended steps." : "Shading includes the displayed plan."}</Typography>
          </Stack>
        <MethodComparison plan={plan} />
        {category === "air" && <Link href={`${plan.originalPlan.source.repository}/blob/${plan.originalPlan.source.commit}/${plan.originalPlan.source.file}`} target="_blank" rel="noopener noreferrer" variant="caption">Original source · {plan.originalPlan.source.commit.slice(0, 7)}</Link>}
        {category === "air" && plan.originalPlan.status !== "available" && <Alert severity="warning">Original returned {plan.originalPlan.stations.length} of {plan.steps.length} locations. {plan.originalPlan.status === "unavailable" ? "The original calculation is unavailable." : "This is not an equal-count comparison."}</Alert>}

        {category === "air" && <Typography variant="subtitle2">Original selection order</Typography>}
        {category === "air" && <Typography variant="caption" color="text.secondary">Preserved from the old engine; not sorted by its reported Priority Score. Added area below uses the common evaluation model.</Typography>}
        {plan.originalPlan.steps.map((item, index) => <Stack key={item.station.id} direction="row" sx={{ gap: 1, justifyContent: "space-between" }}><Typography variant="body2">O{index + 1} · {item.station.lat.toFixed(4)}, {item.station.lng.toFixed(4)}</Typography><Typography variant="body2" sx={{ fontWeight: 600 }}>+{item.marginalKm2.toFixed(2)} km²</Typography></Stack>)}
        <Box component="details"><Typography component="summary" variant="body2" sx={{ cursor: "pointer" }}>Comparison rules and limitations</Typography>{[...plan.originalPlan.warnings, ...plan.originalPlan.constraintViolations].map(text => <Typography key={text} variant="caption" component="p">{text}</Typography>)}</Box>
        <Grid container spacing={2}>
          <Grid size={12}><MetricCard title="Existing network" metrics={plan.existingMetrics} color="#64748b" /></Grid>
          <Grid size={12}><MetricCard title="Independent control · new objective" metrics={plan.independentPlan.metrics} color="#b45309" /></Grid>
        </Grid>
        <Card variant="outlined" sx={{ p: 2.5 }}>
          <Typography component="h3" variant="h6">{current ? `After adding location ${step}` : "Before adding any new sensors"}</Typography>
          <Typography variant="body2" sx={{ mt: 1 }}>{current?.explanation ?? "The independent control scores candidates using the new objective, before any new selection."}</Typography>
          <Box component="details" sx={{ mt: 2 }}><Typography component="summary" variant="subtitle1" sx={{ cursor: "pointer" }}>{current ? "Ranking after this selection" : "Independent control ranking"}</Typography>
          <TableContainer><Table size="small" aria-label="Candidate ranking">
            <TableHead><TableRow><TableCell>Candidate</TableCell><TableCell align="right">Initial control score</TableCell><TableCell align="right">Score after selection</TableCell></TableRow></TableHead>
            <TableBody>{ranking?.slice(0, 5).map((s) => <TableRow key={s.id}><TableCell>{s.name}<Typography variant="caption" component="div" color="text.secondary">{s.lat.toFixed(4)}, {s.lng.toFixed(4)}</Typography></TableCell><TableCell align="right">{s.independentWeightedGain.toFixed(2)}</TableCell><TableCell align="right">{(s.marginalWeightedGain ?? s.independentWeightedGain).toFixed(2)}</TableCell></TableRow>)}</TableBody>
          </Table></TableContainer>
          <Typography variant="caption" color="text.secondary">Scores combine extra coverage and {category === "noise" ? "estimated nighttime noise" : "estimated pollution"}. They are not km². Candidates too close to selected locations are excluded.</Typography></Box>
        </Card>
        {plan.independentPlan.constraintViolations.length > 0 && <Alert severity="warning">The independent plan has {plan.independentPlan.constraintViolations.length} station pairs closer than the selected {separation} km minimum.</Alert>}
        <Card variant="outlined" sx={{ p: 2.5 }}>
          <Typography component="h3" variant="h6">Additional check: independent versus recalculated</Typography><Typography sx={{ mt: 1 }}>{plan.tradeoff}</Typography>
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
    {basketOpen && <LocationBasket open onDiscard={reset} onClose={() => setBasketOpen(false)} plan={plan} busy={editing} onDownload={() => { if (plan) downloadBrief(plan); }} onShow={focusPin} />}
  </Box>;
}
