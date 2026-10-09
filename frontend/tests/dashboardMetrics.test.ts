import assert from "node:assert/strict";
import { test } from "node:test";
import { getDashboardMetrics, finiteValue, measurement } from "../src/utils/dashboardMetrics.ts";
import type { Station } from "../src/types/station.ts";

test("missing dashboard sources never produce default observations or a health score", () => {
  const metrics = getDashboardMetrics([], null);
  assert.equal(metrics.averagePm25, null);
  assert.equal(metrics.daytimeNoise, null);
  assert.equal(metrics.temperature, null);
  assert.equal(metrics.healthScore, null);
  assert.equal(measurement(null, "dB"), "Unavailable");
});

test("station means preserve zero and exclude water, missing, negative and nonfinite readings", () => {
  const readings = [0, 10, null, undefined, NaN, Infinity, -2].map((pm25, id) => ({
    id, name: "Synthetic air station", lat: 47.53, lng: 21.62, station_type: 0, pm25,
  }));
  const water: Station = { id: 8, name: "Synthetic water station", lat: 47.53, lng: 21.62, station_type: 1, pm25: 90 };
  const metrics = getDashboardMetrics([...readings, water], null);
  assert.equal(metrics.averagePm25, 5);
  assert.equal(metrics.readingCount, 2);
  assert.equal(measurement(0, "µg/m³"), "0.0 µg/m³");
  assert.equal(finiteValue("12"), null);
});
