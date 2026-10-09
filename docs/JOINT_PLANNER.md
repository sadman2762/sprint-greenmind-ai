# Joint air-network planner

The case-study workflow is implemented at Sensor Recommendations. Generate one, two or three stations, compare the existing network / Original method / Joint plan, inspect each selection and its reranked candidates, then export the decision brief.

This implementation is an **air-network pilot**. It does not implement the proposed multi-category optimizer in SHARED_CONTRACT.md. Noise and water simulations never contribute air coverage. Hardware grade is separate and unspecified; planning radii do not imply a procurement recommendation.

## API v1.2-network

`POST /api/plans/joint`

Request example (synthetic settings):

```json
{
  "stationCount": 3,
  "environmentalWeight": 1,
  "minSeparationKm": 1,
  "existingSimulation": []
}
```

Count must be 1, 2 or 3, environmental weight 0–3, and minimum separation 0–5 km. Up to 100 simulations are accepted, each with a unique string `id`, coordinates, category (`air`, `noise`, `water`), optional name, and separate hardwareGrade. Invalid inputs, duplicate locations and infeasibility return HTTP 422 with `detail`. Obsolete frontend requests are cancelled. There is no fallback plan on API failure.

The response types are in `frontend/src/services/jointPlanService.ts`; request validation is in `backend/app/routes/plans.py`.

Response includes schema/dataset/objective versions, study-area metadata, assumptions, active existing locations, independent-control top-20 ranking, independent top-k union metrics and constraint violations, joint stations, each selection's marginal km² / weighted gain / overlap / cumulative metrics / updated top-10 ranking, a computed trade-off, and an exact shortlist benchmark.

## Method and units

Both plans use the same urban candidate grid, existing network and 2 km radius. The grid is the application's 0.0055-degree Debrecen urban grid, restricted to its study polygon and 8.2 km urban radius. Samples represent local rectangular cells; boundary areas are approximations. Local equirectangular distance is used consistently. This is not an authoritative geographic coverage assessment.

Each cell has importance `1 + environmentalWeight * clip(IDW_PM25 / 35, 0, 2)`. IDW uses available historical means of active air stations. The 35 reference is a chosen objective scale, not a legal threshold. Missing measurements are excluded; if none exist, selection uses area only and reports a warning. Simulated locations affect coverage but never train the interpolation.

The objective sums `cell area * importance` over newly covered cells. Greedy selection recomputes this gain after each placement, excludes incompatible locations, and uses stable location IDs for tie breaking. Marginal contributions reconcile with final added coverage. Independent top-k is evaluated as a union, never by summing overlapping standalone scores. Its pairwise constraint violations are reported explicitly.

A separate exact search checks combinations within the top 24 independently ranked candidates. It is a restricted benchmark, not a global bound or an unrestricted optimality claim. The displayed plan remains the deterministic greedy plan.

Coverage percentages are percentages of modeled study area; changes between them are percentage points. Weighted gain has area-times-importance units, not physical km². Candidate coordinates still require installation/access/land-use checks. The dataset version hashes the actual planning snapshot. No planner cache is used; decommissioning state is read for each request.

## Repeatable demo

1. Open Sensor Recommendations and use Suggest 3 together. Defaults are environmental importance 1 and minimum separation 1 km.
2. Compare the clickable Before/After summary. Open the location basket to inspect short street names, exact coordinates and each additional coverage gain.
3. Open Case-study details. Choose Existing to inspect the original ranking, then Step 1 and Step 2 to see changed candidate gains.
4. Toggle Original / Joint / Both on the shared monitoring map. Amber O markers show the actual Original method; numbered purple markers show the selected joint steps. In Both view, distance-based shading follows the joint steps. The map extent remains the same; the map supports wheel zoom and +/− controls. The original category filters and legend remain available.
5. Read the computed trade-off and exact-shortlist benchmark; export the brief.
6. Discard suggestions from the basket. Try Suggest 2 together and another environmental weight; do not invent a percentage improvement.
7. Stop the backend to demonstrate the error state, then restart and Retry.

## Verification

Backend: `.venv/bin/python -m pytest tests -q`.
Frontend: `npm test`, `npm run build`, `npm run lint`.
Browser tests use synthetic data and block external requests: with Vite running, `PLAYWRIGHT_CHANNEL=msedge npm run test:dashboard` and `PLAYWRIGHT_CHANNEL=msedge MAP_TEST_URL=http://127.0.0.1:5173 npm run test:browser`.

Planner browser workflow: `PLAYWRIGHT_CHANNEL=msedge npm run test:planner`.

## Applied suggestions, addresses and before/after

- Suggest 3 together, Suggest next 1, and Suggest 2 together request the corresponding count. Applying is a separate, explicit action that appends locations to the session's existing manual/applied set, with coordinate deduplication. New requests include this set. Moving, removing or changing the category of a chosen pin invalidates the preview. Planning preferences survive application.
- `POST /api/plans/coverage` accepts the same request's `existingSimulation` field and returns installed versus chosen air coverage on the same grid and 2 km radius used by the planner. It does not require any remaining feasible candidate. Non-air placements never increase air coverage.
- Before hides all simulated/manual and preview locations. After shows chosen locations plus the preview. Coverage percentages count union area only once; applied suggestions are planning decisions, not physical deployments.
- `GET /api/geocoding/reverse?lat=...&lng=...` uses public OpenStreetMap Nominatim. Requests are identified, serialized at no more than one per 1.1 seconds, and cached for 24 hours (maximum 1,000 entries) in the single-process local service. Only displayed chosen/suggested pins are reverse-geocoded, never the candidate grid. Provider failures leave coordinates available and expose retry.
- A reverse-geocoded address is the nearest mapped object, not proof of the exact installation address. Show six-decimal pin coordinates, a pin link, attribution, and whether a house number was returned. Do not move the planning point to the address's returned coordinate.
- Custom/manual pins no longer generate artificial noise, groundwater, traffic, confidence or pollutant readings. Placement records mark observations unavailable and `placementOnly: true`; neutral numeric fields remain solely for compatibility with the legacy recommendation type. Planned inspectors show no such scores/readings. Costs are explicitly labeled configured budget assumptions, not quotes.

The location basket holds Suggested and Chosen tabs. The main page no longer renders one large card per chosen location. Short street/neighborhood labels expand to full OSM details; Show on map centers the exact pin. The clickable Before/After metrics switch the same map without changing its scale. When every proposed location overlaps prior coverage by at least 80%, the UI highlights small added reach and asks users to review the configured hardware cost. This is a transparent display rule, not cost optimization or an automatic stopping policy.

## Map workspace refactor

The home route and `/recommendations` now open the same focused planner. Former dashboard, budget, health and maintenance routes redirect home; their legacy source remains outside the active app. The active shell has no sidebar navigation or floating Copilot. Desktop uses a 332 px planning panel alongside a full-height map. Mobile uses a map with a planning bottom panel and a separate location basket. Layer switches are in the Layers popover; the legend retains category and distance-band controls. Analytical comparison remains available through Compare methods & results.

Coverage shading is rendered as geographic grid cells rather than fixed-pixel dots; classification still uses the shared distance bands. Basemap tiles are visually muted to improve marker contrast. These presentation changes do not change the backend objective, radius, or coverage metrics.

## Original is the previous repository method

User supplied https://github.com/Sayem-Kabir/greenmind-ai as the authoritative Original. Pinned commit: `c15c09f694012d8abc75fb252c89a27c3fa4faef`. Our existing `recommendation_engine.py` is byte-identical to that commit (SHA-256 `f695f66ab415ae932011e6a831dac1290e9d085781d51cbb9cc81533ada897a3`); a regression test enforces that identity. `original_planner.py` calls its real `generate_recommendations` with the requested count and upstream default 2.8 km separation, preserving returned order. The upstream route exposes a prefix of this sequence; it does not sort by reported Priority Score. No upstream environment, credentials, or datasets are copied.

The supplied code differs from the historical PDF description: selection already updates distances and scores between placements. It uses uncovered-neighborhood gain, overlap penalty, adjacency, centrality, anchors, boundary containment and sector diversity. IDW, suitability and Priority Score are calculated after choosing each coordinate and do not drive that argmax. Do not describe this as IDW versus greedy, or claim sequential updating was absent from Original.

Both receive the current active air-station roster plus the same chosen air locations. Original retains its full candidate grid, urban-station filter, 2.4 km existing / 2.8 km proposed spacing, boundary margin and relaxation. Joint retains its subsampled candidate set and configured hard separation. Thus this compares whole methods with different objectives and constraints, not an isolated reranking experiment. The independent control remains available for the latter.

Original coordinates are evaluated directly, without snapping to Joint candidates, using the same study cells, area weights, existing network, 2 km radius and PM2.5 importance. Reported original environmental/confidence fields are not displayed as measurements. Added coordinates have no manufactured observations at the adapter boundary; the legacy engine's internal assumptions are preserved.

`originalPlan.status` is `available`, `partial`, or `unavailable`; partial output explicitly records unequal station counts. Failures never substitute independent top-k. The UI and export include source commit, original order, marginal contributions, common-model metrics and caveats. A result where Original wins, or nearly ties, must remain visible.

## Step explanation evidence

Each step optionally includes `recalculation`: the highest-scoring remaining alternative before that placement, its additional area and weighted gain before/after, and whether the new placement excludes it by minimum spacing. Values come from the full candidate masks, not the truncated visible ranking. The UI labels it as a comparison alternative, never an applied sensor. See [PLANNING_SCENARIOS.md](PLANNING_SCENARIOS.md) for fixed scenario results and [DKV_DATA_AUDIT.md](DKV_DATA_AUDIT.md) for actual transport-data limitations.

## Noise mode

The same selection routine also serves category `noise`; request/response semantics are documented in [NOISE_PLANNING.md](NOISE_PLANNING.md). Air remains the default. Do not apply the air-only data, radius or Original comparison description above to noise.
