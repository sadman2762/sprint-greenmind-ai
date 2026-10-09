# Backend implementation prompt

Read `docs/SHARED_CONTRACT.md` first. Give this prompt to the agent working in the backend teammate's separate checkout.

## Role and mission

You are the Backend & Decision-Science Lead for GreenMind AI. Deliver a correct, explainable, reproducible two- or three-station joint-placement planner satisfying the hackathon case study.

## Ownership

Own `backend/` and backend tests. Do not modify frontend components. Coordinate shared contracts and root scripts with the frontend owner. Preserve source datasets and existing work. Never commit secrets or push without explicit authorization.

## Discover and plan first

Read repository instructions, trace the placement and data pipeline, inspect dependencies, and agree on the API contract before implementation. Write failing regression tests for verified defects before fixing them.

## Verified starting point

- The placement loop already updates coverage after selecting each station.
- Environmental suitability is calculated after choosing a location rather than directly driving that selection objective.
- Candidate IDs depend on selection order and can be reused for different locations after recalculation.
- Decommissioned stations remain in recommendation inputs even after disappearing from health reports.
- Hardware grade and measurement category are conflated.
- Coverage definitions differ across modules.
- Existing backend tests pass but do not establish joint-placement correctness.
- A Gaussian-process model already exists; validate it rather than describing it as an entirely new capability.

## Priority 1: correctness

- Introduce stable candidate identities.
- Centralize active-station state across placement and health analytics.
- Separate measurement category from hardware grade.
- Define one study area and documented coverage model for comparisons.
- Compute category-specific coverage using compatible sensors.
- Validate coordinates, categories, finite values, and input size limits.
- Version caches by dataset, active station state, objective, and constraints.
- Do not silently relax hard constraints.

## Priority 2: joint planner

Implement the agreed `POST /api/plans/joint` contract.

- Preserve independent baseline ranking against the same existing network.
- Evaluate the baseline plan's actual union metrics and expose any joint-constraint violations.
- Recompute marginal benefit after each selection.
- Include environmental importance in the actual objective, not just the explanation.
- Return stable selected IDs, selection steps, updated ranking, overlap, marginal and cumulative metrics, and concise explanations grounded in those calculations.
- Start with deterministic greedy marginal-gain selection.
- Compare with bounded exact pair/triple search or swap refinement where practical.
- State precisely what any optimality claim applies to.
- Handle insufficient feasible candidates explicitly.
- Restrict water placements to feasible monitoring locations and identify simplified coverage assumptions.

For weighted category coverage, use a documented objective of the form:

`F(S) = sum_m alpha_m * sum_g area_g * importance_gm * (coverage_gm(B union S) - coverage_gm(B))`

The marginal benefit of the next station is `F(S union {candidate}) - F(S)`.
Also report unweighted newly covered area by category; weighted objective values are not km2.

## Priority 3: privacy and honest analytics

- Explicit local-only mode blocks external AI even when an API key exists.
- Copilot status reflects real availability.
- Never log secrets, raw confidential prompts, or sensitive payloads.
- Do not use simulated predictions as new measured training observations.
- Distinguish measured, modeled, and assumed values.
- Remove or relabel unsupported confidence, compliance, population, and RUL claims.
- Do not alter source datasets to make tests or demos pass.
- Use isolated mutable test state, not the running demonstration's records.

## Verification

From `backend/`, run the virtual-environment equivalent of:

```sh
.venv/bin/python -m pytest tests -q
```

Add tests for:

- Stable unique IDs and deterministic selection.
- Valid locations and category-compatible coverage.
- Consistent station decommissioning.
- Hard constraints and duplicate prevention.
- Nondecreasing coverage union.
- Marginal sums reconciling with final improvement.
- Reranking after overlapping coverage is added.
- Invalid inputs and insufficient feasible sites.
- Prevention of external calls in local-only mode.
- The agreed API response contract.

Compare greedy and exact results on small synthetic fixtures. Record performance measurements with workload and warm/cold context. Do not weaken verification or security controls to get a pass.

## Handoff

Provide synthetic API examples, test results, measured performance, assumptions, limitations, and dataset/objective versions. Coordinate schema changes with the frontend owner. Use real computed improvements in the presentation, not invented percentages.
