# DKV factor audit — 9 October 2026

The air Joint placement objective currently uses uncovered area and IDW-estimated historical PM2.5. DKV data does not influence air or noise Joint selection. The noise mode uses a separate historical nighttime sound-energy estimate. DKV is shown as a separate map layer. The pinned Original engine loads DKV data, but evaluates traffic influence and ML outputs after choosing each coordinate. Its selection loop uses coverage, adjacency, centrality, hardcoded place anchors, boundary and sector heuristics.

## Verified sources

| Source | What it contains | Current use |
| --- | --- | --- |
| `data/raw/dkv/Summary stop statistics/2026/05.xlsx`, `Summary stop stats` | May 1–31, 2026; 718 stop/direction records, 396 distinct names; APC/all planned stopping counts, boardings, alightings, occupancy and delay | Notebook produces the current map dataset |
| `data/raw/dkv/List of bus stops.xlsx` | Stop/platform coordinates, vehicle types, shelter, lighting, accessibility and bus-bay attributes | Notebook averages coordinates by stop name |
| `data/raw/dkv/Service Schedule.xlsx` | Routes, variants, departure/arrival times, endpoints and service-calendar codes | Not used by Joint |
| `data/raw/dkv/Summary line statistics/2026/05.xlsx` | APC/all trips, transported persons and passenger-km by line | Not used by Joint |
| `data/raw/dkv/Enclod archive data/2026/05.csv` | 119,453 rows at 40 coordinate pairs, May 1 through June 1 midnight; vehicle-category/speed counter fields | Not used by Joint or current stop-activity preprocessing |

## Findings

- `notebooks/02_dkv_data_analysis.ipynb` reads **only May 2026**. The repository contains additional monthly files, but they are not represented in `data/processed/traffic_activity.csv`.
- The processed CSV has **396 names; 41 have missing coordinates**, leaving 355 geolocated entries. Backend silently skips entries without usable coordinates.
- Raw passenger frequency equals IN + OUT for **all 718 stop records**. It is not bus frequency or unique people. Counting it alongside IN and OUT in a composite score gives repeated weight to the same underlying activity.
- Current score: 40% min-max normalized passenger frequency + 25% normalized IN + 25% normalized OUT + 10% average normalized arrival/departure occupancy. These are developer-chosen weights, not DKV's measured pollution or validated exposure score.
- The notebook normalizes individual platform rows, then averages their scores by name while summing passenger counts. This can produce different rankings from aggregate passenger activity. It averages same-name coordinates, which may land between platforms rather than at an installable site.
- **46 records have scheduled stopping but zero APC stopping**. Total APC stopping is 307,915 versus 1,595,976 all planned stopping (~19.3%). This ratio describes the supplied stopping fields, not a verified passenger sampling rate. Zero APC must not be read as zero demand; avoid unvalidated extrapolation.
- Two IN records are negative: -1 at Nagyállomás and -2 at Sámsoni út. The notebook replaces only -1 with zero. Aggregation hides the negative -2 in the processed Sámsoni út total. Derived frequency is not reconciled after that replacement. No source files were changed during this audit.
- Archive vehicle fields appear cumulative: for one checked location, `cars_60+` progresses from 805,556 to 853,623 through the month. Series have occasional decreases and irregular record counts. **Do not sum counter readings as traffic volume.** Verify device identity, timestamp duplicates, counter resets, units and category definitions before calculating interval changes. The May header contains `cars_60+` but lacks other car-speed bands; this is not yet a complete all-vehicle traffic metric. January 2025 contains a header with no data rows.

## Recommended incorporation

1. Preserve stop identity/platforms and source month. Resolve missing coordinate joins explicitly; retain unmatched entries as unavailable.
2. Use a single passenger-activity measure (boardings + alightings), with APC coverage shown separately. Treat it as recorded transit activity, not unique residents or road emissions. Use more months for robustness once compatible reporting periods and sampling are checked.
3. For road traffic, derive valid per-device counter increments with reset/gap handling and report the measured categories. Do not invent absent vehicle categories or calibrate pollution from passenger counts alone.
4. Add an optional, separately labeled **Transit activity priority** after the data preparation is validated. Count newly reached stop activity once after each placement, so several nearby sensors do not receive duplicate credit. Keep additional physical area as a separate output.
5. Compare transport priority off/on using the same sensor count and current network. Report both area and newly reached recorded activity, plus unavailable data and source period. Keep Original's selection unchanged and evaluate both plans on the common metrics.

The available data supports a grounded transport extension, but the current 0–100 score should not be presented as measured road traffic, pollution risk or confidence.
