# Fixed planning scenarios — 9 October 2026

Run from `backend/`: `PYTHONPATH=. .venv/bin/python tools/validate_planning_scenarios.py`. This reads the current official feed and uses isolated in-process scenarios; it does not apply locations to the running app. Runtime lifecycle changes and source updates can change the results.

All five scenarios were declared before evaluation. Existing official network, 2 km reach, 1 km requested separation. Weight defaults to 1 unless stated. The manual test point is 47.5400, 21.5500 and is a validation scenario, not an installation recommendation.

| Scenario | Original extra km² | Joint extra km² | Snapshot |
| --- | ---: | ---: | --- |
| two sensors | 23.747 | 23.739 | 104548b803af7c5c |
| three sensors | 35.626 | 35.619 | 104548b803af7c5c |
| after a manual air location | 33.090 | 35.631 | 8071e35b8777752e |
| area only | 35.626 | 35.633 | 104548b803af7c5c |
| higher pollution priority | 35.626 | 35.619 | 104548b803af7c5c |

Original returned the requested count in all five scenarios. Per-step area and weighted gains reconcile with the final improvements. Differences below a grid cell (~0.25 km²) are too small to establish a meaningful area advantage. These are complete-method comparisons: Original uses its own candidate grid and siting rules.

The manual-location scenario changes the starting network for both methods. It produces a larger area difference; this is one scenario, not proof of general superiority. Raising pollution weight from 1 to 3 did not change the three selected coordinates in this snapshot. Weight zero did change their coordinates. Do not promise that every slider change must move a sensor.

## Demonstration in the app

1. Request three suggestions. Select Start, + 1, + 2, + 3 above the map. The map and coverage card follow the same selection count.
2. At + 1, a previously next-highest alternative falls from 11.87 to 2.78 additional km² and is also excluded by spacing. Locate that alternative on the map. Keep loss of coverage and spacing exclusion distinct.
3. Open Compare methods & results. Original and Joint are shown with the same sensor count and common metrics; the default case is a near tie.
4. Apply one suggestion or place a manual air sensor, then request the next suggestion. The chosen locations form part of the new starting network.
5. In Planning preferences, set pollution priority to zero and regenerate to demonstrate the area-only alternative.

## Actual input factors

The Joint objective currently uses additional area, historical PM2.5 interpolated with IDW, overlap and spacing constraints. It does not use DKV, traffic volumes, installation cost or land-use feasibility. See [DKV_DATA_AUDIT.md](DKV_DATA_AUDIT.md) for the transport-data review.
