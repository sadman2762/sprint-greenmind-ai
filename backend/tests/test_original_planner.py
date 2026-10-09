"""Original must refer to the pinned upstream engine, not the independent control."""
import hashlib
from pathlib import Path

import numpy as np
import pytest


def test_original_engine_matches_pinned_upstream_source():
    from app.services import recommendation_engine
    assert hashlib.sha256(Path(recommendation_engine.__file__).read_bytes()).hexdigest() == 'f695f66ab415ae932011e6a831dac1290e9d085781d51cbb9cc81533ada897a3'


def test_original_adapter_preserves_order_defaults_and_common_input(monkeypatch):
    from app.services import original_planner
    seen = {}
    def generate(stations, count, minimum_distance_km):
        seen.update(stations=stations, count=count, separation=minimum_distance_km)
        return [{'lat': 47.54, 'lng': 21.55, 'name': 'First', 'priorityScore': 90},
                {'lat': 47.49, 'lng': 21.69, 'name': 'Second', 'priorityScore': 98}]
    monkeypatch.setattr(original_planner, 'generate_recommendations', generate)
    stations = [{'id': 'manual', 'lat': 47.53, 'lng': 21.62, 'station_type': 0}]
    result = original_planner.run_original(stations, 2)
    assert seen == {'stations': stations, 'count': 2, 'separation': 2.8}
    assert [s['name'] for s in result] == ['First', 'Second']


def test_original_api_metrics_reconcile_and_failures_are_explicit(monkeypatch):
    from app.services import joint_planner, sensor_health_service as lifecycle
    from app.routes.plans import JointPlanRequest
    monkeypatch.setattr(lifecycle, 'CUSTOM_REGISTERED_SENSORS', [])
    monkeypatch.setattr(lifecycle, 'DECOMMISSIONED_STATION_CODES', set())
    old = [{'name': 'Original A', 'lat': 47.54, 'lng': 21.55, 'priorityScore': 98},
           {'name': 'Original B', 'lat': 47.49, 'lng': 21.69, 'priorityScore': 98}]
    monkeypatch.setattr(joint_planner, 'run_original', lambda stations, count: old)
    plan = joint_planner.build_joint_plan(JointPlanRequest(stationCount=2), [])
    original = plan['originalPlan']
    assert original['status'] == 'available'
    assert original['source']['commit'] == 'c15c09f694012d8abc75fb252c89a27c3fa4faef'
    assert len(original['stations']) == 2
    assert sum(s['marginalKm2'] for s in original['steps']) == pytest.approx(original['metrics']['addedKm2'])
    assert sum(s['marginalWeightedGain'] for s in original['steps']) == pytest.approx(original['metrics']['weightedGain'])
    grid = joint_planner.generate_city_grid()
    points = np.array([[g['lat'], g['lng']] for g in grid])
    areas = (111.195 * 0.0055) ** 2 * np.cos(np.radians(points[:, 0]))
    mask = np.any(joint_planner.distances(points, [[s['lat'], s['lng']] for s in old]) <= 2, axis=1)
    assert original['metrics']['coveredKm2'] == pytest.approx(areas[mask].sum())
    monkeypatch.setattr(joint_planner, 'run_original', lambda stations, count: old[:1])
    partial = joint_planner.build_joint_plan(JointPlanRequest(stationCount=2), [])['originalPlan']
    assert partial['status'] == 'partial'
    assert partial['warnings']
    def fail(*args):
        raise ValueError('Synthetic original failure')
    monkeypatch.setattr(joint_planner, 'run_original', fail)
    failed = joint_planner.build_joint_plan(JointPlanRequest(stationCount=2), [])
    assert failed['originalPlan']['status'] == 'unavailable'
    assert failed['originalPlan']['metrics'] is None
    assert failed['originalPlan']['stations'] == []
    assert len(failed['jointPlan']['stations']) == 2


def test_original_selection_matches_upstream_golden_sequence():
    from app.services.original_planner import run_original
    stations = [{'id': 1, 'name': 'Synthetic A', 'station_type': 0,
                 'lat': 47.53, 'lng': 21.62, 'pm25': 12}]
    expected = [(47.5675, 21.6495), (47.5235, 21.6825), (47.5235, 21.5615)]
    assert [(s['lat'], s['lng']) for s in run_original(stations, 3)] == expected
    assert [(s['lat'], s['lng']) for s in run_original(stations, 1)] == expected[:1]


def test_comparison_passes_shared_roster_without_inventing_simulated_readings(monkeypatch):
    from app.services import joint_planner, sensor_health_service as lifecycle
    from app.routes.plans import JointPlanRequest
    monkeypatch.setattr(lifecycle, 'CUSTOM_REGISTERED_SENSORS', [])
    monkeypatch.setattr(lifecycle, 'DECOMMISSIONED_STATION_CODES', set())
    captured = []
    def capture(stations, count):
        captured.extend(stations)
        return []
    monkeypatch.setattr(joint_planner, 'run_original', capture)
    official = [{'id': 1, 'name': 'Observed', 'station_type': 0, 'lat': 47.53, 'lng': 21.62, 'pm25': 12}]
    req = JointPlanRequest(stationCount=1, existingSimulation=[
        {'id': 'manual', 'lat': 47.50, 'lng': 21.60, 'category': 'air'},
        {'id': 'water', 'lat': 47.51, 'lng': 21.61, 'category': 'water'}])
    plan = joint_planner.build_joint_plan(req, official)
    assert [(s['lat'], s['lng']) for s in captured] == [(s['lat'], s['lng']) for s in plan['existingStations']]
    assert captured[0]['pm25'] == 12
    assert 'pm25' not in captured[1]
    assert all(s['station_type'] == 0 for s in captured)
