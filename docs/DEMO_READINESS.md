# Greenmind demo readiness

Verified on 10 October 2026, on top of upstream `main` at `7750e34`.
Preview: http://127.0.0.1:5175 (isolated backend: port 8001).

## Requirement audit

| Requested capability | Result and verification |
| --- | --- |
| Pull the current repository | Pulled the requested repository's main branch with fast-forward only before reconciling the UI work. Local edits preserved. |
| Premium light application shell | Implemented warm surfaces, refined typography, compact navigation, segmented environmental selector, restrained shadows, and floating map actions. |
| Map dominates the workspace | Compact desktop sidebar leaves roughly 80% of workspace width for Leaflet. Compact KPIs preserve map space; expanding Conditions temporarily uses vertical space for charts. Inspector remains contextual. |
| Preserve map interactions and sensor controls | Browser checks cover map controls, layers, sensor selection, radius controls, proposal editing, and responsive layout. Fixed toolbar overlap with the inspector and transport panel. |
| Cinematic optimization | Runs the existing optimizer, then sequentially reveals returned sensors and animates their coverage circles. Supports pause, replay, keyboard step selection, and reduced motion. Grid and metrics reflect returned results rather than animation interpolation. |
| Existing network and uncovered areas | Preserved existing sensors and near/mid-range/gap grid. Grid and cumulative coverage change with the selected returned step. |
| Marginal coverage gain | Displays returned marginal area when available. No fabricated gain or cost savings. |
| Before/after | Preserved shared-map Before/After controls; improved coverage cards, bars, percentage-point improvement, and transition from reveal to comparison. A draggable wipe slider was not added; the progression slider selects actual optimization steps. |
| Recommended sensor count and cost | Returned recommendation count is shown. No new cost estimate without supported inputs was introduced. |
| GPT Live 1 voice | Preserved upstream voice/backend command integration. Improved microphone control, floating conversation panel, listening/processing/speaking/action states, transcript feedback, and configuration retry. Automated tests verify audio state transitions and map commands using a synthetic session. A real Azure conversation is still pending configuration. |
| Knowledge graph | Contextual graph panel has sensor history navigation and focus/hover transitions. Browser checks verify node navigation and radius-related updates. |
| Live transport | Optional overlay preserved; toolbar/panel overlap fixed. Synthetic feed browser checks pass for updates, stale data, errors, visibility, and mobile layout. Real feed verification remains pending configuration. |
| Guided presentation | Lightweight five-step guide remains in the planner. It guides the existing workspace; it is not an automatically driven tour. |
| Screenshot KPIs | Added compact historical Air/Water/Noise KPIs and expandable chart cards, including water metric selection, dates, reporting-site counts, provenance, and accessible daily values. Reused the existing conditions implementation from the separate local checkout without modifying that checkout. |
| Preserve algorithms, data, and state | No optimization algorithm or dataset changes. Existing state providers and storage remain in use. Leaflet retained. Existing backend contracts retained; one additive conditions endpoint supplies the requested KPIs. |
| Dependencies | No new runtime dependency declarations. Charts use the existing chart library and load on demand. |

## Data checked against the running backend

The historical conditions endpoint returns the following latest measurements for
19 June 2026. These are measurements at reporting sites, not live city-wide
conditions or safety assessments:

| KPI | Value | Reporting sites |
| --- | --- | --- |
| Air PM2.5 | 7.54 µg/m³ | 16 |
| Water conductivity | 1.37 mS/cm | 15 |
| Noise, daytime | 58.69 dB | 5 |
| Noise, nighttime | 54.46 dB | 5 |

The backend preserves missing measurements as missing values. Noise aggregation
uses sound energy before conversion back to decibels.

A real-backend smoke check generated three recommendations and verified that the
UI matched the response: coverage 36.9291% before and 54.2354% after, with
35.6188359 km² additional modeled coverage, dataset `104548b803af7c5c`.
These are results of that checked planning scenario, not universal improvements.
The smoke check did not apply the recommendations to the user's saved network.

## Validation

- Production frontend build: passed. Vite still reports a large main bundle warning.
- Frontend unit/render tests: 49 passed.
- Backend tests: 69 passed, with two deprecation warnings.
- Relevant browser tests: 15 passed, covering conditions, voice, optimization reveal,
  map workspace, planner, proposal editing, graph, and transport.
- Real-backend browser smoke check: passed, including conditions, recommendations,
  displayed coverage, and Before/After; no browser page errors.
- Full frontend lint: not clean; 22 existing errors and one existing warning remain.
  No additional lint findings were introduced. Existing findings include legacy
  copilot, budget, maintenance, simulation, theme export, and sensor-health code.
- `git diff --check`: passed.

## Remaining live-service checks

The isolated backend's voice status reports missing:

- `VOICE_AZURE_OPENAI_ENDPOINT`
- `VOICE_AZURE_OPENAI_DEPLOYMENT`
- `VOICE_AZURE_OPENAI_REASONING_DEPLOYMENT`
- `VOICE_AZURE_OPENAI_API_KEY`

Provide the path to the working configuration or a configured backend URL to
complete a real microphone-to-Azure-to-map check. Do not paste credentials into
the conversation. The UI exposes configuration status and allows retrying after
the backend is configured. Synthetic browser checks do not establish live service
availability. The real transportation feed is also unconfigured in this preview.

## Suggested 5–7 minute demo

1. Introduce the monitoring problem with the compact historical KPIs. Briefly open
   Conditions to show the three chart cards, then close it to restore map space.
2. Select an environmental layer and show the existing network and coverage gaps.
3. Set the desired radius and run Optimize network using the existing planner.
4. Let the returned sensor reveal play; pause on a step to explain marginal gain.
5. Switch between Before and After and read the actual coverage metrics.
6. Explore a sensor's connections. Use voice and live transport during the jury
   demo only after their real service checks have passed.

This audit records the implementation and validation before publication. No
deployment was performed as part of these checks.
