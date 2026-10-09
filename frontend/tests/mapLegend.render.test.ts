import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { createElement, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer, type ViteDevServer } from "vite";
import type { MapLegendProps } from "../src/components/map/MapLegend.tsx";

let server: ViteDevServer;
let MapLegend: ComponentType<MapLegendProps>;

before(async () => {
  server = await createServer({ server: { middlewareMode: true, watch: null }, appType: "custom" });
  MapLegend = (await server.ssrLoadModule("/src/components/map/MapLegend.tsx")).default;
});

after(async () => { await server?.close(); });

test("overview renders without a coverage section or a missing-description crash", () => {
  const html = renderToStaticMarkup(createElement(MapLegend, { ...base, overview: true, initialMode: "compact" }));
  assert.match(html, /All networks/);
  assert.match(html, /Select a category/);
  assert.doesNotMatch(html, /Visible coverage bands/);
});

const base: MapLegendProps = {
  showStations: true,
  showCoverage: true,
  showTraffic: false,
  showRadius: false,
  stations: [{ station_type: 0, lat: 47.53, lng: 21.63 }],
  simulatedStations: [],
};

test("expanded legend separates interactive coverage controls and reading symbols", () => {
  const html = renderToStaticMarkup(createElement(MapLegend, { ...base, initialMode: "expanded" }));
  assert.match(html, /<section[^>]*aria-labelledby=/);
  assert.match(html, /<h3[^>]*>Map legend<\/h3>/);
  assert.match(html, /Coverage category/);
  assert.match(html, /Visible coverage bands/);
  assert.match(html, /PM2.5 · µg\/m³/);
  assert.match(html, /About coverage and readings/);
  assert.match(html, /<ul/);
  assert.match(html, /aria-hidden="true"/);
  assert.doesNotMatch(html, /Transit · activity score/);
  assert.doesNotMatch(html, /not regulatory limits/);
});

test("rendered symbol sections follow changed layer props", () => {
  const html = renderToStaticMarkup(createElement(MapLegend, {
    ...base, initialMode: "expanded", showStations: false, showCoverage: false, showTraffic: true, showRadius: true,
  }));
  assert.doesNotMatch(html, /PM2.5 · µg\/m³/);
  assert.match(html, /Coverage hidden/);
  assert.match(html, /Transit · activity score/);
  assert.match(html, /Air radius/);
  assert.match(html, /Study-area outline/);
});

test("compact legend has category and band controls without verbose sections", () => {
  const html = renderToStaticMarkup(createElement(MapLegend, { ...base, initialMode: "compact" }));
  assert.match(html, /aria-expanded="false"/);
  for (const label of ["Air coverage", "Water coverage", "Noise coverage", "Near coverage band", "Mid-range coverage band", "Gap coverage band"]) {
    assert.ok(html.includes(`aria-label="${label}"`));
  }
  assert.doesNotMatch(html, /PM2.5 · µg\/m³/);
  assert.doesNotMatch(html, /Distance to/);
});

test("hidden legend retains a keyboard-accessible restore button", () => {
  const html = renderToStaticMarkup(createElement(MapLegend, { ...base, initialMode: "hidden" }));
  assert.match(html, /<button/);
  assert.match(html, /Show map legend/);
  assert.doesNotMatch(html, /Coverage category/);
});

test("category-specific ranges and no-data state are rendered honestly", () => {
  const html = renderToStaticMarkup(createElement(MapLegend, { ...base, initialMode: "compact", coverageCategory: "noise" }));
  assert.match(html, /No noise locations in feed/);
  assert.match(html, /≤ 1/);
  assert.match(html, /1–2/);
});

test("noise suggestions update the noise legend with its own radius", () => {
  const html = renderToStaticMarkup(createElement(MapLegend, { ...base, initialMode: "compact", coverageCategory: "noise", additionalPlanCategory: "noise", additionalPlanCount: 3 }));
  assert.match(html, /3 planned/);
  assert.match(html, /≤ 1/);
  assert.match(html, /1–2/);
  assert.doesNotMatch(html, /2–4/);
});
