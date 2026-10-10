import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { createElement, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer, type ViteDevServer } from "vite";
import type { EnvironmentalConditionCardProps } from "../src/components/dashboard/EnvironmentalConditionCard.tsx";
import { getEnvironmentalConditions } from "../src/services/environmentalConditionsService.ts";
import { environmentalFixture } from "./environmentalConditions.fixture.ts";

let server: ViteDevServer;
let Card: ComponentType<EnvironmentalConditionCardProps>;
before(async () => {
  server = await createServer({ server: { middlewareMode: true, watch: null }, appType: "custom" });
  Card = (await server.ssrLoadModule("/src/components/dashboard/EnvironmentalConditionCard.tsx")).default;
});
after(async () => { await server?.close(); });

for (const category of ["air", "water", "noise"] as const) {
  test(`${category} chart includes historical provenance, units, and accessible daily values`, () => {
    const html = renderToStaticMarkup(createElement(Card, { category, dataset: environmentalFixture.categories[category] }));
    assert.match(html, /Historical/);
    assert.match(html, /Latest recorded day: 2026-05-23/);
    assert.match(html, /2 reporting sites/);
    assert.match(html, /<table/);
    assert.match(html, /Unavailable \/ 0/);
    assert.match(html, /2026-05-21/);
    assert.ok(html.includes(`synthetic-${category}.csv`));
    assert.doesNotMatch(html, /Healthy|live readings|NaN/);
  });
}

test("empty and unavailable datasets show messages rather than fabricated values", () => {
  for (const status of ["empty", "unavailable"] as const) {
    const html = renderToStaticMarkup(createElement(Card, { category: "air", dataset: { ...environmentalFixture.categories.air, status, message: "No historical data." } }));
    assert.match(html, /No historical data/);
    assert.doesNotMatch(html, /Latest recorded day|<table/);
  }
});

test("zero is a reading, while an entirely missing metric is not", () => {
  const dataset = environmentalFixture.categories.air;
  const html = renderToStaticMarkup(createElement(Card, { category: "air", dataset }));
  assert.match(html.replace(/<style\b[^>]*>[\s\S]*?<\/style>/g, ""), />0<span/);
  const empty = renderToStaticMarkup(createElement(Card, { category: "air", dataset: { ...dataset, metrics: dataset.metrics.map(metric => ({ ...metric, points: metric.points.map(point => ({ ...point, value: null })) })) } }));
  assert.match(empty, /No valid readings for this metric/);
  assert.doesNotMatch(empty, /Latest recorded day/);
});

test("summary requests use the same-origin API and support cancellation", async t => {
  const controller = new AbortController();
  t.mock.method(globalThis, "fetch", async (url: string, options: RequestInit) => {
    assert.equal(url, "/api/official-dataset/conditions");
    assert.equal(options.signal, controller.signal);
    return new Response(JSON.stringify(environmentalFixture));
  });
  assert.deepEqual(await getEnvironmentalConditions(controller.signal), environmentalFixture);
});

test("HTTP failures and malformed summaries reject instead of showing fake charts", async t => {
  const mock = t.mock.method(globalThis, "fetch", async () => new Response("Unavailable", { status: 503 }));
  await assert.rejects(getEnvironmentalConditions(new AbortController().signal));
  mock.mock.mockImplementation(async () => new Response(JSON.stringify({ available: false })));
  await assert.rejects(getEnvironmentalConditions(new AbortController().signal));
});
