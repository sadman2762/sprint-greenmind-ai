import { useOptionalVoiceActions } from "../../voice/actionContext";
import { useEffect, useId, useState } from "react";
import { Box, Button, Collapse, IconButton, Paper, Popover, Stack, ToggleButton, ToggleButtonGroup, Typography, useMediaQuery, useTheme } from "@mui/material";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import RemoveIcon from "@mui/icons-material/Remove";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import LayersOutlinedIcon from "@mui/icons-material/LayersOutlined";
import {
  ALL_COVERAGE_BANDS, COVERAGE_CATEGORIES, getCoverageBands, getLegendSections, getNetworkOverview, isCoverageStation,
  type CoverageBandId, type LegendItem, type LegendOptions, type MapView,
} from "../../utils/mapLegend";
import type { SensorTier } from "../../types/budget";

type LegendMode = "hidden" | "compact" | "expanded";
const PREFERENCE_KEY = "greenmind.map.legend";

export interface MapLegendProps extends LegendOptions {
  additionalAirPlanCount?: number;
  additionalPlanCount?: number;
  additionalPlanCategory?: SensorTier;
  initialMode?: LegendMode;
  onViewChange?: (view: MapView) => void;
  onBandsChange?: (bands: CoverageBandId[]) => void;
  onShowCoverage?: () => void;
  onAddCoveragePin?: (category: SensorTier) => void;
}

function initialPreference(fallback?: LegendMode): LegendMode {
  if (fallback) return fallback;
  try {
    const saved = typeof window !== "undefined" ? window.localStorage.getItem(PREFERENCE_KEY) : null;
    if (saved === "hidden" || saved === "expanded") return saved;
  } catch {
    return "compact";
  }
  return "compact";
}

function LegendSwatch({ item }: { item: LegendItem }) {
  const isRing = item.symbol === "ring" || item.symbol === "dashed-ring";
  const isLine = item.symbol === "line";
  return (
    <Box aria-hidden="true" sx={{
      width: (theme) => theme.spacing(1.5),
      height: (theme) => theme.spacing(isLine ? 0.25 : 1.5),
      flexShrink: 0,
      borderRadius: ["area", "square", "diamond"].includes(item.symbol) || isLine ? 0.5 : "50%",
      transform: item.symbol === "diamond" ? "rotate(45deg)" : undefined,
      bgcolor: isRing || item.outlined ? "transparent" : item.color,
      border: isLine ? 0 : 1,
      borderColor: isRing || item.outlined ? item.color : "divider",
      borderStyle: item.symbol === "dashed-ring" ? "dashed" : "solid",
      outline: item.symbol === "pin" ? `1px solid ${item.color}` : undefined,
      outlineOffset: item.symbol === "pin" ? 2 : undefined,
    }} />
  );
}

export default function MapLegend({ initialMode, additionalAirPlanCount = 0, additionalPlanCount = additionalAirPlanCount, additionalPlanCategory = "air", onViewChange, onBandsChange, onShowCoverage, onAddCoveragePin, ...options }: MapLegendProps) {
  const headingId = useId();
  const [mode, setMode] = useState<LegendMode>(() => initialPreference(initialMode));
  const [infoAnchor, setInfoAnchor] = useState<HTMLElement | null>(null);
  const theme = useTheme();
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const { coverageCategory = "air", visibleBands = ALL_COVERAGE_BANDS } = options;
  const overview = options.overview ?? false;
  const bands = getCoverageBands(coverageCategory, options.hasRadiusOverrides ? 1 : options.radiusKm);
  const sections = getLegendSections(options).filter((section) => section.id !== "coverage");
  const coverageInfo = getLegendSections({ ...options, overview: false, showCoverage: true }).find((section) => section.id === "coverage");
  const networks = getNetworkOverview(options.stations, options.simulatedStations).map((network) => ({ ...network, plannedCount: network.plannedCount + (network.category === additionalPlanCategory ? additionalPlanCount : 0) }));
  const existingCount = options.stations.filter((station) => isCoverageStation(station, coverageCategory)).length;
  const plannedCount = options.simulatedStations.filter((station) => isCoverageStation(station, coverageCategory)).length + (coverageCategory === additionalPlanCategory ? additionalPlanCount : 0);
  const expanded = mode === "expanded";
  useOptionalVoiceActions("legend", { set_legend: c => { setMode(c.legendMode!); return { ok: true, message: `Map legend ${c.legendMode}.` }; } }, () => ({ mode }));

  useEffect(() => {
    try {
      window.localStorage.setItem(PREFERENCE_KEY, mode);
    } catch {
      return;
    }
  }, [mode]);

  return (
    <Paper
      component="section"
      aria-labelledby={mode === "hidden" ? undefined : headingId}
      aria-label={mode === "hidden" ? "Map legend" : undefined}
      elevation={3}
      onClick={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
      onWheel={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === "Escape") {
          event.preventDefault();
          setMode(expanded ? "compact" : "hidden");
        }
      }}
      sx={{
        position: "absolute", left: theme.spacing(2), bottom: { xs: theme.spacing(10), md: theme.spacing(3) }, zIndex: 1000,
        width: mode === "hidden" ? "auto" : theme.spacing(39),
        maxWidth: `calc(100% - ${theme.spacing(4)})`, maxHeight: "65%",
        display: "flex", flexDirection: "column", overflow: "hidden",
        border: 1, borderColor: "divider", borderRadius: 2, bgcolor: "background.paper",
      }}
    >
      {mode === "hidden" ? (
        <Button aria-label="Show map legend" startIcon={<LayersOutlinedIcon />} onClick={() => setMode("compact")} sx={{ px: 2 }}>Legend</Button>
      ) : (
        <>
          <Stack direction="row" sx={{ alignItems: "center", px: 1, py: 0.5, gap: 0.5, flexShrink: 0 }}>
            <Button
              aria-label={expanded ? "Collapse map legend" : "Expand map legend"}
              aria-expanded={expanded}
              aria-controls={`${headingId}-details`}
              onClick={() => setMode(expanded ? "compact" : "expanded")}
              startIcon={<LayersOutlinedIcon />}
              endIcon={expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              sx={{ flex: 1, justifyContent: "flex-start", textTransform: "none" }}
            >
              <Typography id={headingId} component="h3" variant="subtitle2">Map legend</Typography>
            </Button>
            <IconButton aria-label="About coverage and readings" size="small" onClick={(event) => setInfoAnchor(event.currentTarget)}><InfoOutlinedIcon fontSize="small" /></IconButton>
            <IconButton aria-label="Hide map legend" size="small" onClick={() => setMode("hidden")}><RemoveIcon /></IconButton>
          </Stack>
          <Stack spacing={1} sx={{ px: 1.5, pb: 1.5, flexShrink: 0 }}>
            <ToggleButtonGroup
              exclusive fullWidth size="small" value={overview ? "all" : coverageCategory} aria-label="Coverage category"
              onChange={(_, value: MapView | null) => { if (value) onViewChange?.(value); }}
            >
              <ToggleButton value="all" aria-label="All networks" sx={{ textTransform: "none", py: 0.5 }}>All</ToggleButton>
              {COVERAGE_CATEGORIES.map((category) => <ToggleButton key={category.value} value={category.value} aria-label={`${category.label} coverage`} sx={{ textTransform: "none", py: 0.5 }}>{category.label}</ToggleButton>)}
            </ToggleButtonGroup>
            {overview ? <Stack spacing={0.5}>
              {networks.map((network) => <Stack key={network.category} direction="row" spacing={1} sx={{ alignItems: "center" }}>
                <LegendSwatch item={{ label: network.label, color: network.color, symbol: network.symbol }} />
                <Typography variant="caption">{network.label} · {network.existingCount} existing · {network.plannedCount} planned</Typography>
              </Stack>)}
              <Typography variant="caption" color="text.secondary">Select a category to explore distance-based coverage.</Typography>
            </Stack> : <><ToggleButtonGroup
              fullWidth size="small" value={visibleBands} aria-label="Visible coverage bands"
              onChange={(_, values: CoverageBandId[]) => onBandsChange?.(values)}
            >
              {bands.map((band, index) => (
                <ToggleButton key={band.id} value={band.id} aria-label={`${band.label} coverage band`} sx={{ minWidth: 0, p: 0.75, textTransform: "none" }}>
                  <Stack spacing={0.25} sx={{ alignItems: "center" }}>
                    <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
                      <LegendSwatch item={{ label: band.label, color: band.color, symbol: "area" }} /><Typography variant="caption">{band.label}</Typography>
                    </Stack>
                    <Typography variant="caption" color="text.secondary">
                      {index === 0 ? `≤ ${band.max}` : index === 1 ? `${bands[0].max}–${band.max}` : `> ${bands[1].max}`} {options.hasRadiusOverrides ? "× radius" : "km"}
                    </Typography>
                  </Stack>
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
            <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between", gap: 0.5 }}>
              <Typography variant="caption" color="text.secondary" role="status">
                {!options.showCoverage ? "Coverage hidden" : !visibleBands.length ? "No bands selected" : !existingCount && !plannedCount ? `No ${coverageCategory} locations in feed` : `${existingCount} existing · ${plannedCount} planned${existingCount ? "" : " · Simulation only"}`}
              </Typography>
              {!options.showCoverage ? <Button size="small" onClick={onShowCoverage}>Show</Button> : !visibleBands.length ? <Button size="small" onClick={() => onBandsChange?.([...ALL_COVERAGE_BANDS])}>Show all</Button> : !existingCount && !plannedCount && onAddCoveragePin ? <Button size="small" onClick={() => onAddCoveragePin(coverageCategory)}>Add pin</Button> : null}
            </Stack>
            </>}
          </Stack>
          <Collapse in={expanded} timeout={reducedMotion ? 0 : theme.transitions.duration.shorter} unmountOnExit sx={{ overflowY: expanded ? "auto" : "hidden", overscrollBehavior: "contain", minHeight: 0, flex: "1 1 auto", borderTop: 1, borderColor: "divider" }}>
            <Stack id={`${headingId}-details`} spacing={1.5} sx={{ p: 1.5 }}>
              {sections.map((section) => (
                <Stack key={section.id} component="section" aria-labelledby={`${headingId}-${section.id}`} spacing={0.5}>
                  <Typography id={`${headingId}-${section.id}`} component="h4" variant="caption" sx={{ fontWeight: 600 }}>{section.title}</Typography>
                  <Stack component="ul" spacing={0.5} sx={{ m: 0, p: 0, listStyle: "none" }}>
                    {section.items.map((item) => (
                      <Stack key={item.label} component="li" direction="row" spacing={1} sx={{ alignItems: "center" }}>
                        <LegendSwatch item={item} /><Typography variant="caption">{item.label}</Typography>
                      </Stack>
                    ))}
                  </Stack>
                </Stack>
              ))}
            </Stack>
          </Collapse>
        </>
      )}
      <Popover open={Boolean(infoAnchor)} anchorEl={infoAnchor} onClose={() => setInfoAnchor(null)} anchorOrigin={{ vertical: "top", horizontal: "right" }} transformOrigin={{ vertical: "bottom", horizontal: "right" }}>
        <Stack spacing={1} sx={{ p: 2, maxWidth: theme.spacing(40) }}>
          <Typography variant="subtitle2">Coverage and readings</Typography>
          <Typography variant="body2">{overview ? "Colors and shapes identify sensor categories. Select air, water or noise to inspect distance-based monitoring coverage." : coverageInfo?.description}</Typography>
          <Typography variant="body2">Existing locations come from the current station feed; planned pins are simulations. Water coverage uses surface-water locations only.</Typography>
          <Typography variant="body2">PM2.5 colors describe station readings, not the background. Display bands are not regulatory limits.</Typography>
        </Stack>
      </Popover>
    </Paper>
  );
}
