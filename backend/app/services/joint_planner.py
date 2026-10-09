"""Deterministic air-network planning with a common candidate universe and grid."""
from __future__ import annotations

import hashlib
import itertools
import json
import time
from typing import Any

import numpy as np

from app.services.recommendation_engine import generate_city_grid

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


def installed_network(official: list[dict[str, Any]]):
    # Read current module state; the lifecycle service can replace these collections.
    from app.services import sensor_health_service as lifecycle
    active = [s for s in official if s.get("station_type") == 0
              and str(s.get("stationCode", "")).upper() not in lifecycle.DECOMMISSIONED_STATION_CODES]
    base = [{"id": str(s.get("stationCode", s["id"])), "lat": s["lat"], "lng": s["lng"], "name": s["name"]} for s in active]
    for sensor in lifecycle.CUSTOM_REGISTERED_SENSORS:
        if sensor.get("sensorCategory") == "AIR":
            base.append({"id": sensor["stationCode"], "lat": sensor["latitude"], "lng": sensor["longitude"], "name": sensor["name"]})
    return active, base


def planning_network(request, official):
    active, base = installed_network(official)
    base += [s.model_dump() for s in request.existingSimulation if s.category == "air"]
    unique = {}
    for station in base:
        lat, lng = float(station["lat"]), float(station["lng"])
        if np.isfinite(lat) and np.isfinite(lng):
            unique[(round(lat, 6), round(lng, 6))] = station
    base = list(unique.values())
    return active, base


def compare_coverage(request, official):
    _, installed = installed_network(official)
    _, chosen = planning_network(request, official)
    grid = generate_city_grid()
    if not grid:
        raise InfeasiblePlan("The study grid is empty.")
    points = np.array([[g["lat"], g["lng"]] for g in grid])
    areas = (111.195 * 0.0055) ** 2 * np.cos(np.radians(points[:, 0]))
    def measure(stations):
        covered = np.any(distances(points, [[s["lat"], s["lng"]] for s in stations]) <= RADIUS_KM, axis=1) if stations else np.zeros(len(points), dtype=bool)
        area = float(areas[covered].sum())
        return {"coveredKm2": area, "coveragePercent": float(100 * area / areas.sum())}
    return {"installed": measure(installed), "chosen": measure(chosen), "areaKm2": float(areas.sum()), "radiusKm": RADIUS_KM}


def build_joint_plan(request, official: list[dict[str, Any]]):
    started = time.perf_counter()
    active, base = planning_network(request, official)
    grid = generate_city_grid()
    if not grid:
        raise InfeasiblePlan("The study grid is empty.")
    points = np.array([[g["lat"], g["lng"]] for g in grid])
    # The source grid uses 0.0055 degree spacing; each sample represents its local cell.
    areas = (111.195 * 0.0055) ** 2 * np.cos(np.radians(points[:, 0]))
    baseline_mask = np.any(distances(points, [[s["lat"], s["lng"]] for s in base]) <= RADIUS_KM, axis=1) if base else np.zeros(len(points), dtype=bool)
    valid = [s for s in active if isinstance(s.get("pm25"), (int, float)) and np.isfinite(s["pm25"]) and s["pm25"] >= 0]
    warnings = [
        "Air-network pilot: noise and water coverage are not included.",
        "Candidate grid locations need access, land-use and installation checks before deployment.",
        "Circular coverage and interpolated PM2.5 are planning assumptions, not measured representativeness.",
    ]
    if valid:
        d = distances(points, [[s["lat"], s["lng"]] for s in valid])
        w = 1 / np.maximum(d, 0.1) ** 2
        predicted = (w @ np.array([s["pm25"] for s in valid])) / w.sum(axis=1)
        importance = 1 + request.environmentalWeight * np.clip(predicted / 35, 0, 2)
    else:
        predicted = None
        importance = np.ones(len(points))
        warnings.append("No measured PM2.5 values: environmental weighting is unavailable; selection uses additional area only.")
    weighted_cells = areas * importance
    candidate_indices = np.arange(len(points))[::2]
    candidates_xy = points[candidate_indices]
    if base:
        feasible = distances(candidates_xy, [[s["lat"], s["lng"]] for s in base]).min(axis=1) >= max(0.05, request.minSeparationKm)
        candidate_indices = candidate_indices[feasible]
        candidates_xy = points[candidate_indices]
    if len(candidate_indices) < request.stationCount:
        raise InfeasiblePlan("Too few feasible candidate locations.")
    masks = distances(candidates_xy, points) <= RADIUS_KM
    additional = masks & ~baseline_mask
    candidate_ids = [f"air-{lat:.6f}-{lng:.6f}" for lat, lng in candidates_xy]
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
                "category": "air", "hardwareGrade": "unspecified", "name": f"Candidate {i + 1}",
                "estimatedPm25": float(predicted[candidate_indices[i]]) if predicted is not None else None,
                "independentWeightedGain": float(scores[i]),
                "independentAddedKm2": float(areas[additional[i]].sum())}

    def metrics(indices):
        union = np.any(masks[indices], axis=0) | baseline_mask if indices else baseline_mask.copy()
        newly = union & ~baseline_mask
        return {"coveredKm2": float(areas[union].sum()), "coveragePercent": float(100 * areas[union].sum() / areas.sum()),
                "addedKm2": float(areas[newly].sum()), "weightedGain": float(weighted_cells[newly].sum())}

    chosen, steps = [], []
    for raw in raw_steps:
        i = raw["index"]
        chosen.append(i)
        new_area = float(areas[raw["newMask"]].sum())
        footprint = float(areas[masks[i]].sum())
        overlap = 1 - new_area / footprint if footprint else 0
        steps.append({"station": candidate(i), "marginalKm2": new_area, "marginalWeightedGain": raw["gain"],
                      "overlapFraction": overlap, "cumulative": metrics(chosen),
                      "updatedRanking": [{**candidate(r["index"]), "marginalWeightedGain": r["gain"]} for r in raw["ranking"]],
                      "explanation": f"Adds {new_area:.2f} km² of modeled air coverage; {overlap:.0%} of its footprint overlaps prior coverage. Highest feasible marginal weighted gain at this step."})
    violations = [f"{candidate_ids[a]} and {candidate_ids[b]} violate minimum separation." for a, b in itertools.combinations(independent, 2) if conflict[a, b]]
    shortlist = ranked[:min(24, len(ranked))]
    best_indices, best_score = None, -1.0
    for combination in itertools.combinations(shortlist, request.stationCount):
        if any(conflict[a, b] for a, b in itertools.combinations(combination, 2)):
            continue
        score = float(weighted_cells[np.any(additional[list(combination)], axis=0)].sum())
        if score > best_score:
            best_indices, best_score = list(combination), score
    snapshot = {"stations": active, "registered": base, "grid": grid}
    dataset_version = hashlib.sha256(json.dumps(snapshot, sort_keys=True, default=str).encode()).hexdigest()[:16]
    baseline_metrics, final_metrics = metrics(independent), metrics(chosen)
    displaced = next((i for i in independent if i not in chosen), None)
    tradeoff = (
        f"The independent top-{request.stationCount} covers {baseline_metrics['addedKm2']:.2f} additional km². "
        f"The joint plan covers {final_metrics['addedKm2']:.2f} additional km². "
        "Environmental importance weights interpolated PM2.5; overlap contributes no new benefit."
    )
    if displaced is not None:
        after_first = float(weighted_cells[additional[displaced] & ~additional[chosen[0]]].sum())
        tradeoff += f" {candidate(displaced)['name']} scores {scores[displaced]:.2f} independently, but only {after_first:.2f} after the first joint selection."
    return {
        "schemaVersion": "1.0-air", "datasetVersion": dataset_version, "objectiveVersion": "area-pm25-idw-v1",
        "method": "Deterministic greedy marginal gain; heuristic within the sampled candidate set.",
        "studyArea": {"name": "Debrecen urban planning grid", "areaKm2": float(areas.sum()), "gridPoints": len(grid),
                      "radiusKm": RADIUS_KM, "gridStepDegrees": 0.0055, "distanceModel": "Local equirectangular approximation"},
        "assumptions": ["Each grid point represents a local rectangular cell; boundary cells are approximate.",
                        "Importance = 1 + environmentalWeight × clip(IDW PM2.5 / 35, 0, 2). The 35 reference is an objective scale, not a legal threshold.",
                        "Weighted objective units are area × importance, and are not physical km².",
                        "PM2.5 uses available historical station means; source periods can differ. Predictions never become training observations."],
        "warnings": warnings, "existingStations": base, "existingMetrics": metrics([]),
        "baselineRanking": [candidate(i) for i in ranked[:20]],
        "independentPlan": {"stations": [candidate(i) for i in independent], "metrics": baseline_metrics, "constraintViolations": violations},
        "jointPlan": {"stations": [candidate(i) for i in chosen], "metrics": final_metrics}, "steps": steps,
        "tradeoff": tradeoff,
        "benchmark": {"method": f"Exact search restricted to the top {len(shortlist)} independent candidates; not a global bound.",
                      "metrics": metrics(best_indices) if best_indices is not None else None},
        "candidateCount": len(candidate_ids), "elapsedMs": round((time.perf_counter() - started) * 1000, 1),
    }
