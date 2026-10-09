"""Deterministic category-specific network planning on a common evaluation grid."""
from __future__ import annotations

import hashlib
import itertools
import json
import logging
import time
from typing import Any

import numpy as np

from app.services.recommendation_engine import generate_city_grid
from app.services.noise_planning_data import load_noise_sites
from app.services.original_planner import run_original, SOURCE as ORIGINAL_SOURCE

RADIUS_KM = 2.0


class InfeasiblePlan(ValueError):
    pass


def select_network(masks: np.ndarray, weights: np.ndarray, count: int, incompatible: np.ndarray):
    covered = np.zeros(masks.shape[1], dtype=bool)
    available = np.ones(len(masks), dtype=bool)
    steps = []
    for _ in range(count):
        gains = (masks & ~covered) @ weights
        eligible = np.flatnonzero(available & (gains > 1e-10))
        if not len(eligible):
            raise InfeasiblePlan("Not enough feasible candidates with additional coverage. Reduce station count or minimum separation.")
        index = int(eligible[np.argmax(gains[eligible])])
        steps.append({"index": index, "gain": float(gains[index]), "newMask": masks[index] & ~covered})
        covered |= masks[index]
        available &= ~incompatible[index]
        available[index] = False
        updated = (masks & ~covered) @ weights
        ranking = sorted(np.flatnonzero(available), key=lambda i: (-updated[i], i))[:10]
        steps[-1]["ranking"] = [{"index": int(i), "gain": float(updated[i])} for i in ranking]
    return steps


def distances(a, b):
    """Local equirectangular distance, documented as a planning approximation."""
    a, b = np.asarray(a, dtype=float), np.asarray(b, dtype=float)
    dy = (a[:, None, 0] - b[None, :, 0]) * 111.195
    dx = (a[:, None, 1] - b[None, :, 1]) * 111.195 * np.cos(np.radians(47.5316))
    return np.hypot(dx, dy)


def installed_network(official: list[dict[str, Any]], category="air"):
    # Read current module state; the lifecycle service can replace these collections.
    from app.services import sensor_health_service as lifecycle
    source = load_noise_sites() if category == "noise" else official
    if category == "noise" and not source:
        raise InfeasiblePlan("Noise measurement sites are unavailable; a starting network cannot be established.")
    active = [s for s in source if s.get("station_type") == (2 if category == "noise" else 0)
              and str(s.get("stationCode", "")).upper() not in lifecycle.DECOMMISSIONED_STATION_CODES]
    base = [{"id": str(s.get("stationCode") or s["id"]), "lat": s["lat"], "lng": s["lng"], "name": s["name"]} for s in active]
    for sensor in lifecycle.CUSTOM_REGISTERED_SENSORS:
        if sensor.get("sensorCategory") == category.upper():
            base.append({"id": sensor["stationCode"], "lat": sensor["latitude"], "lng": sensor["longitude"], "name": sensor["name"]})
    return active, base


def scenario_radius(request):
    return getattr(request.coverageRadiiKm, request.planningCategory)


def candidate_radius(request):
    return request.newSensorRadiusKm if request.newSensorRadiusKm is not None else scenario_radius(request)


def station_radius(request, station):
    return request.sensorRadiusOverridesKm.get(f"{request.planningCategory}:{station['id']}", scenario_radius(request))


def network_mask(request, points, stations):
    if not stations:
        return np.zeros(len(points), dtype=bool)
    radii = np.array([station_radius(request, s) for s in stations])
    return np.any(distances(points, [[s["lat"], s["lng"]] for s in stations]) <= radii, axis=1)


def planning_network(request, official):
    active, base = installed_network(official, request.planningCategory)
    base += [s.model_dump() for s in request.existingSimulation if s.category == request.planningCategory]
    unique = {}
    for station in base:
        lat, lng = float(station["lat"]), float(station["lng"])
        if np.isfinite(lat) and np.isfinite(lng):
            key = (round(lat, 6), round(lng, 6))
            if key not in unique or station_radius(request, station) > station_radius(request, unique[key]):
                unique[key] = station
    base = list(unique.values())
    return active, base


def compare_coverage(request, official):
    _, installed = installed_network(official, request.planningCategory)
    _, chosen = planning_network(request, official)
    radius = scenario_radius(request)
    grid = generate_city_grid()
    if not grid:
        raise InfeasiblePlan("The study grid is empty.")
    points = np.array([[g["lat"], g["lng"]] for g in grid])
    areas = (111.195 * 0.0055) ** 2 * np.cos(np.radians(points[:, 0]))
    def measure(stations):
        covered = network_mask(request, points, stations)
        area = float(areas[covered].sum())
        return {"coveredKm2": area, "coveragePercent": float(100 * area / areas.sum())}
    return {"installed": measure(installed), "chosen": measure(chosen), "areaKm2": float(areas.sum()), "radiusKm": radius, "planningCategory": request.planningCategory}


def original_comparison(request, active, base, points, areas, weighted_cells, baseline_mask):
    result = {
        "source": ORIGINAL_SOURCE,
        "method": "Original adjacent-frontier selection with dynamic distance updates (upstream defaults).",
        "status": "unavailable", "stations": [], "steps": [], "metrics": None,
        "constraintViolations": [],
        "warnings": [
            "Original preserves its own rules: 2.4 km existing separation, 2.8 km new separation, 1.2 km boundary margin; it can relax these when exhausted.",
            "Original searches the full grid and uses an urban-station filter; Joint searches a subsample with the requested hard separation. This compares complete methods, not only the effect of reranking.",
            f"Both are evaluated on the same current network and user-configured radii ({candidate_radius(request):g} km for new air sensors). Original selection itself retains its historical rules. IDW/ML values are not new measurements.",
        ],
    }
    observed = {(round(float(s['lat']), 6), round(float(s['lng']), 6)): s for s in active}
    # Preserve real measurements at installed sites; added sites are coordinates
    # only, never interpolated observations. Both methods receive the same roster.
    inputs = [{**observed.get((round(float(s['lat']), 6), round(float(s['lng']), 6)), {}),
               **s, "station_type": 0} for s in base]
    try:
        old = run_original(inputs, request.stationCount)
        union = baseline_mask.copy()
        for index, station in enumerate(old):
            lat, lng = float(station['lat']), float(station['lng'])
            if not np.isfinite(lat) or not np.isfinite(lng):
                raise ValueError("Invalid Original coordinates")
            footprint = distances([[lat, lng]], points)[0] <= candidate_radius(request)
            new = footprint & ~union
            standalone = footprint & ~baseline_mask
            union |= footprint
            row = {"id": f"original-air-{lat:.6f}-{lng:.6f}", "name": station['name'],
                   "lat": lat, "lng": lng, "category": "air", "radiusKm": candidate_radius(request), "hardwareGrade": "unspecified",
                   "estimatedPm25": None, "originalPriorityScore": station.get('priorityScore'),
                   "independentWeightedGain": float(weighted_cells[standalone].sum()),
                   "independentAddedKm2": float(areas[standalone].sum())}
            result['stations'].append(row)
            result['steps'].append({"station": row, "marginalKm2": float(areas[new].sum()),
                                   "marginalWeightedGain": float(weighted_cells[new].sum())})
            prior = base + result['stations'][:-1]
            if prior and distances([[lat, lng]], [[s['lat'], s['lng']] for s in prior]).min() < max(0.05, request.minSeparationKm):
                result['constraintViolations'].append(f"Original location {index + 1} does not meet the requested {request.minSeparationKm:g} km separation.")
        newly = union & ~baseline_mask
        result['metrics'] = {"coveredKm2": float(areas[union].sum()),
                             "coveragePercent": float(100 * areas[union].sum() / areas.sum()),
                             "addedKm2": float(areas[newly].sum()), "weightedGain": float(weighted_cells[newly].sum())}
        result['status'] = 'available' if len(old) == request.stationCount else 'partial'
        if result['status'] == 'partial':
            result['warnings'].insert(0, f"Original returned {len(old)} of {request.stationCount} requested locations. This is not an equal-count comparison.")
    except Exception:
        logging.getLogger(__name__).exception("Original method comparison failed")
        result.update(status='unavailable', stations=[], steps=[], metrics=None)
        result['warnings'].insert(0, "Original could not be calculated. No independent-control result has been substituted.")
    return result


def environmental_field(request, active, points):
    category = request.planningCategory
    reading = "nighttimeNoise" if category == "noise" else "pm25"
    valid = [s for s in active if isinstance(s.get(reading), (int, float)) and np.isfinite(s[reading]) and s[reading] >= 0]
    warnings = [
        "Air-network pilot: noise and water coverage are not included.",
        "Candidate grid locations need access, land-use and installation checks before deployment.",
        "Circular coverage and interpolated PM2.5 are planning assumptions, not measured representativeness.",
    ]
    if category == "noise":
        warnings = ["Noise planning uses historical measurement sites, not a verified live sensor inventory.",
                    "Configured circular radii are scenario inputs, not an acoustic propagation model.",
                    "Nighttime sound-energy IDW is supported only within 5 km of measured sites; elsewhere selection uses area only.",
                    "Air and water sensors do not supply noise coverage. DKV activity does not yet affect this objective.",
                    "Candidate locations still need access and installation checks."]
    if valid:
        d = distances(points, [[s["lat"], s["lng"]] for s in valid])
        w = 1 / np.maximum(d, 0.1) ** 2
        observations = np.array([s[reading] for s in valid])
        if category == "noise":
            w[d > 5.0] = 0
            supported = w.sum(axis=1) > 0
            predicted = np.full(len(points), np.nan)
            predicted[supported] = 10 * np.log10((w[supported] @ (10 ** (observations / 10))) / w[supported].sum(axis=1))
            importance = np.ones(len(points))
            importance[supported] += request.environmentalWeight * np.clip((predicted[supported] - 40) / 30, 0, 2)
        else:
            predicted = (w @ observations) / w.sum(axis=1)
            importance = 1 + request.environmentalWeight * np.clip(predicted / 35, 0, 2)
    else:
        predicted = None
        importance = np.ones(len(points))
        warnings.append(f"No measured {reading} values: environmental weighting is unavailable; selection uses additional area only.")
    return predicted, importance, warnings


def build_joint_plan(request, official: list[dict[str, Any]]):
    started = time.perf_counter()
    active, base = planning_network(request, official)
    category = request.planningCategory
    radius = candidate_radius(request)
    grid = generate_city_grid()
    if not grid:
        raise InfeasiblePlan("The study grid is empty.")
    points = np.array([[g["lat"], g["lng"]] for g in grid])
    # The source grid uses 0.0055 degree spacing; each sample represents its local cell.
    areas = (111.195 * 0.0055) ** 2 * np.cos(np.radians(points[:, 0]))
    baseline_mask = network_mask(request, points, base)
    predicted, importance, warnings = environmental_field(request, active, points)
    weighted_cells = areas * importance
    candidate_indices = np.arange(len(points))[::2]
    candidates_xy = points[candidate_indices]
    if base:
        feasible = distances(candidates_xy, [[s["lat"], s["lng"]] for s in base]).min(axis=1) >= max(0.05, request.minSeparationKm)
        candidate_indices = candidate_indices[feasible]
        candidates_xy = points[candidate_indices]
    if len(candidate_indices) < request.stationCount:
        raise InfeasiblePlan("Too few feasible candidate locations.")
    masks = distances(candidates_xy, points) <= radius
    additional = masks & ~baseline_mask
    candidate_ids = [f"{category}-{lat:.6f}-{lng:.6f}" for lat, lng in candidates_xy]
    # Stable location IDs also provide a stable tie break across recalculation.
    order = np.argsort(candidate_ids)
    candidate_indices, candidates_xy, masks, additional = candidate_indices[order], candidates_xy[order], masks[order], additional[order]
    candidate_ids = [candidate_ids[i] for i in order]
    conflict = distances(candidates_xy, candidates_xy) < max(0.05, request.minSeparationKm)
    np.fill_diagonal(conflict, True)
    scores = additional @ weighted_cells
    ranked = sorted(range(len(scores)), key=lambda i: (-scores[i], candidate_ids[i]))
    independent = ranked[:request.stationCount]
    raw_steps = select_network(additional, weighted_cells, request.stationCount, conflict)

    def candidate(i):
        return {"id": candidate_ids[i], "lat": float(candidates_xy[i, 0]), "lng": float(candidates_xy[i, 1]),
                "category": category, "radiusKm": radius, "hardwareGrade": "unspecified", "name": f"Candidate {i + 1}",
                "estimatedPm25": float(predicted[candidate_indices[i]]) if category == "air" and predicted is not None else None,
                "estimatedNightNoise": float(predicted[candidate_indices[i]]) if category == "noise" and predicted is not None and np.isfinite(predicted[candidate_indices[i]]) else None,
                "independentWeightedGain": float(scores[i]),
                "independentAddedKm2": float(areas[additional[i]].sum())}

    def metrics(indices):
        union = np.any(masks[indices], axis=0) | baseline_mask if indices else baseline_mask.copy()
        newly = union & ~baseline_mask
        return {"coveredKm2": float(areas[union].sum()), "coveragePercent": float(100 * areas[union].sum() / areas.sum()),
                "addedKm2": float(areas[newly].sum()), "weightedGain": float(weighted_cells[newly].sum())}

    chosen, steps = [], []
    covered = np.zeros(len(points), dtype=bool)
    available = np.ones(len(candidates_xy), dtype=bool)
    for raw in raw_steps:
        i = raw["index"]
        # Explain a real runner-up before/after this placement, including
        # candidates that disappear from the truncated updated ranking.
        before_gains = (additional & ~covered) @ weighted_cells
        alternatives = [j for j in np.flatnonzero(available) if j != i and before_gains[j] > 1e-10]
        runner_up = max(alternatives, key=lambda j: (before_gains[j], -j)) if alternatives else None
        recalculation = None
        if runner_up is not None:
            prior_area = float(areas[additional[runner_up] & ~covered].sum())
            remaining_area = float(areas[additional[runner_up] & ~covered & ~additional[i]].sum())
            recalculation = {
                "station": candidate(runner_up), "beforeKm2": prior_area, "afterKm2": remaining_area,
                "beforeWeightedGain": float(before_gains[runner_up]),
                "afterWeightedGain": float(weighted_cells[additional[runner_up] & ~covered & ~additional[i]].sum()),
                "excludedBySeparation": bool(conflict[i, runner_up]),
            }
        chosen.append(i)
        covered |= additional[i]
        available &= ~conflict[i]
        new_area = float(areas[raw["newMask"]].sum())
        footprint = float(areas[masks[i]].sum())
        overlap = 1 - new_area / footprint if footprint else 0
        steps.append({"station": candidate(i), "marginalKm2": new_area, "marginalWeightedGain": raw["gain"],
                      "overlapFraction": overlap, "cumulative": metrics(chosen), "recalculation": recalculation,
                      "updatedRanking": [{**candidate(r["index"]), "marginalWeightedGain": r["gain"]} for r in raw["ranking"]],
                      "explanation": f"Adds {new_area:.2f} km² of modeled {category} coverage; {overlap:.0%} of its footprint overlaps prior coverage. Highest feasible marginal weighted gain at this step."})
    violations = [f"{candidate_ids[a]} and {candidate_ids[b]} violate minimum separation." for a, b in itertools.combinations(independent, 2) if conflict[a, b]]
    shortlist = ranked[:min(24, len(ranked))]
    best_indices, best_score = None, -1.0
    for combination in itertools.combinations(shortlist, request.stationCount):
        if any(conflict[a, b] for a, b in itertools.combinations(combination, 2)):
            continue
        score = float(weighted_cells[np.any(additional[list(combination)], axis=0)].sum())
        if score > best_score:
            best_indices, best_score = list(combination), score
    warnings.append("Radii are configurable scenario inputs, not verified instrument detection ranges. Per-sensor overrides apply to the starting network; new suggestions use the configured new-sensor radius.")
    snapshot = {"stations": active, "registered": base, "grid": grid}
    dataset_version = hashlib.sha256(json.dumps(snapshot, sort_keys=True, default=str).encode()).hexdigest()[:16]
    baseline_metrics, final_metrics = metrics(independent), metrics(chosen)
    displaced = next((i for i in independent if i not in chosen), None)
    tradeoff = (
        f"The independent top-{request.stationCount} covers {baseline_metrics['addedKm2']:.2f} additional km². "
        f"The joint plan covers {final_metrics['addedKm2']:.2f} additional km². "
        f"Environmental importance weights {'nighttime noise estimates' if category == 'noise' else 'interpolated PM2.5'}; overlap contributes no new benefit."
    )
    if displaced is not None:
        after_first = float(weighted_cells[additional[displaced] & ~additional[chosen[0]]].sum())
        tradeoff += f" {candidate(displaced)['name']} scores {scores[displaced]:.2f} independently, but only {after_first:.2f} after the first joint selection."
    original = original_comparison(request, active, base, points, areas, weighted_cells, baseline_mask) if category == "air" else {
        "source": ORIGINAL_SOURCE, "method": "Original engine selects air-network coordinates.",
        "status": "unavailable", "stations": [], "steps": [], "metrics": None, "constraintViolations": [],
        "warnings": ["An equivalent Original noise-placement mode does not exist. The air result is not relabeled as a noise baseline. Use the independent noise-ranking control instead."],
    }
    if original['status'] == 'available':
        original_area = original['metrics']['addedKm2']
        delta = final_metrics['addedKm2'] - original_area
        original_summary = (f"Original adds {original_area:.2f} km²; Joint adds {final_metrics['addedKm2']:.2f} km² "
                            f"({abs(delta):.2f} km² {'more' if delta >= 0 else 'less'} with Joint). "
                            "Both methods already update coverage between selections; their objectives and siting rules differ.")
    else:
        original_summary = "An equal-count Original comparison is unavailable. See the Original status and warnings."
    return {
        "schemaVersion": "1.3-ranges", "rangeSettings": {"newSensorRadiusKm": radius, "coverageRadiiKm": request.coverageRadiiKm.model_dump(), "sensorRadiusOverridesKm": request.sensorRadiusOverridesKm}, "planningCategory": category, "originalPlan": original, "originalComparison": original_summary, "datasetVersion": dataset_version, "objectiveVersion": "area-night-noise-idw-v1" if category == "noise" else "area-pm25-idw-v1",
        "method": "Deterministic greedy marginal gain; heuristic within the sampled candidate set.",
        "studyArea": {"name": "Debrecen urban planning grid", "areaKm2": float(areas.sum()), "gridPoints": len(grid),
                      "radiusKm": radius, "gridStepDegrees": 0.0055, "distanceModel": "Local equirectangular approximation"},
        "assumptions": (["Noise measurements cover " + min((s.get("periodStart", "unknown") for s in active), default="unknown") + " to " + max((s.get("periodEnd", "unknown") for s in active), default="unknown") + ".",
                         "Equal-duration day/night observations are averaged in sound energy. The planning weight uses nighttime estimates only.",
                         "Noise importance = 1 + environmentalWeight × clip((estimated nighttime dB - 40) / 30, 0, 2). The scale is a planning preference, not a legal threshold.",
                         "The sparse observations do not establish noise levels at proposed locations. Unsupported cells receive area-only weight.",
                         "Weighted gains are not physical km². Boundary cells are approximate."] if category == "noise" else ["Each grid point represents a local rectangular cell; boundary cells are approximate.",
                        "Importance = 1 + environmentalWeight × clip(IDW PM2.5 / 35, 0, 2). The 35 reference is an objective scale, not a legal threshold.",
                        "Weighted objective units are area × importance, and are not physical km².",
                        "PM2.5 uses available historical station means; source periods can differ. Predictions never become training observations."]),
        "warnings": warnings, "existingStations": base, "existingMetrics": metrics([]),
        "baselineRanking": [candidate(i) for i in ranked[:20]],
        "independentPlan": {"stations": [candidate(i) for i in independent], "metrics": baseline_metrics, "constraintViolations": violations},
        "jointPlan": {"stations": [candidate(i) for i in chosen], "metrics": final_metrics}, "steps": steps,
        "tradeoff": tradeoff,
        "benchmark": {"method": f"Exact search restricted to the top {len(shortlist)} independent candidates; not a global bound.",
                      "metrics": metrics(best_indices) if best_indices is not None else None},
        "candidateCount": len(candidate_ids), "elapsedMs": round((time.perf_counter() - started) * 1000, 1),
    }
