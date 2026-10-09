import numpy as np
import pytest

from app.services.joint_planner import select_network, InfeasiblePlan


def test_joint_selection_reranks_overlapping_candidates_and_reconciles_gains():
    masks = np.array([[1, 1, 1, 0, 0], [1, 1, 0, 0, 0], [0, 0, 0, 1, 1]], dtype=bool)
    result = select_network(masks, np.array([1., 1., 1., 1., 1.]), 2, np.eye(3, dtype=bool))
    assert [step["index"] for step in result] == [0, 2]
    assert sum(step["gain"] for step in result) == 5
    assert result[0]["ranking"][0]["index"] == 2
    assert result[1]["gain"] == 2


def test_hard_constraints_are_not_relaxed():
    masks = np.eye(3, dtype=bool)
    with pytest.raises(InfeasiblePlan):
        select_network(masks, np.ones(3), 2, np.ones((3, 3), dtype=bool))


def test_environmental_importance_changes_the_actual_choice():
    masks = np.array([[1, 1, 0], [0, 0, 1]], dtype=bool)
    assert select_network(masks, np.array([1., 1., 4.]), 1, np.eye(2, dtype=bool))[0]["index"] == 1


def test_api_contract_and_marginal_reconciliation(monkeypatch):
    from fastapi.testclient import TestClient
    from app.main import app
    from app.routes import plans
    from app.services import sensor_health_service as lifecycle
    monkeypatch.setattr(lifecycle, 'CUSTOM_REGISTERED_SENSORS', [])
    monkeypatch.setattr(lifecycle, 'DECOMMISSIONED_STATION_CODES', set())
    official = [{"id": 1, "stationCode": "TEST-A", "name": "Synthetic test station", "station_type": 0, "lat": 47.53, "lng": 21.62, "pm25": 12}]
    monkeypatch.setattr(plans, 'load_official_air_stations', lambda: official)
    client = TestClient(app)
    first = client.post('/api/plans/joint', json={"stationCount": 3})
    assert first.status_code == 200
    p = first.json()
    assert p['schemaVersion'] == '1.3-ranges'
    ids = [s['id'] for s in p['jointPlan']['stations']]
    assert len(ids) == len(set(ids)) == 3
    assert sum(s['marginalKm2'] for s in p['steps']) == pytest.approx(p['jointPlan']['metrics']['addedKm2'])
    assert sum(s['marginalWeightedGain'] for s in p['steps']) == pytest.approx(p['jointPlan']['metrics']['weightedGain'])
    areas = [p['existingMetrics']['coveredKm2']] + [s['cumulative']['coveredKm2'] for s in p['steps']]
    assert areas == sorted(areas)
    again = client.post('/api/plans/joint', json={"stationCount": 3}).json()
    assert [s['id'] for s in again['jointPlan']['stations']] == ids
    assert again['datasetVersion'] == p['datasetVersion']
    for a, b in __import__('itertools').combinations(p['jointPlan']['stations'], 2):
        from app.services.joint_planner import distances
        assert distances([[a['lat'], a['lng']]], [[b['lat'], b['lng']]])[0, 0] >= 1
    monkeypatch.setattr(lifecycle, 'DECOMMISSIONED_STATION_CODES', {'TEST-A'})
    retired = client.post('/api/plans/joint', json={"stationCount": 2}).json()
    assert not retired['existingStations']
    assert retired['existingMetrics']['coveredKm2'] == 0
    assert retired['datasetVersion'] != p['datasetVersion']


def test_api_rejects_bad_inputs_and_keeps_other_categories_out_of_air_coverage(monkeypatch):
    from fastapi.testclient import TestClient
    from app.main import app
    from app.routes import plans
    from app.services import sensor_health_service as lifecycle
    monkeypatch.setattr(lifecycle, 'CUSTOM_REGISTERED_SENSORS', [])
    monkeypatch.setattr(lifecycle, 'DECOMMISSIONED_STATION_CODES', set())
    monkeypatch.setattr(plans, 'load_official_air_stations', lambda: [])
    client = TestClient(app)
    for payload in [{"stationCount": 4}, {"minSeparationKm": -1}, {"environmentalWeight": 4}, {"existingSimulation": [{"id": "a", "lat": 91, "lng": 21}]}]:
        assert client.post('/api/plans/joint', json=payload).status_code == 422
    pin = {"id": "a", "lat": 47.53, "lng": 21.62, "category": "water"}
    assert client.post('/api/plans/joint', json={"existingSimulation": [pin, pin]}).status_code == 422
    data = client.post('/api/plans/joint', json={"existingSimulation": [pin]}).json()
    assert data['existingMetrics']['coveredKm2'] == 0
    assert not data['existingStations']


def test_single_suggestions_recompute_after_applied_manual_and_auto_locations(monkeypatch):
    from fastapi.testclient import TestClient
    from app.main import app
    from app.routes import plans
    from app.services import sensor_health_service as lifecycle
    monkeypatch.setattr(lifecycle, 'CUSTOM_REGISTERED_SENSORS', [])
    monkeypatch.setattr(lifecycle, 'DECOMMISSIONED_STATION_CODES', set())
    monkeypatch.setattr(plans, 'load_official_air_stations', lambda: [])
    client = TestClient(app)
    applied = [{'id': 'manual', 'lat': 47.53, 'lng': 21.62, 'category': 'air'}]
    previous = 0
    for _ in range(3):
        result = client.post('/api/plans/joint', json={'stationCount': 1, 'existingSimulation': applied})
        assert result.status_code == 200
        plan = result.json()
        selected = plan['jointPlan']['stations'][0]
        assert all((s['lat'], s['lng']) != (selected['lat'], selected['lng']) for s in applied)
        assert plan['existingMetrics']['coveredKm2'] >= previous - 1e-9
        previous = plan['jointPlan']['metrics']['coveredKm2']
        applied.append({'id': selected['id'], 'lat': selected['lat'], 'lng': selected['lng'], 'category': 'air'})
        comparison = client.post('/api/plans/coverage', json={'existingSimulation': applied})
        assert comparison.status_code == 200
        assert comparison.json()['chosen']['coveredKm2'] == pytest.approx(previous)
        assert comparison.json()['installed']['coveredKm2'] == 0


def test_step_evidence_matches_geometric_coverage_before_and_after(monkeypatch):
    from app.routes.plans import JointPlanRequest
    from app.services.joint_planner import build_joint_plan, distances, generate_city_grid
    from app.services import sensor_health_service as lifecycle
    monkeypatch.setattr(lifecycle, 'CUSTOM_REGISTERED_SENSORS', [])
    monkeypatch.setattr(lifecycle, 'DECOMMISSIONED_STATION_CODES', set())
    official = [{'id': 1, 'name': 'Synthetic station', 'station_type': 0,
                 'lat': 47.53, 'lng': 21.62, 'pm25': 12}]
    plan = build_joint_plan(JointPlanRequest(stationCount=3), official)
    points = np.array([[g['lat'], g['lng']] for g in generate_city_grid()])
    areas = (111.195 * 0.0055) ** 2 * np.cos(np.radians(points[:, 0]))
    covered = distances(points, [[47.53, 21.62]])[:, 0] <= 2
    for step in plan['steps']:
        evidence = step['recalculation']
        assert evidence is not None
        candidate = evidence['station']
        mask = distances(points, [[candidate['lat'], candidate['lng']]])[:, 0] <= 2
        assert evidence['beforeKm2'] == pytest.approx(areas[mask & ~covered].sum())
        selected = step['station']
        covered |= distances(points, [[selected['lat'], selected['lng']]])[:, 0] <= 2
        assert evidence['afterKm2'] == pytest.approx(areas[mask & ~covered].sum())
        assert evidence['afterKm2'] <= evidence['beforeKm2'] + 1e-9
        assert evidence['excludedBySeparation'] == bool(distances(
            [[candidate['lat'], candidate['lng']]], [[selected['lat'], selected['lng']]])[0, 0] < 1)
        assert step['cumulative']['coveredKm2'] == pytest.approx(areas[covered].sum())
