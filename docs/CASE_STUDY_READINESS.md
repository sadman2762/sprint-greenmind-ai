# Case-study readiness

The handout repeats six core requirements across its goal, implementation and validation sections. All six have implementations in the current air-network pilot; implementation is not field validation or a guarantee of a competition result.

| Requirement | Evidence | Remaining demonstration work |
| --- | --- | --- |
| Recommend 2–3 stations jointly | Deterministic greedy marginal coverage objective; Suggest 2 and Suggest 3 | Show one clean repeatable scenario |
| Recompute after each virtual placement | `select_network` updates uncovered cells and rankings; one-at-a-time application is included in subsequent requests | Show a candidate losing value after coverage changes |
| Compare baseline with selected network | Case-study mode shows baseline/recommended/both on one map with matching extents | Explain why the baseline is an evaluation control |
| Quantify each new station's benefit | Per-station added km², cumulative union coverage and weighted gain | Lead with km² in the presentation |
| Demonstrate recommendations change | Overlap regression test; browser checks of three separately applied suggestions | Rehearse the exact three-click story |
| Explain importance/coverage/redundancy trade-off | Historical-PM2.5 importance, no reward for already covered cells, computed displaced-candidate explanation | Explain one real trade-off in plain language |

## Gaps that matter more than another feature

- Candidate points use a sampled urban grid, not verified installable sites. OSM reverse geocoding finds a nearby mapped address; it does not establish site permission, electricity, connectivity or exact property identity.
- Coverage uses a 2 km distance assumption and an approximately 205.8 km² sampled study area. Validate or justify the radius and study area; do not call the result measured city-wide representativeness.
- Costs shown are configured hardware assumptions. The current planner does not choose the smallest network under a real budget or optimize total lifecycle cost. Small positive gains can still yield high-overlap suggestions if users keep requesting more.
- The existing Copilot receives a simulated-station roster and budget context, but not the complete joint plan, per-step metrics, benchmark and OSM address evidence. A plan-grounded explanation is a next improvement, not yet a verified capability.

## Useful assistant role

A read-only plan explainer can summarize the selected locations, before/after coverage, marginal benefit, overlap, configured budget assumptions and limitations. Answers should be grounded in a frozen plan response and address results. It should not invent measurements, costs, addresses, confidence or unrestricted optimality claims. If given planner tools later, it can request and compare scenarios through the same validated backend; applying locations stays an explicit user action.

## Demo recommendation

Show the existing network, generate three locations, compare independent versus joint placement, inspect one changed ranking, then open the basket to show addresses and benefits. Finish with the practical decision: where to investigate installation, how much coverage is expected, and what assumptions must be checked. A concise, reproducible explanation is stronger evidence than an unsupported claim that the system is globally optimal.
