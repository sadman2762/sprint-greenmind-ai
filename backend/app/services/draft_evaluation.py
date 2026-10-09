"""Evaluate user-edited proposals in their given order, without selecting new sites."""
import numpy as np
from app.services.joint_planner import (
    InfeasiblePlan, planning_network, network_mask, candidate_radius,
    environmental_field, distances, generate_city_grid,
)
from app.services.recommendation_engine import is_inside_debrecen


def evaluate_draft_plan(request, official):
    active, base = planning_network(request, official)
    rows = [s.model_dump() for s in request.proposedStations]
    if any(not is_inside_debrecen(s['lat'], s['lng']) for s in rows):
        raise InfeasiblePlan("Keep proposed locations inside the study boundary.")
    grid = generate_city_grid()
    if not grid:
        raise InfeasiblePlan("The study grid is empty.")
    points = np.array([[g['lat'], g['lng']] for g in grid])
    areas = (111.195 * .0055) ** 2 * np.cos(np.radians(points[:, 0]))
    _, importance, warnings = environmental_field(request, active, points)
    weighted = areas * importance
    baseline = network_mask(request, points, base)
    union = baseline.copy()
    warnings.append("Manually adjusted proposal: metrics are recalculated in the displayed order; these coordinates are not a new optimizer result.")

    def metrics(mask):
        added = mask & ~baseline
        return dict(coveredKm2=float(areas[mask].sum()), coveragePercent=float(100 * areas[mask].sum() / areas.sum()),
                    addedKm2=float(areas[added].sum()), weightedGain=float(weighted[added].sum()))

    steps = []
    for index, row in enumerate(rows):
        radius = row['radiusKm'] if row['radiusKm'] is not None else candidate_radius(request)
        prior = base + rows[:index]
        if prior and distances([[row['lat'], row['lng']]], [[s['lat'], s['lng']] for s in prior]).min() < max(.05, request.minSeparationKm):
            warnings.append(f"Location {index + 1} is closer than the requested {request.minSeparationKm:g} km spacing to another location.")
        footprint = distances(points, [[row['lat'], row['lng']]])[:, 0] <= radius
        added = footprint & ~union
        independent = footprint & ~baseline
        total_area = float(areas[footprint].sum())
        extra = float(areas[added].sum())
        overlap = 1 - extra / total_area if total_area else 0
        station = {**row, 'radiusKm': radius, 'estimatedPm25': None, 'estimatedNightNoise': None,
                   'independentWeightedGain': float(weighted[independent].sum()), 'independentAddedKm2': float(areas[independent].sum())}
        union |= footprint
        steps.append(dict(station=station, marginalKm2=extra, marginalWeightedGain=float(weighted[added].sum()),
                          overlapFraction=overlap, cumulative=metrics(union), updatedRanking=[], recalculation=None,
                          explanation=f"User-adjusted proposal adds {extra:.2f} km² in this order; {overlap:.0%} overlaps prior zones."))
    return dict(schemaVersion='1.0-draft', planningCategory=request.planningCategory,
                stations=[s['station'] for s in steps], steps=steps, metrics=metrics(union),
                existingMetrics=metrics(baseline), warnings=warnings)
