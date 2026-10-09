import numpy as np
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.routes import plans
from app.services import joint_planner as planner
from app.services import sensor_health_service as lifecycle


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setattr(lifecycle, 'CUSTOM_REGISTERED_SENSORS', [])
    monkeypatch.setattr(lifecycle, 'DECOMMISSIONED_STATION_CODES', set())
    monkeypatch.setattr(plans, 'load_official_air_stations', lambda: [dict(id=1, name='Synthetic air', lat=47.53, lng=21.62, station_type=0, pm25=12)])
    monkeypatch.setattr(planner, 'load_noise_sites', lambda: [dict(id=2, name='Synthetic noise', lat=47.53, lng=21.62, station_type=2, nighttimeNoise=50)])
    return TestClient(app)


@pytest.mark.parametrize('category', ['air', 'noise'])
def test_edited_proposals_keep_order_and_recompute_geometry(client, category):
    rows = [dict(id='draft-a', name='Moved first', category=category, lat=47.50, lng=21.60, radiusKm=.8),
            dict(id='draft-b', name='Second unchanged', category=category, lat=47.504, lng=21.605, radiusKm=1.3)]
    payload = dict(planningCategory=category, coverageRadiiKm={category: .6}, proposedStations=rows)
    response = client.post('/api/plans/evaluate', json=payload)
    assert response.status_code == 200
    data = response.json()
    assert [s['id'] for s in data['stations']] == ['draft-a', 'draft-b']
    assert [s['lat'] for s in data['stations']] == [s['lat'] for s in rows]
    points = np.array([[g['lat'], g['lng']] for g in planner.generate_city_grid()])
    area = (111.195 * .0055) ** 2 * np.cos(np.radians(points[:, 0]))
    covered = planner.distances(points, [[47.53, 21.62]])[:, 0] <= .6
    for row, step in zip(rows, data['steps']):
        footprint = planner.distances(points, [[row['lat'], row['lng']]])[:, 0] <= row['radiusKm']
        new = footprint & ~covered
        assert step['marginalKm2'] == pytest.approx(area[new].sum())
        assert step['overlapFraction'] == pytest.approx(1 - area[new].sum() / area[footprint].sum())
        covered |= footprint
        assert step['cumulative']['coveredKm2'] == pytest.approx(area[covered].sum())
        assert step['recalculation'] is None and step['updatedRanking'] == []
        assert step['station']['estimatedPm25'] is None and step['station']['estimatedNightNoise'] is None
    assert sum(s['marginalKm2'] for s in data['steps']) == pytest.approx(data['metrics']['addedKm2'])
    assert any('closer than' in warning for warning in data['warnings'])
    assert any('not a new optimizer result' in warning for warning in data['warnings'])
    applied = [dict(id=s['id'], lat=s['lat'], lng=s['lng'], category=category) for s in rows]
    coverage = client.post('/api/plans/coverage', json=dict(planningCategory=category, coverageRadiiKm={category: .6}, existingSimulation=applied,
        sensorRadiusOverridesKm={f"{category}:{s['id']}": s['radiusKm'] for s in rows})).json()
    assert coverage['chosen']['coveredKm2'] == pytest.approx(data['metrics']['coveredKm2'])


def test_invalid_moves_and_radii_are_rejected(client):
    row = dict(id='draft', category='air', lat=47.53, lng=21.62)
    for rows in ([], [{**row, 'lat': 0}], [{**row, 'radiusKm': 0}], [{**row, 'category': 'noise'}], [row, row], [row, {**row, "id": "another"}]):
        assert client.post('/api/plans/evaluate', json={'proposedStations': rows}).status_code == 422
