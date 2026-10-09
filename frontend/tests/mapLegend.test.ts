import assert from "node:assert/strict";
import { test } from "node:test";
import {
  COVERAGE_BANDS,
  MISSING_DATA_COLOR,
  PM25_BANDS,
  TRAFFIC_BANDS,
  getCoverageBand,
  getCoverageBands,
  isCoverageStation,
  getLegendSections,
  getPm25Color,
  getTrafficBand,
  type LegendOptions,
} from "../src/utils/mapLegend.ts";

const base: LegendOptions = {
  showStations: true,
  showCoverage: true,
  showTraffic: false,
  showRadius: false,
  stations: [{ station_type: 0, lat: 47.53, lng: 21.63 }],
  simulatedStations: [],
};

test("overview explains network categories without blending pollution or distance scales", () => {
  const sections = getLegendSections({ ...base, overview: true });
  assert.ok(!sections.some((section) => section.id === "coverage"));
  assert.ok(!sections.some((section) => section.title.includes("PM2.5")));
  const networks = sections.find((section) => section.id === "networks")!;
  assert.equal(networks.items.length, 3);
  assert.match(networks.items[2].label, /not in feed/i);
  assert.equal(networks.items[1].symbol, "square");
  assert.equal(networks.items[2].symbol, "diamond");
});

test("coverage uses exact distance boundaries rather than rounded scores", () => {
  for (const [distance, index] of [[0, 0], [2, 0], [2.001, 1], [4, 1], [4.001, 2], [100, 2]]) {
    assert.equal(getCoverageBand(distance), COVERAGE_BANDS[index]);
  }
});

test("each category uses its own planning radius", () => {
  assert.equal(getCoverageBands("air")[0].max, 2);
  assert.equal(getCoverageBands("water")[0].max, 1.5);
  assert.equal(getCoverageBands("noise")[0].max, 1);
  assert.equal(getCoverageBand(1.5, "water")?.id, "near");
  assert.equal(getCoverageBand(1.501, "water")?.id, "intermediate");
  assert.equal(getCoverageBand(3.001, "water")?.id, "gap");
  assert.equal(getCoverageBand(1.001, "noise")?.id, "intermediate");
  assert.equal(getCoverageBand(2.001, "noise")?.id, "gap");
});

test("category selection uses compatible existing and simulated stations only", () => {
  const air = { station_type: 0, lat: 47.53, lng: 21.63 };
  const water = { ...air, station_type: 1 };
  assert.equal(isCoverageStation(air, "noise"), false);
  assert.equal(isCoverageStation(water, "water"), true);
  assert.equal(isCoverageStation(water, "air"), false);
  assert.equal(isCoverageStation({ ...air, sensorTier: "noise" }, "noise"), true);
  assert.equal(isCoverageStation({ ...air, sensorTier: "noise" }, "air"), false);
});

test("noise selection reports unavailable locations instead of showing air coverage", () => {
  const coverage = getLegendSections({ ...base, coverageCategory: "noise" }).find((section) => section.id === "coverage")!;
  assert.equal(coverage.items.length, 0);
  assert.match(coverage.description, /no noise locations/i);
});

test("invalid distances do not imply coverage", () => {
  for (const distance of [-1, NaN, Infinity, -Infinity]) {
    assert.equal(getCoverageBand(distance), null);
  }
});

test("PM2.5 colors use the same exact bands as the station legend", () => {
  for (const [value, index] of [[0, 0], [10, 0], [10.01, 1], [20, 1], [20.01, 2], [35, 2], [35.01, 3]]) {
    assert.equal(getPm25Color(value), PM25_BANDS[index].color);
  }
  for (const value of [undefined, null, NaN, Infinity, -1]) {
    assert.equal(getPm25Color(value), MISSING_DATA_COLOR);
  }
});

test("transit bands agree with the visible-score threshold", () => {
  assert.equal(getTrafficBand(9.99), null);
  assert.equal(getTrafficBand(NaN), null);
  assert.equal(getTrafficBand(10), TRAFFIC_BANDS[2]);
  assert.equal(getTrafficBand(25), TRAFFIC_BANDS[1]);
  assert.equal(getTrafficBand(50), TRAFFIC_BANDS[0]);
});

test("all layer-toggle combinations control only their own legend sections", () => {
  for (let mask = 0; mask < 16; mask++) {
    const options = {
      ...base,
      showStations: Boolean(mask & 1),
      showCoverage: Boolean(mask & 2),
      showTraffic: Boolean(mask & 4),
      showRadius: Boolean(mask & 8),
    };
    const ids = getLegendSections(options).map((section) => section.id);
    assert.equal(ids.includes("stations"), options.showStations);
    assert.equal(ids.includes("coverage"), options.showCoverage);
    assert.equal(ids.includes("transit"), options.showTraffic);
    assert.equal(ids.includes("radius"), options.showRadius);
    assert.ok(ids.includes("boundary"));
  }
});

test("coverage and pollution have distinct explanations and swatches", () => {
  const sections = getLegendSections(base);
  const coverage = sections.find((section) => section.id === "coverage")!;
  const stations = sections.find((section) => section.id === "stations")!;
  assert.match(coverage.description, /not pollution/i);
  assert.match(stations.title, /PM2.5.*µg\/m³/);
  assert.deepEqual(coverage.items.map((item) => item.color), COVERAGE_BANDS.map((band) => band.color));
  assert.ok(coverage.items.every((item) => item.symbol === "area"));
  assert.ok(stations.items.every((item) => item.symbol === "dot"));
  assert.ok(coverage.items.some((item) => item.label.includes("≤ 2 km")));
  assert.ok(coverage.items.some((item) => item.label.includes("> 4 km")));
});

test("hidden bands are excluded from the active coverage key", () => {
  const coverage = getLegendSections({ ...base, visibleBands: ["gap"] }).find((section) => section.id === "coverage")!;
  assert.equal(coverage.items.length, 1);
  assert.match(coverage.items[0].label, /Gap/);
  assert.equal(getLegendSections({ ...base, visibleBands: [] }).find((section) => section.id === "coverage")!.items.length, 0);
});

test("water-only networks do not claim an air-coverage background", () => {
  const sections = getLegendSections({ ...base, stations: [{ station_type: 1, lat: 47.53, lng: 21.63 }] });
  const coverage = sections.find((section) => section.id === "coverage")!;
  assert.equal(coverage.items.length, 0);
  assert.match(coverage.description, /no air locations/i);
  assert.equal(sections.find((section) => section.id === "stations")!.items.length, 0);
  const waterSections = getLegendSections({ ...base, coverageCategory: "water", stations: [{ station_type: 1, lat: 47.53, lng: 21.63 }] });
  assert.ok(waterSections.find((section) => section.id === "stations")!.items.some((item) => item.label === "Water station"));
});

test("simulation legends remain while ordinary station markers are hidden", () => {
  const sections = getLegendSections({
    ...base,
    showStations: false,
    coverageCategory: "water",
    showRadius: true,
    simulatedStations: [
      { station_type: 0, lat: 47.53, lng: 21.63, sensorTier: "water" },
      { station_type: 0, lat: 47.54, lng: 21.64, sensorTier: "water" },
    ],
  });
  assert.ok(!sections.some((section) => section.id === "stations"));
  const simulation = sections.find((section) => section.id === "simulation")!;
  assert.equal(simulation.items.length, 1);
  assert.match(simulation.items[0].label, /Water.*1.5 km/);
  assert.match(simulation.description, /not measurements/);
});

test("simulated water and noise do not count as air coverage", () => {
  const sections = getLegendSections({
    ...base,
    stations: [],
    showRadius: true,
    simulatedStations: [{ station_type: 0, lat: 47.53, lng: 21.63, sensorTier: "noise" }],
  });
  assert.equal(sections.find((section) => section.id === "coverage")!.items.length, 0);
  assert.ok(!sections.some((section) => section.id === "radius"));
});

test("simulated air supplies coverage and a dashed reference radius", () => {
  const sections = getLegendSections({
    ...base,
    stations: [],
    showRadius: true,
    simulatedStations: [{ station_type: 0, lat: 47.53, lng: 21.63, sensorTier: "air" }],
  });
  assert.equal(sections.find((section) => section.id === "coverage")!.items.length, 3);
  assert.equal(sections.find((section) => section.id === "radius")!.items[0].symbol, "dashed-ring");
});
