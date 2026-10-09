import assert from "node:assert/strict";
import { test } from "node:test";
import { circleOverlapKm2, networkRelations, type NetworkNode } from "../src/utils/networkGraph.ts";
import { INITIAL_RADII, relativeRangeAt, sensorRadius, validRadius } from "../src/utils/sensorRange.ts";
import { getCoverageBands } from "../src/utils/mapLegend.ts";

test("individual range can reach a point even when the nearest sensor cannot", () => {
  const stations = [{ id: 1, name: "Near", lat: 47.53, lng: 21.62, station_type: 0 }, { id: 2, name: "Far", lat: 47.54, lng: 21.62, station_type: 0 }];
  const radii = { ...INITIAL_RADII, air: .1 };
  assert.ok(relativeRangeAt({ lat: 47.532, lng: 21.62 }, stations, radii, {}) > 1);
  assert.ok(relativeRangeAt({ lat: 47.532, lng: 21.62 }, stations, radii, { "air:2": 2 }) < 1);
  assert.equal(sensorRadius(stations[0], radii, { "water:1": 10 }), .1);
  assert.equal(validRadius(NaN), false);
  assert.equal(validRadius(0), false);
  assert.deepEqual(getCoverageBands("water", .4).map(b => b.max), [.4, .8, Infinity]);
});
test("circle intersection handles identical, contained, tangent and separate circles", () => {
  assert.equal(circleOverlapKm2(1, 1, 0), Math.PI);
  assert.equal(circleOverlapKm2(2, 1, .5), Math.PI);
  assert.equal(circleOverlapKm2(1, 1, 2), 0);
  assert.equal(circleOverlapKm2(1, 1, 3), 0);
  assert.ok(Math.abs(circleOverlapKm2(1, 1, 1) - (2 * Math.PI / 3 - Math.sqrt(3) / 2)) < 1e-10);
});
test("graph separates overlap, cross-category proximity and DKV context without causal claims", () => {
  const source: NetworkNode = { id: "a", name: "A", lat: 47.53, lng: 21.62, category: "air", radiusKm: 1, source: "fixture" };
  const nodes: NetworkNode[] = [source, { ...source, id: "b", lat: 47.54 }, { ...source, id: "w", category: "water" }, { ...source, id: "t", category: "transit" }, { ...source, id: "far", lat: 49 }];
  const relations = networkRelations(source, nodes, .5);
  assert.equal(relations.length, 3);
  assert.equal(relations.find(r => r.target.id === "b")?.kind, "shared-zone");
  assert.equal(relations.find(r => r.target.id === "w")?.overlapKm2, undefined);
  assert.match(relations.find(r => r.target.id === "t")!.explanation, /not measured emissions/);
  assert.ok(!relations.some(r => r.target.id === source.id));
});
