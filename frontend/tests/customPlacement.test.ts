import assert from "node:assert/strict";
import { test } from "node:test";
import { createCustomRecommendation } from "../src/utils/createCustomRecommendation.ts";

test("custom placements do not manufacture measurements, traffic stops or confidence", () => {
  const result = createCustomRecommendation(47.5, 21.7, [], 1);
  assert.equal(result.placementOnly, true);
  for (const value of [result.estimatedPm25, result.estimatedPm10, result.estimatedNo2, result.estimatedO3, result.estimatedWindSpeed, result.estimatedDaytimeNoise, result.estimatedConductivity]) assert.equal(value, null);
  assert.equal(result.nearestTrafficStop, null);
  assert.equal(result.overallConfidence, 0);
  assert.ok(Number.isNaN(result.distanceKm));
});

test("a nearby official reading is not presented as a measurement at the custom pin", () => {
  const result = createCustomRecommendation(47.5, 21.7, [{ id: 1, name: "Synthetic reference", lat: 47.5, lng: 21.7, station_type: 0, pm25: 8 }], 2);
  assert.equal(result.nearestStation, "Synthetic reference");
  assert.equal(result.distanceKm, 0);
  assert.equal(result.estimatedPm25, null);
});
