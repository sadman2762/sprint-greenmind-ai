# GreenMind AI: shared team contract

Repository: https://github.com/sadman2762/sprint-greenmind-ai

## Ownership

- Kirill: frontend, map experience, accessibility, demo visuals, presentation narrative. Owns `frontend/`.
- Backend teammate: placement algorithms, data semantics, API, persistence, backend tests. Owns `backend/`.
- Shared: API contract, study boundary, units, validation criteria, root scripts, and integration.
- Use separate clones or worktrees. Do not have two agents edit the same checkout.
- Suggested branches: `frontend/network-planner` and `backend/joint-planner`, based on `main`.
- Do not change another owner's files or the agreed schema without coordination.
- Do not commit or push without explicit authorization. Never force-push shared branches.

## Challenge

Recommend two or three monitoring stations jointly. After each virtual placement, recompute coverage and candidate value. Compare the original repository method with the joint network. Preserve a separately labeled independent-ranking control. Quantify each station's marginal contribution and explain at least one trade-off between environmental importance and redundancy.

The primary demonstration is one repeatable workflow: current network -> joint plan -> selection steps -> Original comparison -> decision brief.

## Proposed API: agree before implementing

The category-specific case-study planner is described in [JOINT_PLANNER.md](JOINT_PLANNER.md), with its implemented `1.2-network` request/response contract (air and noise, separately). The broader multi-category proposal below remains future work; mixed-category optimization and feasible-water-site rules are not implemented.

This is a proposal, not an endpoint that already exists. Before implementation, agree on exact types, nullability, error responses, and a synthetic example response.

`POST /api/plans/joint`

Request:

- `stationCount`: 2 or 3.
- `categoryWeights`: air, noise, and water weights.
- `constraints`: explicit feasible-site and distance rules.
- `existingSimulation`: stable IDs, coordinates, measurement categories, and hardware grades.

Response:

- `schemaVersion`, `datasetVersion`, `objectiveVersion`.
- Study area and coverage-model metadata.
- Assumptions and warnings.
- Existing-network metrics.
- Baseline candidate ranking, scored independently against the same existing network.
- Independent top-k baseline plan and its evaluated union metrics, including constraint violations.
- Ordered joint-plan stations with stable candidate IDs.
- Selection steps containing selected candidate ID, marginal covered km2 by category, marginal weighted gain, overlap fraction, cumulative metrics, updated ranking, and a concise evidence-based explanation.
- Final plan metrics.

## Measurement rules

1. Use the same dataset, candidate universe, study area, and metric definitions for both plans.
2. Separate air, noise, and water coverage. A water sensor does not provide air coverage.
3. Separate measurement category from hardware grade.
4. Distinguish weighted objective scores from physical area.
5. Distinguish percentage-point change from relative percentage change.
6. Missing observations are null, not invented defaults.
7. Simulated predictions are not measured observations or new training labels.
8. Backend owns analytical metrics. Frontend displays the returned values, units, and assumptions.
9. Treat circular coverage as a planning model, not proof of physical representativeness. Water placements require feasible monitoring locations.
10. State whether optimization is heuristic or exact within a defined candidate set. Do not claim unrestricted global optimality.
11. Do not describe heuristic scores as calibrated probabilities, proven legal compliance, or validated remaining useful life.

## Privacy and reproducibility

The repository is intentionally public. Never add credentials, private keys, dotenv secrets, or confidential payloads. Public source code does not authorize sending runtime user data to external AI services. Keep explicit local-only mode available and block external AI in that mode even if an API key is present.

Preserve source datasets. Tests must use isolated mutable state, not the running demonstration's records. Show data periods and distinguish measured, modeled, and assumed quantities. Use labeled synthetic fixtures during development only; do not hide API failures behind fake results.

## Integration gates

- Stable and unique candidate IDs.
- No duplicate selected locations.
- Category-compatible coverage and valid feasible locations.
- Hard constraints respected or infeasibility reported explicitly.
- Decommissioned stations excluded consistently.
- Nondecreasing coverage union when compatible stations are added.
- Per-step marginal gains reconcile with final-minus-baseline improvement.
- An overlapping-candidate fixture demonstrates meaningful reranking.
- Frontend and backend agree on schema, units, assumptions, and failures.
- Request cancellation prevents stale plans replacing newer results.
- Loading, errors, empty results, and success are separate states.
- Map and legend use shared definitions and describe only visible layers.
- Repeatable demo: load, generate, inspect steps, compare, reset, retry failure.

## Verification commands

From `frontend/`:

```sh
npm run build
npm run lint
```

From `backend/` on macOS/Linux:

```sh
.venv/bin/python -m pytest tests -q
```

Use the platform's equivalent virtual-environment interpreter on Windows. Before this work, the production build and seven backend tests passed; frontend lint reported 23 errors and one warning. Report remaining failures honestly rather than disabling checks.

## Presentation ownership

Kirill leads the visual story and live demonstration. The backend owner explains methodology, evidence, and limitations. Use actual computed improvements, never invented percentages. Prepare local backup screenshots or a recording of the same validated scenario. The original PowerPoint still requires an accessible export for review.

## Original comparison (user-confirmed source)

Original means the method from https://github.com/Sayem-Kabir/greenmind-ai at `c15c09f694012d8abc75fb252c89a27c3fa4faef`. It is distinct from the independent top-k control using the new objective. API `1.1-air` adds `originalPlan` with provenance, availability/partial status, ordered stations, common-model metrics, per-selection gains, and comparison caveats. It also adds `originalComparison`. The prior `independentPlan` and `baselineRanking` fields remain an explicitly labeled independent control for compatibility.

## Noise planning extension

User requested noise planning in addition to the air workflow. `POST /api/plans/joint` and `/coverage` accept optional `planningCategory: "air" | "noise"` (default air). Response schema is `1.2-network` and contains `planningCategory`. Noise uses only historical noise sites and chosen/registered noise sensors, a 1 km planning radius, and nighttime sound-energy IDW within 5 km. Other cells receive area-only importance. `GET /api/plans/noise-sites` returns historical site coordinates and period aggregates, never live telemetry. Air and noise coverage remain separate. Equivalent Original noise selection is unavailable and labeled; an independent noise-ranking control remains available. DKV was audited but is not an optimization input. See `NOISE_PLANNING.md` and `DKV_DATA_AUDIT.md`.

## Configurable ranges and graph

User-authorized extension `1.3-ranges` adds `coverageRadiiKm` (Air/Water/Noise category defaults) and `sensorRadiusOverridesKm` (`category:stationCode`, or `category:id`). Frontend zones and Air/Noise planning use the same settings; new suggestions use the category radius. Original retains its old selection rules but receives common-radius evaluation. Water map/manual placement remains available without claiming water auto-optimization. Graph links explain proximity and configured circle overlap with source-labeled DKV context, not causation. See [RANGES_AND_CONNECTIONS.md](RANGES_AND_CONNECTIONS.md).

## Proposal editing

The user authorized choosing a radius during placement and dragging unapplied purple suggestions. `newSensorRadiusKm` is an optional validated candidate radius, independent of existing category defaults. `/api/plans/evaluate` evaluates an ordered list of 1–3 manually adjusted proposals against the same base network and environmental field; it does not rerun optimization. Edited proposals remain separate from chosen sensors until Apply; their radii are transferred as individual overrides. Old ranking/optimality explanations must not be shown for moved coordinates. See `RANGES_AND_CONNECTIONS.md`.

## Live transport extension

User-authorized `GET /api/transit/vehicles` proxies full GTFS-RT VehiclePositions snapshots with server-only credentials. Source labels must distinguish BKK Budapest from DKV Debrecen. Live vehicles are a separate optional map layer, not historical DKV activity or an optimization input. Unknown mode/route/speed remain unknown; timestamps and stale positions are explicit. See [LIVE_TRANSIT.md](LIVE_TRANSIT.md) for schema, configuration and polling behavior.
