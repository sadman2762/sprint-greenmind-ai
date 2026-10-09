import { TIER_CONFIGS, type SensorTier } from "../types/budget.ts";

export const MISSING_DATA_COLOR = "#9e9e9e";
export const SURFACE_WATER_COLOR = "#1976d2";
export const BOUNDARY_COLOR = "#1565c0";
export const COVERAGE_RADIUS_KM = TIER_CONFIGS.air.radiusKm;
export const MIN_VISIBLE_TRAFFIC_SCORE = 10;
export const MAX_VISIBLE_TRAFFIC_STOPS = 40;
export const RADIUS_COLORS = {
  existing: { stroke: "#2e7d32", fill: "#66bb6a" },
  simulated: { stroke: "#8e24aa", fill: "#ba68c8" },
};

export const PM25_BANDS = [
  { max: 10, label: "Low", color: "#2ecc71" },
  { max: 20, label: "Moderate", color: "#f1c40f" },
  { max: 35, label: "High", color: "#e67e22" },
  { max: Infinity, label: "Very high", color: "#e74c3c" },
];

export type MapView = "all" | SensorTier;
export type MarkerSymbol = "dot" | "square" | "diamond";
export const CATEGORY_MARKERS: Record<SensorTier, { color: string; symbol: MarkerSymbol }> = {
  air: { color: TIER_CONFIGS.air.color, symbol: "dot" },
  water: { color: TIER_CONFIGS.water.color, symbol: "square" },
  noise: { color: TIER_CONFIGS.noise.color, symbol: "diamond" },
};
export type CoverageBandId = "near" | "intermediate" | "gap";
export const ALL_COVERAGE_BANDS: CoverageBandId[] = ["near", "intermediate", "gap"];
export const COVERAGE_CATEGORIES: { value: SensorTier; label: string }[] = [
  { value: "air", label: "Air" },
  { value: "water", label: "Water" },
  { value: "noise", label: "Noise" },
];
export const COVERAGE_BANDS: { id: CoverageBandId; max: number; label: string; color: string; opacity: number }[] = [
  { id: "near", max: COVERAGE_RADIUS_KM, label: "Near", color: "#2e7d32", opacity: 0.12 },
  { id: "intermediate", max: COVERAGE_RADIUS_KM * 2, label: "Mid-range", color: "#f9a825", opacity: 0.15 },
  { id: "gap", max: Infinity, label: "Gap", color: "#d32f2f", opacity: 0.18 },
];

export function getCoverageBands(category: SensorTier = "air", radiusKm = TIER_CONFIGS[category].radiusKm) {
  if (category === "air" && radiusKm === COVERAGE_RADIUS_KM) return COVERAGE_BANDS;
  return COVERAGE_BANDS.map((band, index) => ({ ...band, max: index < 2 ? Number((radiusKm * (index + 1)).toFixed(3)) : Infinity }));
}

export const TRAFFIC_BANDS = [
  { min: 50, label: "Very high", color: "#4527a0" },
  { min: 25, label: "High", color: "#7e57c2" },
  { min: MIN_VISIBLE_TRAFFIC_SCORE, label: "Moderate", color: "#971e22" },
];

export function getPm25Color(value?: number | null): string {
  if (value == null || !Number.isFinite(value) || value < 0) return MISSING_DATA_COLOR;
  return PM25_BANDS.find((band) => value <= band.max)!.color;
}

export function getCoverageBand(distanceKm: number, category: SensorTier = "air", radiusKm = TIER_CONFIGS[category].radiusKm) {
  if (!Number.isFinite(distanceKm) || distanceKm < 0) return null;
  return getCoverageBands(category, radiusKm).find((band) => distanceKm <= band.max)!;
}

export function getTrafficBand(score: number) {
  if (!Number.isFinite(score)) return null;
  return TRAFFIC_BANDS.find((band) => score >= band.min) ?? null;
}

interface LegendStation {
  station_type: number;
  lat: number;
  lng: number;
  sensorTier?: SensorTier;
}

export function getStationCategory(station: LegendStation): SensorTier | null {
  return station.sensorTier ?? (station.station_type === 0 ? "air" : station.station_type === 1 ? "water" : null);
}

export function isCoverageStation(station: LegendStation, category: SensorTier): boolean {
  return getStationCategory(station) === category && Number.isFinite(station.lat) && Number.isFinite(station.lng);
}

export function getNetworkOverview(stations: readonly LegendStation[], simulatedStations: readonly LegendStation[]) {
  return COVERAGE_CATEGORIES.map(({ value, label }) => ({
    category: value,
    label,
    ...CATEGORY_MARKERS[value],
    existingCount: stations.filter((station) => isCoverageStation(station, value)).length,
    plannedCount: simulatedStations.filter((station) => isCoverageStation(station, value)).length,
  }));
}

export function isAirCoverageStation(station: LegendStation): boolean {
  return isCoverageStation(station, "air");
}

export interface LegendOptions {
  radiusKm?: number;
  radiiKm?: Partial<Record<SensorTier, number>>;
  hasRadiusOverrides?: boolean;
  showStations: boolean;
  showCoverage: boolean;
  showTraffic: boolean;
  showRadius: boolean;
  coverageCategory?: SensorTier;
  overview?: boolean;
  visibleBands?: readonly CoverageBandId[];
  stations: readonly LegendStation[];
  simulatedStations: readonly LegendStation[];
}

export interface LegendItem {
  label: string;
  color: string;
  symbol: MarkerSymbol | "area" | "line" | "ring" | "dashed-ring" | "pin";
  outlined?: boolean;
}

export interface LegendSection {
  id: string;
  title: string;
  description: string;
  items: LegendItem[];
}

function rangeLabel(max: number, previous?: number, unit = ""): string {
  if (!Number.isFinite(max)) return `> ${previous}${unit}`;
  return previous === undefined ? `≤ ${max}${unit}` : `> ${previous}–${max}${unit}`;
}

export function getLegendSections(options: LegendOptions): LegendSection[] {
  const { stations, simulatedStations, coverageCategory = "air", visibleBands = ALL_COVERAGE_BANDS } = options;
  const hasExistingAir = stations.some(isAirCoverageStation);
  const hasExistingCoverage = stations.some((station) => isCoverageStation(station, coverageCategory));
  const hasSimulatedCoverage = simulatedStations.some((station) => isCoverageStation(station, coverageCategory));
  const bands = getCoverageBands(coverageCategory, options.hasRadiusOverrides ? 1 : options.radiusKm);
  const categoryLabel = COVERAGE_CATEGORIES.find((category) => category.value === coverageCategory)!.label;
  const radius = options.hasRadiusOverrides ? "individual" : (options.radiusKm ?? TIER_CONFIGS[coverageCategory].radiusKm);
  const sections: LegendSection[] = [];

  if (options.overview) {
    sections.push({
      id: "networks", title: "Network overview",
      description: "Colors and shapes identify sensor categories, not pollution. Hollow markers are planned sensors.",
      items: getNetworkOverview(stations, simulatedStations).map((network) => ({
        label: `${network.label} · ${network.existingCount ? `${network.existingCount} existing` : "not in feed"} · ${network.plannedCount} planned`,
        color: network.color, symbol: network.symbol,
      })),
    });
  }

  if (options.showCoverage && !options.overview) {
    sections.push({
      id: "coverage",
      title: `${categoryLabel} coverage`,
      description: hasExistingCoverage || hasSimulatedCoverage
        ? `Distance to ${coverageCategory} locations, not pollution. Radii are planning assumptions${coverageCategory === "water" ? ", not hydrological catchments" : ""}.`
        : `No ${coverageCategory} locations in the current feed. Add a simulated ${coverageCategory} sensor to preview coverage.`,
      items: hasExistingCoverage || hasSimulatedCoverage ? bands.flatMap((band, index) => visibleBands.includes(band.id) ? [{
        label: `${band.label} · ${rangeLabel(band.max, bands[index - 1]?.max, options.hasRadiusOverrides ? " × sensor radius" : " km")}`,
        color: band.color,
        symbol: "area" as const,
      }] : []) : [],
    });
  }

  if (options.showStations && !options.overview) {
    const items: LegendItem[] = hasExistingAir && coverageCategory === "air" ? PM25_BANDS.map((band, index) => ({
      label: `${band.label} · ${rangeLabel(band.max, PM25_BANDS[index - 1]?.max)}`,
      color: band.color,
      symbol: "dot",
    })) : [];
    if (hasExistingAir && coverageCategory === "air") items.push({ label: "Missing / invalid PM2.5", color: MISSING_DATA_COLOR, symbol: "dot" });
    if (coverageCategory !== "air" && hasExistingCoverage) {
      items.push({ label: `${categoryLabel} station`, ...CATEGORY_MARKERS[coverageCategory] });
    }
    sections.push({
      id: "stations",
      title: coverageCategory === "air" ? "PM2.5 · µg/m³" : `${categoryLabel} stations`,
      description: items.length ? "Marker colors use application display bands, not regulatory limits." : "No station markers available.",
      items,
    });
  }

  const visibleSimulations = options.overview ? simulatedStations : simulatedStations.filter((station) => isCoverageStation(station, coverageCategory));
  if (visibleSimulations.length) {
    const tiers = [...new Set(visibleSimulations.map((station) => station.sensorTier ?? "air"))];
    sections.push({
      id: "simulation",
      title: "Planned sensors",
      description: "Hollow markers are planned sensors, not measurements. Coverage outlines are optional planning footprints.",
      items: tiers.map((tier) => ({
        label: `${TIER_CONFIGS[tier].name}${options.showRadius ? ` · ${(options.radiiKm?.[tier] ?? TIER_CONFIGS[tier].radiusKm)} km category default` : ""}`,
        ...CATEGORY_MARKERS[tier], outlined: true,
      })),
    });
  }

  if (options.showTraffic) {
    sections.push({
      id: "transit",
      title: "Transit · activity score",
      description: `Up to ${MAX_VISIBLE_TRAFFIC_STOPS} highest-scoring stops with score ≥ ${MIN_VISIBLE_TRAFFIC_SCORE}. Larger circles mean higher activity, not pollution.`,
      items: TRAFFIC_BANDS.map((band, index) => ({
        label: `${band.label} · ${index === 0 ? `≥ ${band.min}` : `${band.min} to < ${TRAFFIC_BANDS[index - 1].min}`}`,
        color: band.color,
        symbol: "dot",
      })),
    });
  }

  if (options.showRadius && options.overview) {
    sections.push({ id: "radius", title: "Coverage outlines", description: "Planning footprints, not measured detection ranges or hydrological catchments.", items: getNetworkOverview(stations, simulatedStations)
      .filter((network) => network.existingCount + network.plannedCount > 0)
      .map((network) => ({ label: `${network.label} · ${(options.radiiKm?.[network.category] ?? TIER_CONFIGS[network.category].radiusKm)} km category default`, color: network.color, symbol: "ring" })) });
  }

  if (options.showRadius && !options.overview && (hasExistingCoverage || hasSimulatedCoverage)) {
    const items: LegendItem[] = [];
    if (hasExistingCoverage) items.push({ label: `Existing · ${radius}${options.hasRadiusOverrides ? " radii" : " km"}`, color: RADIUS_COLORS.existing.stroke, symbol: "ring" });
    if (hasSimulatedCoverage) items.push({ label: `Planned · ${radius}${options.hasRadiusOverrides ? " radii" : " km"}`, color: CATEGORY_MARKERS[coverageCategory].color, symbol: "dashed-ring" });
    sections.push({
      id: "radius",
      title: `${categoryLabel} radius`,
      description: "Assumed planning footprint, not a measured detection range.",
      items,
    });
  }

  sections.push({
    id: "boundary",
    title: "Study boundary",
    description: "Boundary used by this application.",
    items: [{ label: "Study-area outline", color: BOUNDARY_COLOR, symbol: "line" }],
  });
  return sections;
}
