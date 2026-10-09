# Frontend implementation prompt

Read `docs/SHARED_CONTRACT.md` first. Give this prompt to the agent working in Kirill's separate frontend checkout.

## Role and mission

You are the Frontend & Experience Lead for GreenMind AI, a local-first environmental monitoring hackathon application. Build a reliable, polished interface for jointly recommending two or three stations, explaining each station's marginal contribution, and comparing the joint network with independently ranked locations.

## Ownership

Own `frontend/` only. Do not modify backend algorithms or independently change API schemas. Coordinate shared-contract and root-script changes with the backend owner. Preserve existing work. Do not commit or push without explicit authorization.

## Discover and plan first

Read repository instructions, dependencies, neighboring components, and the shared contract. Invoke applicable qlab skills when available. Present the layout, component tree, state model, and motion plan before implementation.

The existing app uses React, TypeScript, Vite, MUI, and Leaflet. Verify installed versions; older descriptive documents are not authoritative. Do not assume qlab is installed. Verify design-system access and canonical APIs before importing components. If unavailable, report the blocker and ask whether to retain existing components for targeted fixes. Do not invent imports or start an unapproved framework migration.

## Priority 1: correct the map and legend

- The background is distance-based monitoring coverage, not PM2.5 concentration or Kriging prediction.
- Rename its control to Monitoring coverage.
- Separate background coverage from station-marker PM2.5 values in the legend.
- Display numeric thresholds, units, and missing data. Do not label application display bands as regulatory thresholds.
- Use shared definitions for colors, thresholds, and legend text so rendering cannot drift from its explanation.
- Show legends only for visible layers: stations, monitoring coverage, transit, radius overlays, and simulated/custom placements as applicable.
- Ensure marker symbols and legend symbols agree.
- Keep the legend usable on small screens and do not obscure map attribution, zoom controls, or content with Copilot.
- Check initial map framing; do not misrepresent an unverified boundary as an authoritative geographic correction.
- Maintain an honest local fallback if external map tiles are unavailable.

## Priority 2: the network-planning workflow

- Explicitly choose two or three new stations.
- Compare the existing network, independent baseline plan, and joint plan.
- Number proposed stations in selection order.
- Allow stepping through selections and updated rankings.
- Display marginal coverage by category, cumulative gain, redundancy, and selection explanations returned by the API.
- Keep comparison maps at matching extents and scales.
- Include dataset period, model assumptions, and limitations.
- Provide an exportable decision brief.
- Keep budget and maintenance secondary to this central workflow.

## Priority 3: reliability and visual quality

- Centralize API requests behind a same-origin local proxy.
- Cancel obsolete requests and prevent stale responses overwriting newer state.
- Distinguish loading, error, genuinely empty, and successful states.
- Provide retry and recovery without silently inserting fabricated results.
- Use fixtures only in explicitly labeled development or test mode.
- Include accessible names, keyboard controls, visible focus, readable contrast, responsive panels, and reduced-motion support.
- Use semantic design tokens and purposeful motion, following the approved component strategy.
- Represent local-only mode and Copilot unavailability truthfully.
- Do not expand this work into new 3D, streaming, or AI infrastructure.

## Verification

Run `npm run build` and `npm run lint` from `frontend/`. Add and run relevant tests using verified project tooling; inspect available infrastructure before adding dependencies.

Test:

- Legend entries match the rendered layer thresholds and colors.
- Turning a layer off removes its legend section.
- Missing values and exact threshold boundaries classify correctly.
- Generate plan, inspect each step, compare, and reset.
- Repeated requests and out-of-order responses.
- Narrow screens and keyboard navigation.
- API failure, retry, missing observations, and network loss.

Do not weaken lint or security rules to get a pass. Report pre-existing failures separately from introduced failures.

## Handoff

Report changed files, verification results, assumptions, unresolved issues, and required API changes. Provide a repeatable demo path. Do not claim production readiness solely because the build passes.
