import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { readFile } from "node:fs/promises";
import { createElement, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer, type ViteDevServer } from "vite";
import type { JointPlan } from "../src/services/jointPlanService.ts";

let server: ViteDevServer;
let Story: ComponentType<{ plan: JointPlan; step: number; onShowAlternative: () => void }>;
let Comparison: ComponentType<{ plan: JointPlan }>;
const plan = JSON.parse(await readFile(new URL("./jointPlan.fixture.json", import.meta.url), "utf8")) as JointPlan;
before(async () => {
  server = await createServer({ server: { middlewareMode: true, watch: null, hmr: false }, appType: "custom" });
  Story = (await server.ssrLoadModule("/src/pages/Recommendations/SelectionStory.tsx")).default;
  Comparison = (await server.ssrLoadModule("/src/pages/Recommendations/MethodComparison.tsx")).default;
});
after(async () => { await server?.close(); });
test("selection narrative separates lost coverage from a spacing exclusion", () => {
  const fixture = structuredClone(plan);
  fixture.steps[0].recalculation = { station: fixture.steps[1].station, beforeKm2: 10, afterKm2: 3, beforeWeightedGain: 12, afterWeightedGain: 4, excludedBySeparation: true };
  const html = renderToStaticMarkup(createElement(Story, { plan: fixture, step: 1, onShowAlternative() {} }));
  assert.match(html, /10.00 km²/);
  assert.match(html, /3.00 km²/);
  assert.match(html, /also too close/);
  assert.match(html, /location 2 adds/);
  fixture.steps[0].recalculation.excludedBySeparation = false;
  assert.doesNotMatch(renderToStaticMarkup(createElement(Story, { plan: fixture, step: 1, onShowAlternative() {} })), /too close/);
});
test("the start and final steps do not invent a next placement", () => {
  const start = renderToStaticMarkup(createElement(Story, { plan, step: 0, onShowAlternative() {} }));
  assert.match(start, /Start with the current network/);
  const end = renderToStaticMarkup(createElement(Story, { plan, step: plan.steps.length, onShowAlternative() {} }));
  assert.match(end, /complete suggestion/);
  assert.doesNotMatch(end, /location 4 adds/);
});
test("comparison reports a near tie and does not compare unequal counts as a win", () => {
  const fixture = structuredClone(plan);
  fixture.originalPlan.metrics = { ...fixture.jointPlan.metrics, addedKm2: fixture.jointPlan.metrics.addedKm2 + 0.001 };
  const html = renderToStaticMarkup(createElement(Comparison, { plan: fixture }));
  assert.match(html, /Nearly the same area/);
  fixture.originalPlan.status = "partial";
  assert.match(renderToStaticMarkup(createElement(Comparison, { plan: fixture })), /equal-count comparison is unavailable/);
});

test("noise evaluation uses a noise control without claiming an Original run", () => {
  const fixture = structuredClone(plan);
  fixture.planningCategory = "noise";
  const html = renderToStaticMarkup(createElement(Comparison, { plan: fixture }));
  assert.match(html, /Independent versus joint noise plan/);
  assert.match(html, /no equivalent noise-placement mode/);
  assert.match(html, /1 km reach/);
});
