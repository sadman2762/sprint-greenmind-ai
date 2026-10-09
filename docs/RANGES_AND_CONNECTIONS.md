# Configurable sensor zones and connections

The map retains Air, Water and Noise. `Sensor ranges` in the header edits a category radius (0.05–10 km); selecting an existing or chosen sensor allows an individual override and a return to the category default. Edits are session state, like chosen locations. They do not change source observations or hardware specifications. Starting values (Air 2 km, Water 1.5 km, Noise 1 km) are editable scenario inputs, not calibrated sensor reach.

Map zones, outlines, individual details, the legend, Air/Noise baseline metrics, candidate footprints and marginal gains use these settings. Each point is near if it falls inside any compatible sensor’s configured circle; the closest sensor need not be the one that covers it. With individual settings, the legend uses multiples of each sensor’s radius. Distances use the same local equirectangular approximation as the planner. Geometric sensor circles are not pollution surfaces or validated detection coverage; water proximity is not hydrological connectivity.

Changing ranges invalidates old recommendations and cancels pending plan requests. New suggestions use the category radius. Once applied, a chosen sensor can have an individual override. Before/after requests include the same category settings and individual overrides. Original coordinate selection preserves its original rules; its results are evaluated using the same configured footprints as Joint. Original is not retroactively claimed to optimize these user radii.

## API 1.3-ranges

`POST /api/plans/joint` and `/coverage` accept:

```json
{
  "planningCategory": "air",
  "coverageRadiiKm": {"air": 0.75, "water": 0.3, "noise": 1},
  "sensorRadiusOverridesKm": {"air:STATION-CODE": 0.25}
}
```

Other request fields remain unchanged. An override key is `category:stationCode`, falling back to `category:id`; planned pins use their simulation ID. Air/noise calculations ignore other categories. Radius bounds and finite values are validated by the API. Responses include `rangeSettings`, and the decision brief exports them. `datasetVersion` still describes the source snapshot, while `rangeSettings` records the scenario inputs. Auto-placement for water remains unavailable pending feasible water-site rules; its map and manual placement remain available.

## Relationship graph

Select a marker and open `Connections`, or use the map toolbar. The inspector shows a node graph and clickable explanations; connected nodes appear on the map. Clicking a node changes the focus with a short animated zoom (disabled for reduced-motion preferences). The graph includes available official stations, historical noise sites, visible chosen/suggested locations and geolocated DKV stops, with source labels.

Relationships are computed locally from coordinates:

- Same-category configured circles overlap: analytic circle-intersection area before study-boundary clipping. No assertion that their measurements are redundant or that water sensors share a water body.
- Nearby sensors of any category: spatial proximity within the adjustable search distance. Cross-category proximity does not imply measurement substitution.
- Sensor near DKV stop: spatial proximity plus May 2026 recorded passenger activity/index when available. Neither emissions nor vehicle frequency is inferred.

All overlap links are eligible even outside the proximity threshold. All / Sensors / DKV filters select the relationship types. The graph shows the six nearest eligible neighbors within the selected filter and states the total. DKV nodes come only from the existing processed traffic_activity.csv data exposed by /traffic; the graph does not discover new stops through OpenStreetMap. Unlike the normal transit layer (up to 40 high-index stops), it considers all geolocated records in this source. Graph edges are deterministic spatial facts and scenario-derived relations, not statistical correlations, physical causation or an LLM inference. Missing sources are reported. DKV remains contextual and is not part of the placement objective.

## Verification

Backend range tests validate bounds, individual overrides, category isolation, independent geometric recomputation of step gains, applied-plan reconciliation and Original evaluation under the same radius. Frontend tests verify overlapping-circle geometry and graph relationship semantics. `tests/rangeGraph.browser.ts` checks Water access, category controls, API payloads, per-sensor overrides, graph navigation, invalidation and narrow-screen overflow using synthetic fixtures and blocked external requests.

Run from frontend:

```sh
npm test
npm run build
npm run lint
PLAYWRIGHT_CHANNEL=msedge node --experimental-strip-types --test --test-timeout=60000 tests/rangeGraph.browser.ts
```

Verified: 40 frontend tests, 34 backend tests, production build, and browser flows for the planner, ranges/graph and editable drafts passed. The full lint suite retains its existing 22 errors and one warning; targeted lint of the new range/graph components passed.

## Placement and editable proposals

`Add sensor` includes a radius field and slider for the next manual pin, separately for Air, Water and Noise. Invalid values prevent placement. The chosen value becomes that pin’s individual override; it does not change other sensors. The planner also has a `Suggested sensor radius` control. Its request field `newSensorRadiusKm` applies only to new candidates and common evaluation of Original proposals, leaving existing category radii unchanged.

Purple suggested markers can be dragged before applying. They remain proposals and do not enter the chosen basket until Apply. `POST /api/plans/evaluate` accepts the same scenario inputs plus 1–3 ordered `proposedStations` with ID, category, coordinates and optional radius. It evaluates that exact order with the planner’s same environmental field and union geometry. It does not optimize or move the other proposals. It returns station/step metrics, overlap and spacing warnings; out-of-boundary moves are rejected.

A successful move updates the circles, addresses, graph, basket and before/after figures together. Edited proposals are labeled as manually adjusted, and old candidate rankings/optimizer comparison controls are suppressed. No old predicted measurement is carried to the new coordinates. Apply preserves the moved coordinates and each proposal’s radius. During evaluation Apply/Export are disabled. Failed moves restore the previous pin and plan; obsolete responses are cancelled. Browser regression: `tests/draftEditing.browser.ts`.
