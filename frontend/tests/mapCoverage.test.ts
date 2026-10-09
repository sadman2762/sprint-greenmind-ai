import assert from "node:assert/strict";
import { test } from "node:test";
import { findNearestAirStation, findNearestStation } from "../src/utils/nearestStation.ts";
import type { Station } from "../src/types/station.ts";
import type { SensorTier } from "../src/types/budget.ts";

const air: Station = { id: 1, name: "Air fixture", station_type: 0, lat: 47.53, lng: 21.62 };
const water: Station = { id: 2, name: "Water fixture", station_type: 1, lat: 47.54, lng: 21.64 };
const noise: Station & { sensorTier: SensorTier } = { id: 3, name: "Noise simulation", station_type: 0, sensorTier: "noise", lat: 47.52, lng: 21.61 };

test("each network calculates distances to compatible stations", () => {
  assert.equal(findNearestStation(noise.lat, noise.lng, [air, water, noise], "air").station?.id, air.id);
  assert.equal(findNearestStation(noise.lat, noise.lng, [air, water, noise], "water").station?.id, water.id);
  assert.equal(findNearestStation(noise.lat, noise.lng, [air, water, noise], "noise").distanceKm, 0);
});

test("missing noise locations produce no coverage rather than falling back to air", () => {
  assert.deepEqual(findNearestStation(47.53, 21.62, [air, water], "noise"), { station: null, distanceKm: null });
});

test("legacy air metrics ignore simulated noise and invalid coordinates", () => {
  assert.deepEqual(findNearestAirStation(47.53, 21.62, [noise, { ...air, lat: NaN }]), { station: null, distanceKm: null });
  assert.equal(findNearestAirStation(air.lat, air.lng, [air, water, noise]).distanceKm, 0);
});
