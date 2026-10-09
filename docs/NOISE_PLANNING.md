# Noise placement mode

Select Noise in the planning panel, request one, two or three suggestions, inspect each step, and apply them through the location basket. Subsequent suggestions include already applied and manual noise placements. Air and water placements do not supply noise coverage. Switching to Air preserves chosen locations in the basket but excludes noise from air calculations.

## Data and meaning

The source is `data/processed/noise_measurements_cleaned.csv`: 300 daily day/night observations at five georeferenced sites, May 21 through June 19, 2026. The mode uses these as **historical reference sites**, not a verified inventory of operating noise sensors. Missing source data produces an unavailable error, not a fabricated empty network.

The loader validates coordinates, finite values, recognized measurement types and dB units. It combines equal-duration daily periods in sound energy (`10 log10(mean(10^(dB/10)))`), separately for day and night. New/manual placements have no observations and are never added to interpolation training data.

Coverage uses the existing application's **1 km circular planning radius** and the same sampled Debrecen study grid. Buildings, terrain, reflections, source direction and meteorology are not modeled. This distance does not establish acoustic representativeness or regulatory compliance.

When environmental importance is enabled, nighttime levels are interpolated in sound energy using inverse-square distance, limited to historical sites within 5 km; distances are floored at 0.1 km. Unsupported cells receive area-only importance and proposed point estimates are null. Five sites do not provide a validated citywide noise surface.

Noise importance is `1 + environmentalWeight × clip((estimated nighttime dB - 40) / 30, 0, 2)`. This is an explicit heuristic preference scale, not a legal threshold or health-risk model. Zero weight selects by additional area. The objective sums area × importance for newly reached cells; previously covered cells provide no additional gain. Hard spacing is applied without relaxation.

## API

- `POST /api/plans/joint`: `planningCategory` = `air` or `noise`, default air; count 1–3; other request fields unchanged.
- `POST /api/plans/coverage`: same category selection. `installed` retains its compatibility field name but means historical reference sites in noise mode. `radiusKm` = 1 for noise, 2 for air.
- `GET /api/plans/noise-sites`: typed site records with category noise, historical day/night energy means and source period.
- Response schema `1.2-network`, plus `planningCategory`; candidate IDs include the category. Noise candidates have `estimatedPm25: null` and optional `estimatedNightNoise` (null outside data support).
- Co-located different sensor categories are allowed; duplicate coordinates within the same category and duplicate IDs remain invalid.

The pinned Original implementation selects coordinates using its air network. It has no equivalent noise-placement mode; it is **not** rerun on noise sites and relabeled. Noise therefore shows the independent-ranking control against the recalculated joint selection. Original provenance stays in the response with an explicit unavailable reason.

## Transport and costs

DKV activity does not yet affect noise placement. Passenger counts do not measure acoustic levels. The DKV audit identifies coordinate gaps, sampling gaps, composite-score double weighting and apparent cumulative road counters that need preparation before use. See [DKV_DATA_AUDIT.md](DKV_DATA_AUDIT.md).

The basket uses the configured noise hardware estimate (€2,800 per sensor). Cost is displayed as an assumption; the optimizer does not minimize money or validate installation feasibility.

## Validation

Automated checks cover category isolation, a separately calculated 1 km coverage union, marginal-gain reconciliation, sequential apply/resuggest, co-located categories, missing data, invalid coordinates and sound-energy aggregation. Legend tests verify noise's 1/2 km distance bands and planned count. Air regressions and pinned Original checks remain in the full suite.
