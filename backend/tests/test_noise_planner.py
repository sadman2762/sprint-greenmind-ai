import numpy as np
import pytest
from app.routes.plans import JointPlanRequest
from app.services import joint_planner as planner
from app.services import sensor_health_service as lifecycle


def test_noise_uses_own_sites_radius_and_only_noise_placements(monkeypatch):
    monkeypatch.setattr(lifecycle, 'CUSTOM_REGISTERED_SENSORS', [])
    monkeypatch.setattr(lifecycle, 'DECOMMISSIONED_STATION_CODES', set())
    site = dict(id=-20001, name='Synthetic noise site', station_type=2, sensorTier='noise', lat=47.53, lng=21.62, nighttimeNoise=55)
    monkeypatch.setattr(planner, 'load_noise_sites', lambda: [site])
    official = [dict(id=1, name='Air only', station_type=0, lat=47.55, lng=21.66, pm25=99)]
    request = JointPlanRequest(planningCategory='noise', stationCount=2, existingSimulation=[
        dict(id='manual-noise', lat=47.50, lng=21.60, category='noise'),
        dict(id='manual-air', lat=47.51, lng=21.68, category='air')])
    plan = planner.build_joint_plan(request, official)
    assert plan['planningCategory'] == 'noise'
    assert plan['studyArea']['radiusKm'] == 1
    assert len(plan['existingStations']) == 2
    assert all(s['category'] == 'noise' and s['estimatedPm25'] is None for s in plan['jointPlan']['stations'])
    assert plan['originalPlan']['status'] == 'unavailable'
    assert 'noise' in plan['originalPlan']['warnings'][0].lower()
    assert sum(s['marginalKm2'] for s in plan['steps']) == pytest.approx(plan['jointPlan']['metrics']['addedKm2'])
    points = np.array([[g['lat'], g['lng']] for g in planner.generate_city_grid()])
    areas = (111.195 * .0055) ** 2 * np.cos(np.radians(points[:, 0]))
    mask = planner.distances(points, [[47.53,21.62], [47.50,21.60]]).min(axis=1) <= 1
    assert plan['existingMetrics']['coveredKm2'] == pytest.approx(areas[mask].sum())
    second = planner.build_joint_plan(JointPlanRequest(planningCategory='noise', stationCount=2, environmentalWeight=0), official)
    assert all(s['category']=='noise' for s in second['jointPlan']['stations'])


def test_noise_data_unavailable_is_not_silently_zero_coverage(monkeypatch):
    monkeypatch.setattr(planner, 'load_noise_sites', lambda: [])
    with pytest.raises(planner.InfeasiblePlan, match='Noise'):
        planner.compare_coverage(JointPlanRequest(planningCategory='noise'), [])


def test_historical_noise_averages_energy_and_does_not_invent_missing_readings(tmp_path):
    from app.services.noise_planning_data import load_noise_sites
    path = tmp_path / 'noise.csv'
    path.write_text('timestamp,location,measurement_type,value,unit\n'
                    '2026-01-01,"Test (47.53, 21.62)",LAEQ éjszakai,40,dB\n'
                    '2026-01-02,"Test (47.53, 21.62)",LAEQ éjszakai,50,dB\n'
                    '2026-01-03,"Test (47.53, 21.62)",LAEQ nappali,nan,dB\n'
                    '2026-01-03,"Invalid (147.53, 21.62)",LAEQ éjszakai,50,dB\n')
    sites = load_noise_sites(path)
    assert len(sites) == 1
    assert sites[0]['nighttimeNoise'] == pytest.approx(10 * np.log10((10**4 + 10**5) / 2))
    assert 'daytimeNoise' not in sites[0]
    assert sites[0]['recordCount'] == 2
    assert sites[0]['periodEnd'] == '2026-01-02'
    assert sites[0]['sensorTier'] == 'noise'


def test_noise_api_apply_then_suggest_matches_coverage_and_allows_colocated_categories(monkeypatch):
    from fastapi.testclient import TestClient
    from app.main import app
    from app.routes import plans
    monkeypatch.setattr(lifecycle, 'CUSTOM_REGISTERED_SENSORS', [])
    monkeypatch.setattr(lifecycle, 'DECOMMISSIONED_STATION_CODES', set())
    monkeypatch.setattr(plans, 'load_official_air_stations', lambda: [])
    monkeypatch.setattr(planner, 'load_noise_sites', lambda: [dict(id=1, name='Synthetic noise site', station_type=2, lat=47.53, lng=21.62, nighttimeNoise=50)])
    client = TestClient(app)
    chosen = [dict(id='co-air', lat=47.50, lng=21.55, category='air'), dict(id='co-noise', lat=47.50, lng=21.55, category='noise')]
    previous = None
    for count in (1, 2, 3):
        result = client.post('/api/plans/joint', json=dict(planningCategory='noise', stationCount=count, existingSimulation=chosen))
        assert result.status_code == 200
        plan = result.json()
        if previous is not None:
            assert plan['existingMetrics']['coveredKm2'] == pytest.approx(previous)
        assert len(plan['steps']) == count
        chosen.extend(dict(id=s['id'], lat=s['lat'], lng=s['lng'], category='noise') for s in plan['jointPlan']['stations'])
        previous = plan['jointPlan']['metrics']['coveredKm2']
        coverage = client.post('/api/plans/coverage', json=dict(planningCategory='noise', existingSimulation=chosen)).json()
        assert coverage['chosen']['coveredKm2'] == pytest.approx(previous)
        assert coverage['radiusKm'] == 1
