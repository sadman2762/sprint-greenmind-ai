# Project guidance

## Team ownership

Read `docs/SHARED_CONTRACT.md` and the appropriate role prompt before starting work. Frontend and backend contributors should use separate working copies and coordinate API changes.

## Verification

- Frontend: from `frontend/`, run `npm test`, `npm run build`, and `npm run lint`.
- `npm test` uses Node's built-in test runner and TypeScript stripping. Use a Node version supporting `--experimental-strip-types`; verified with Node 26.7.0.
- Render tests use Vite SSR and React server rendering. `npm run test:browser` runs Playwright interaction checks against a running Vite server (`MAP_TEST_URL`, default `http://localhost:5173`). It uses synthetic station fixtures and blocks external requests. Install Playwright Chromium or set `PLAYWRIGHT_CHANNEL=msedge` to use an installed Edge browser with a fresh test profile.
- Backend: from `backend/`, run `.venv/bin/python -m pytest tests -q` on macOS/Linux, or the equivalent virtual-environment interpreter on Windows.
- The full frontend lint suite had 23 errors and one warning before the legend work. Do not disable checks to conceal existing failures.

## Frontend conventions

- This project currently uses MUI 9, not the older version described in the overview. Put system styling such as `fontWeight`, `alignItems`, and `flexWrap` in `sx`.
- Map colors, numeric bands, and legend sections are shared in `frontend/src/utils/mapLegend.ts`. Change rendering and legend behavior together, and run the legend tests.
- Monitoring coverage is distance-based, not a pollution concentration or Kriging layer. Keep this distinction explicit.
- qlab discovery was unavailable during the legend fix. The user approved retaining MUI for that targeted change; this does not authorize an unrelated framework migration.

## Data handling

The repository is intentionally public. Never add credentials or local dotenv files. Do not treat simulated values as measured telemetry, or mutate source datasets to make tests pass.
