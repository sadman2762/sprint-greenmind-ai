# UI and voice integration review — 2026-10-10

Reviewed upstream UI commit `28edb2b`, already merged into `main` as `ce849e4` via [PR #5](https://github.com/sadman2762/sprint-greenmind-ai/pull/5). The published `feat/sensor-planning-ux` tip `4f2cd52` is also already included in main. GitHub's default branch is main; the local origin/HEAD reference still points to historical master.

## Git and publication

Fetch and `git push --dry-run origin HEAD:refs/heads/feat/sensor-planning-ux` succeeded. The initial review was read-only with respect to publication. The user subsequently authorized committing and merging the integrated changes. GitHub reported no check runs for PR #5, so its merged state is not evidence of automated verification.

The latest local voice-policy changes had not been committed or pushed. Applying them to current main produced one conflict in CityMap.tsx: the responsive Add sensor button and the Layers button's voice-control ref. Resolved in the review copy by preserving both changes.

Prepared review copy: `/tmp/greenmind-pr-review`, branch `review/ui-voice-compatibility`, based on `ce849e4`. It contains the new UI, the local voice-policy work and the fixes below. The reviewed changes are prepared for the user-authorized commit and merge. The original checkout and its voice work remain intact. Preview: http://127.0.0.1:5177 (review backend on port 8002).

## Findings fixed in the review copy

1. Voice could remain in Processing after a delegated answer with no tool calls or after an upstream error. Completing/cancelling an older delegation could also clear a newer request's processing indicator. Added three reproducing regression tests and corrected the status transitions, including integration with policy refusals.
2. The voice Before/After handler did not stop automatic sensor reveal, unlike the equivalent UI controls. Voice comparison now pauses playback; the browser regression checks this behavior.
3. Resolved the CityMap merge conflict without removing responsive UI or voice control.

The integration browser harness now assigns a fresh delegation after the synthetic moderation error. Reusing the cancelled delegation incorrectly made subsequent fixture commands appear cancelled, as expected from the runtime safety behavior.

## Verification

| Check | Published new UI | Integrated review copy |
| --- | --- | --- |
| Backend tests | 69 passed | 88 passed |
| Frontend unit/render tests | 49 passed | 55 passed |
| Production build | Passed | Passed |
| Browser scenarios | 15 passed | 15 passed (14 together, expanded voice rerun after fixture correction) |
| Full lint | 22 errors, 1 warning | Same 22 errors, 1 warning |
| Conflict markers / diff whitespace | Clean | Clean |

Browser coverage includes map and inspector, legend, Air/Water/Noise controls, historical conditions, animated proposal reveal, draft dragging/radii, graph, planner/export, live transport and expanded voice/policy actions. Existing lint failures were not disabled. Vite still warns about the main bundle size.

The initial integrated browser run encountered Outdated Optimize Dep responses because the temporary copy shared the original node_modules cache. Reran with an isolated Vite cache; this was test-environment interference, not an application API regression.

Real-service smoke checks against the review backend:

- Historical conditions loaded without a conditions error; station/connection inspection produced no browser errors.
- Generated three unapplied proposals with HTTP 200. Returned coverage: 36.9291% before, 54.2354% after. Before hid proposal markers; After showed all three. No browser page errors. No suggestions were applied to the user's stored plan.
- Live transport returned 1006 vehicle positions from BKK Budapest. This does not establish live DKV coverage.
- Actual prerecorded speech through Azure GPT-Live successfully switched the new UI to Water; a successful set_network result was observed.

## Before the next PR

Use the integrated changes on top of current main, not a replacement of the new UI with the older feature-branch files. The user authorized committing, pushing and merging the prepared changes into main. Include the new shared/voice-policy.json and policy runtime/tests. Do not commit local environment files, dependencies or credentials. A clean lint gate is still not satisfied; current lint failures predate this UI and voice integration.


## City demo follow-up

Added a Debrecen/Budapest header selector with smooth map travel and reduced-motion support. Budapest displays the live BKK transport map and hides Debrecen planning controls and historical KPIs; switching back preserves the plan. Voice can also switch cities, and planning mutations require returning to Debrecen. Removed the model/deployment subtitle and the ordinary Planning preferences entry point. Algorithm defaults and scenario-radius controls remain available.

Both city-switch browser tests passed, along with 11 affected map/voice/transport/reveal browser scenarios; the expanded voice-city check passed again afterward. Frontend unit tests (55), backend tests (88), build and unchanged lint baseline were verified. The review backend uses the existing provider-matched BKK routes cache to identify vehicle types. The cache is ignored and is not part of the commit; new installations should run backend/tools/update_transit_routes.py.
