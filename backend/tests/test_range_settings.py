import numpy as np
import pytest
from pydantic import ValidationError
from app.routes.plans import JointPlanRequest
from app.services import joint_planner as planner
from app.services import sensor_health_service as lifecycle


@pytest.fixture(autouse=True)
def isolated(monkeypatch):
    monkeypatch.setattr(lifecycle, 'CUSTOM_REGISTERED_SENSORS', [])
    monkeypatch.setattr(lifecycle, 'DECOMMISSIONED_STATION_CODES', set())


def test_range_input_validation():
    for value in (0, -1, 10.1, float('nan'), float('inf')):
        with pytest.raises(ValidationError):
            JointPlanRequest(coverageRadiiKm={'air': value})
        with pytest.raises(ValidationError):
            JointPlanRequest(sensorRadiusOverridesKm={'air:x': value})
    assert JointPlanRequest(coverageRadiiKm={'air': .05}).coverageRadiiKm.air == .05


def test_sensor_override_uses_its_radius_not_the_nearest_sensor():
    request = JointPlanRequest(coverageRadiiKm={'air': .1}, sensorRadiusOverridesKm={'air:far': 2, 'water:near': 10})
    stations = [dict(id='near', lat=47.53, lng=21.62), dict(id='far', lat=47.54, lng=21.62)]
    point = np.array([[47.532, 21.62]])
    assert planner.network_mask(request, point, stations).tolist() == [True]
    assert planner.network_mask(JointPlanRequest(coverageRadiiKm={'air': .1}), point, stations).tolist() == [False]


@pytest.mark.parametrize('category,radius', [('air', .6), ('noise', 1.7)])
def test_custom_radius_and_overrides_reconcile_selection_and_before_after(monkeypatch, category, radius):
    site = dict(id=1, stationCode='FIXTURE', name='Synthetic site', station_type=2 if category == 'noise' else 0, lat=47.53, lng=21.62, pm25=12, nighttimeNoise=55)
    monkeypatch.setattr(planner, 'load_noise_sites', lambda: [site])
    payload = dict(planningCategory=category, stationCount=2, coverageRadiiKm={category: radius}, sensorRadiusOverridesKm={f'{category}:FIXTURE': .2})
    request = JointPlanRequest(**payload)
    plan = planner.build_joint_plan(request, [site])
    assert plan['studyArea']['radiusKm'] == radius
    assert plan['rangeSettings']['sensorRadiusOverridesKm'] == {f'{category}:FIXTURE': .2}
    grid = planner.generate_city_grid()
    points = np.array([[g['lat'], g['lng']] for g in grid])
    area = (111.195 * .0055) ** 2 * np.cos(np.radians(points[:, 0]))
    covered = planner.distances(points, [[site['lat'], site['lng']]])[:, 0] <= .2
    assert plan['existingMetrics']['coveredKm2'] == pytest.approx(area[covered].sum())
    for step in plan['steps']:
        station = step['station']
        covered |= planner.distances(points, [[station['lat'], station['lng']]])[:, 0] <= radius
        assert step['cumulative']['coveredKm2'] == pytest.approx(area[covered].sum())
    applied = [dict(id=s['id'], name=s['name'], lat=s['lat'], lng=s['lng'], category=category) for s in plan['jointPlan']['stations']]
    after = planner.compare_coverage(JointPlanRequest(**payload, existingSimulation=applied), [site])
    assert after['chosen']['coveredKm2'] == pytest.approx(plan['jointPlan']['metrics']['coveredKm2'])
    assert after['installed']['coveredKm2'] == pytest.approx(plan['existingMetrics']['coveredKm2'])
    if category == 'air':
        original_union = planner.distances(points, [[site['lat'], site['lng']]])[:, 0] <= .2
        for station in plan['originalPlan']['stations']:
            original_union |= planner.distances(points, [[station['lat'], station['lng']]])[:, 0] <= radius
        assert plan['originalPlan']['metrics']['coveredKm2'] == pytest.approx(area[original_union].sum())


def test_new_sensor_radius_does_not_change_existing_network():
    official = [dict(id=1, name='Synthetic site', station_type=0, lat=47.53, lng=21.62, pm25=12)]
    default = JointPlanRequest(stationCount=1)
    custom = JointPlanRequest(stationCount=1, newSensorRadiusKm=.7)
    first = planner.build_joint_plan(default, official)
    second = planner.build_joint_plan(custom, official)
    assert first['existingMetrics'] == second['existingMetrics']
    assert second['studyArea']['radiusKm'] == .7
    assert second['jointPlan']['stations'][0]['radiusKm'] == .7
    assert second['jointPlan']['metrics']['addedKm2'] < first['jointPlan']['metrics']['addedKm2']
