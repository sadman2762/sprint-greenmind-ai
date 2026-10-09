import "leaflet/dist/leaflet.css";
import React, { useEffect, useMemo, useState } from "react";
import { Alert, Box, Button, Card, CircularProgress, Collapse, FormControlLabel, Grid, Popover, Snackbar, Stack, Switch, ToggleButton, ToggleButtonGroup, Typography, useMediaQuery, useTheme } from "@mui/material";
import AddLocationAltIcon from "@mui/icons-material/AddLocationAlt";
import LayersOutlinedIcon from "@mui/icons-material/LayersOutlined";
import CenterFocusStrongIcon from "@mui/icons-material/CenterFocusStrong";
import { Circle, MapContainer, Marker, Pane, TileLayer, Tooltip } from "react-leaflet";
import MapInspectorProvider from "../../context/MapInspectorProvider";
import { useMapInspector } from "../../context/mapInspectorState";
import { useSimulation } from "../../context/SimulationContext";
import { TIER_CONFIGS, type SensorTier } from "../../types/budget";
import type { Station } from "../../types/station";
import { getStations } from "../../services/stationService";
import { getTrafficLocations, type TrafficLocation } from "../../services/trafficService";
import { activateMapMarker, createMapMarkerIcon } from "../../utils/mapMarker";
import { cleanStationLocation, formatMeasurement, formatRecordedTime } from "../../utils/stationDetails";
import { ALL_COVERAGE_BANDS, CATEGORY_MARKERS, COVERAGE_CATEGORIES, MAX_VISIBLE_TRAFFIC_STOPS, MIN_VISIBLE_TRAFFIC_SCORE, MISSING_DATA_COLOR, RADIUS_COLORS, getPm25Color, getStationCategory, getTrafficBand, isCoverageStation, type CoverageBandId, type MapView } from "../../utils/mapLegend";
import CoverageHeatmap from "./CoverageHeatmap";
import DebrecenBoundary from "./DebrecenBoundary";
import MapBoundsController from "./MapBoundsController";
import MapLegend from "./MapLegend";
import MapFeatureDetails from "./MapFeatureDetails";
import MapInspectorPanel from "./MapInspectorPanel";
import StationDetails from "./StationDetails";
import SimulatedSensorLayer from "./SimulatedSensorLayer";
import CustomPinLayer from "./CustomPinLayer";
import MapClickHandler from "./MapClickHandler";

const StationHalosLayer = React.memo(function StationHalosLayer({ stations, view }: { stations: Station[]; view: MapView }) {
  return <>{stations.map((station) => {
    const category = getStationCategory(station);
    if (!category || !isCoverageStation(station, category)) return null;
    const color = view === "all" ? CATEGORY_MARKERS[category].color : RADIUS_COLORS.existing.stroke;
    return <Circle key={`coverage-${station.id}`} center={[station.lat, station.lng]} radius={TIER_CONFIGS[category].radiusKm * 1000} interactive={false} pathOptions={{ color, fillColor: color, fillOpacity: 0.025, opacity: 0.5, weight: 1 }} />;
  })}</>;
});

const TrafficMarkersLayer = React.memo(function TrafficMarkersLayer({ locations }: { locations: TrafficLocation[] }) {
  const { selection, select } = useMapInspector();
  return <>{locations.map((location) => {
    const featureId = `traffic-${location.stopName}-${location.latitude}-${location.longitude}`;
    const color = getTrafficBand(location.trafficActivityScore)?.color ?? MISSING_DATA_COLOR;
    const measurements = [
      { label: "Activity index", value: formatMeasurement(location.trafficActivityScore, "/ 100") },
      { label: "Total frequency", value: formatMeasurement(location.passengerFrequencyTotal, "", 0) },
      { label: "Boarding", value: formatMeasurement(location.passengersInTotal, "", 0) },
      { label: "Alighting", value: formatMeasurement(location.passengersOutTotal, "", 0) },
    ];
    return (
      <Marker key={featureId} position={[location.latitude, location.longitude]} title={location.stopName}
        icon={createMapMarkerIcon(color, selection?.id === featureId, Math.max(8, Math.min(22, 8 + location.trafficActivityScore / 6)))}
        eventHandlers={{ keydown: activateMapMarker, click: (event) => select({ id: featureId, title: location.stopName, subtitle: "DKV transit stop" }, event.target.getElement()) }}>
        <Tooltip>{location.stopName} · Activity {Math.round(location.trafficActivityScore)}</Tooltip>
        <MapFeatureDetails featureId={featureId}>
          {/* 2x2 Traffic Metrics Grid */}
          <Grid container spacing={2}>
            {measurements.map((measurement) => <Grid key={measurement.label} size={6}>
              <Typography variant="caption" color="text.secondary">{measurement.label}</Typography>
              <Typography variant="body1" sx={{ fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{measurement.value}</Typography>
            </Grid>)}
          </Grid>
          {/* Coordinates Footer */}
          <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 3 }}>{location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}</Typography>
        </MapFeatureDetails>
      </Marker>
    );
  })}</>;
});

const ImplementedStationsLayer = React.memo(function ImplementedStationsLayer({ stations, view }: { stations: Station[]; view: MapView }) {
  const { selection, select } = useMapInspector();
  return <>{stations.map((station) => {
    const category = getStationCategory(station);
    if (!category) return null;
    const presentation = CATEGORY_MARKERS[category];
    const color = view === "air" ? getPm25Color(station.pm25) : presentation.color;
    const featureId = `station-${station.id}`;
    return (
      <Marker key={station.id} position={[station.lat, station.lng]} title={station.name}
        icon={createMapMarkerIcon(color, selection?.id === featureId, 18, presentation.symbol)}
        eventHandlers={{ keydown: activateMapMarker, click: (event) => select({
          id: featureId, title: cleanStationLocation(station.name),
          subtitle: `${category === "water" ? "Surface-water station" : "Air station"}${station.stationCode ? ` · ${station.stationCode}` : ""}`,
          description: formatRecordedTime(station.timestamp),
        }, event.target.getElement()) }}>
        <Tooltip>{station.name} · {category === "water" ? "Surface water" : `PM2.5 ${formatMeasurement(station.pm25, "µg/m³")}`}</Tooltip>
        <MapFeatureDetails featureId={featureId}><StationDetails station={station} /></MapFeatureDetails>
      </Marker>
    );
  })}</>;
});

const EMPTY_STATIONS: Station[] = [];
interface CityMapProps {
  children?: React.ReactNode;
  coverageStations?: Station[];
  frameStations?: Station[];
  compact?: boolean;
  workspace?: boolean;
  onStartPlacement?: () => void;
  planningCaption?: string;
  includePlanned?: boolean;
  focusLocation?: { lat: number; lng: number; token: number };
}

function CityMapWorkspace({ children, coverageStations = EMPTY_STATIONS, frameStations = EMPTY_STATIONS, compact = false, workspace = false, onStartPlacement, planningCaption, includePlanned = true, focusLocation }: CityMapProps) {
  const { selection } = useMapInspector();
  const [resetKey, setResetKey] = useState(0);
  const [layersAnchor, setLayersAnchor] = useState<HTMLElement | null>(null);
  const [stations, setStations] = useState<Station[]>([]);
  const [trafficLocations, setTrafficLocations] = useState<TrafficLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [trafficError, setTrafficError] = useState("");
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [showStations, setShowStations] = useState(true);
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [view, setView] = useState<MapView>("air");
  const [visibleBands, setVisibleBands] = useState<CoverageBandId[]>(ALL_COVERAGE_BANDS);
  const [showTraffic, setShowTraffic] = useState(false);
  const [showCoverageCircles, setShowCoverageCircles] = useState(false);
  const { simulatedStations, isPlacingCustomPin, setIsPlacingCustomPin, customPinTier, setCustomPinTier } = useSimulation();
  const [notification, setNotification] = useState<{ message: string; severity: "success" | "warning" | "info" } | null>(null);
  const theme = useTheme();
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const overview = view === "all";
  const coverageCategory = overview ? "air" : view;

  useEffect(() => {
    const controller = new AbortController();
    Promise.allSettled([getStations(controller.signal), getTrafficLocations(controller.signal)])
      .then(([stationData, trafficData]) => {
        if (controller.signal.aborted) return;
        if (stationData.status === "fulfilled") setStations(stationData.value);
        else setError("Station data is unavailable. Check that the local backend is running, then retry.");
        if (trafficData.status === "fulfilled") { setTrafficLocations(trafficData.value); setTrafficError(""); }
        else setTrafficError("DKV transit data is unavailable. Station and coverage layers are still available.");
        setLoading(false);
      });
    return () => controller.abort();
  }, [loadAttempt]);

  const effectiveStations = useMemo(() => [...stations, ...(includePlanned ? simulatedStations : []), ...coverageStations], [stations, simulatedStations, coverageStations, includePlanned]);
  const mapFrameStations = useMemo(() => [...stations, ...frameStations], [stations, frameStations]);
  const visibleStations = useMemo(() => stations.filter((station) => {
    const category = getStationCategory(station);
    return category && isCoverageStation(station, category) && (view === "all" || category === view);
  }), [stations, view]);
  const visibleTraffic = useMemo(() => trafficLocations.filter((location) =>
    Number.isFinite(location.latitude) && Number.isFinite(location.longitude) && Number.isFinite(location.trafficActivityScore) && location.trafficActivityScore >= MIN_VISIBLE_TRAFFIC_SCORE)
    .sort((a, b) => b.trafficActivityScore - a.trafficActivityScore).slice(0, MAX_VISIBLE_TRAFFIC_STOPS), [trafficLocations]);
  const activeTier = TIER_CONFIGS[customPinTier];

  function changeView(next: MapView) {
    setView(next);
    setIsPlacingCustomPin(false);
    if (next === "all") setResetKey((value) => value + 1);
    else setShowHeatmap(true);
  }

  if (loading) return <Card sx={{ height: workspace ? "100%" : "auto", display: "grid", placeItems: "center", p: 6 }}><CircularProgress aria-label="Loading monitoring map" /></Card>;
  if (error) return <Alert severity="error" sx={{ mt: 3 }} action={<Button color="inherit" onClick={() => { setError(""); setLoading(true); setLoadAttempt((value) => value + 1); }}>Retry map</Button>}>{error}</Alert>;

  return (
    <Card variant="outlined" sx={{ mt: compact ? 0 : 3, borderRadius: workspace ? 0 : 3, border: workspace ? 0 : undefined, overflow: "hidden", height: workspace ? "100%" : undefined, display: "flex", flexDirection: "column" }}>
      {showTraffic && trafficError && <Alert severity="warning">{trafficError}</Alert>}
      <Stack direction="row" sx={{ px: 2, py: 1.25, minHeight: 60, borderBottom: 1, borderColor: "divider", alignItems: "center", justifyContent: "space-between", gap: 1, flexWrap: "wrap", flexShrink: 0 }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="subtitle2">{overview ? "All monitoring networks" : `${COVERAGE_CATEGORIES.find(item => item.value === view)?.label ?? "Air"} monitoring`}</Typography>
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10 }}>{view === "air" && planningCaption ? planningCaption.split(" · use")[0] : "Explore stations and coverage"}</Typography>
        </Box>
        <Stack direction="row" sx={{ gap: 0.75 }}>
          <Button size="small" startIcon={<LayersOutlinedIcon />} aria-expanded={Boolean(layersAnchor)} onClick={event => setLayersAnchor(event.currentTarget)} sx={{ color: "text.secondary" }}>Layers</Button>
          <Button variant={isPlacingCustomPin ? "contained" : "outlined"} size="small" startIcon={<AddLocationAltIcon />} onClick={() => { if (!isPlacingCustomPin) onStartPlacement?.(); setIsPlacingCustomPin(value => !value); }}>{isPlacingCustomPin ? "Cancel placement" : "Add sensor"}</Button>
        </Stack>
      </Stack>
      <Popover open={Boolean(layersAnchor)} anchorEl={layersAnchor} onClose={() => setLayersAnchor(null)} anchorOrigin={{ vertical: "bottom", horizontal: "right" }} transformOrigin={{ vertical: "top", horizontal: "right" }}>
        <Stack sx={{ p: 2, minWidth: 240, gap: 0.5 }}>
          <Typography variant="subtitle2" sx={{ mb: 0.5 }}>Map layers</Typography>
          <FormControlLabel sx={{ m: 0 }} control={<Switch size="small" checked={showStations} onChange={event => setShowStations(event.target.checked)} />} label={<Typography variant="body2">Stations</Typography>} />
          {!overview && <FormControlLabel sx={{ m: 0 }} control={<Switch size="small" checked={showHeatmap} onChange={event => setShowHeatmap(event.target.checked)} />} label={<Typography variant="body2">Monitoring coverage</Typography>} />}
          <FormControlLabel sx={{ m: 0 }} control={<Switch size="small" checked={showTraffic} onChange={event => setShowTraffic(event.target.checked)} />} label={<Typography variant="body2">DKV Transit</Typography>} />
          <FormControlLabel sx={{ m: 0 }} control={<Switch size="small" checked={showCoverageCircles} onChange={event => setShowCoverageCircles(event.target.checked)} />} label={<Typography variant="body2">Coverage outlines</Typography>} />
          <Button size="small" startIcon={<CenterFocusStrongIcon />} onClick={() => { setResetKey(value => value + 1); setLayersAnchor(null); }} sx={{ mt: 1 }}>Reset view</Button>
        </Stack>
      </Popover>
      <Collapse in={isPlacingCustomPin} timeout={reducedMotion ? 0 : theme.transitions.duration.shorter} unmountOnExit sx={{ flexShrink: 0 }}>
        <Stack sx={{ p: 1.5, gap: 1 }}>
          <ToggleButtonGroup exclusive size="small" value={customPinTier} aria-label="Sensor type to place" onChange={(_, value: SensorTier | null) => { if (value) setCustomPinTier(value); }}>
            {COVERAGE_CATEGORIES.map(({ value, label }) => <ToggleButton key={value} value={value} aria-label={`Place ${label.toLowerCase()} sensor`}>{label}</ToggleButton>)}
          </ToggleButtonGroup>
        </Stack>
      </Collapse>
      {/* Pin Mode Helper Banner */}
      {isPlacingCustomPin && <Typography component="p" variant="body2" sx={{ m: 0, px: 2, py: 1, bgcolor: "action.hover" }}>Click the map to place this {activeTier.name.toLowerCase()}. Drag the marker to adjust.</Typography>}
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", md: selection ? "minmax(0, 1fr) 340px" : "minmax(0, 1fr)" }, alignItems: "stretch", flex: workspace ? 1 : undefined, minHeight: 0, position: "relative" }}>
        {/* 2. Map Container with 100% Unobstructed Surface */}
        <Box sx={{
          position: "relative", minWidth: 0, height: workspace ? "100%" : compact ? { xs: 400, md: "clamp(380px, 48vh, 540px)" } : { xs: "60dvh", md: "68vh" }, minHeight: workspace ? 0 : theme.spacing(40),
          "& .leaflet-tile-pane": { filter: "saturate(0.38) contrast(0.94) brightness(1.04)" },
          "& .leaflet-control-zoom": { border: "1px solid #dce3de", borderRadius: "8px", overflow: "hidden", boxShadow: "0 2px 8px #20332814" },
          "& .leaflet-tooltip": { width: "max-content", maxWidth: theme.spacing(32), whiteSpace: "normal" },
          "& .map-marker-symbol": { boxShadow: `0 0 0 2px ${theme.palette.background.paper}` },
          "& .leaflet-marker-icon.is-selected": { boxShadow: `0 0 0 2px ${theme.palette.background.paper}, 0 0 0 5px ${theme.palette.primary.main}`, borderRadius: "50%" },
          "& .leaflet-marker-icon:focus-visible": { outline: `3px solid ${theme.palette.primary.main}`, outlineOffset: 3, borderRadius: "50%" },
        }}>
          <MapContainer center={[47.5316, 21.6273]} zoom={10} minZoom={9} maxZoom={16} maxBoundsViscosity={0.3} scrollWheelZoom={workspace} preferCanvas style={{ height: "100%", width: "100%" }}>
            <TileLayer attribution="© OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <DebrecenBoundary />
            <MapBoundsController focusLocation={focusLocation} stations={mapFrameStations} resetStations={[...mapFrameStations, ...simulatedStations]} resetKey={resetKey} />
            {!overview && showHeatmap && <Pane name="coverage-grid"><CoverageHeatmap stations={effectiveStations} category={coverageCategory} visibleBands={visibleBands} /></Pane>}
            {showCoverageCircles && <StationHalosLayer stations={visibleStations} view={view} />}
            {showTraffic && <TrafficMarkersLayer locations={visibleTraffic} />}
            {showStations && <ImplementedStationsLayer stations={visibleStations} view={view} />}
            {includePlanned && <SimulatedSensorLayer stations={stations} view={view} showHalos={showCoverageCircles} />}
            {includePlanned && <CustomPinLayer stations={stations} view={view} showHalos={showCoverageCircles} />}
            {(overview || view === "air") && children}
            <MapClickHandler stations={stations}
              onInvalidLocation={() => setNotification({ message: "Choose a location inside the study boundary.", severity: "warning" })}
              onPinAdded={(_lat, _lng, tier) => { setIsPlacingCustomPin(false); setNotification({ message: `${TIER_CONFIGS[tier].name} added to the plan.`, severity: "success" }); }} />
          </MapContainer>
          <MapLegend additionalAirPlanCount={coverageStations.length} showStations={showStations} showCoverage={showHeatmap} showTraffic={showTraffic} showRadius={showCoverageCircles}
            overview={overview} coverageCategory={coverageCategory} visibleBands={visibleBands} onViewChange={changeView}
            onBandsChange={(bands) => { setVisibleBands(bands); setShowHeatmap(true); }} onShowCoverage={() => setShowHeatmap(true)}
            onAddCoveragePin={(category) => { onStartPlacement?.(); setCustomPinTier(category); setIsPlacingCustomPin(true); }} stations={stations} simulatedStations={includePlanned ? simulatedStations : []} />
        </Box>
        {/* 3. Selected Station Deep Telemetry Inspector Dock */}
        {/* Wide Telemetry Metrics Grid */}
        <MapInspectorPanel compact={compact} workspace={workspace} />
      </Box>
      <Snackbar open={Boolean(notification)} autoHideDuration={4500} onClose={() => setNotification(null)} anchorOrigin={{ vertical: "bottom", horizontal: "center" }}>
        {notification ? <Alert severity={notification.severity} onClose={() => setNotification(null)}>{notification.message}</Alert> : undefined}
      </Snackbar>
    </Card>
  );
}

export default function CityMap(props: CityMapProps) {
  return <MapInspectorProvider><CityMapWorkspace {...props} /></MapInspectorProvider>;
}
