import math

import pandas as pd
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services import environmental_conditions as conditions


def write_sources(tmp_path, monkeypatch, air=None, water=None, noise=None):
    paths = {}
    for category, data in [('air', air), ('water', water), ('noise', noise)]:
        paths[category] = tmp_path / f'{category}.csv'
        if data is not None:
            data.to_csv(paths[category], index=False)
    monkeypatch.setattr(conditions, 'SOURCE_PATHS', paths)
    return paths


def test_air_weights_sites_equally_preserves_zero_and_missing_days(tmp_path, monkeypatch):
    air = pd.DataFrame([
        ['2026-05-21 01:00', 'A', 10],
        ['2026-05-21 02:00', 'A', 20],
        ['2026-05-21 02:00', 'A', 20],
        ['2026-05-21 01:00', 'B', 30],
        ['2026-05-22 01:00', 'A', -1],
        ['2026-05-23 01:00', 'A', 0],
        ['2026-05-23 01:00', 'B', float('inf')],
        ['not a date', 'A', 100],
        ['2026-05-23 01:00', '', 100],
    ], columns=['timestamp', 'station_code', 'pm25'])
    write_sources(tmp_path, monkeypatch, air=air)
    result = conditions.get_environmental_conditions()['categories']['air']
    metric = result['metrics'][0]
    assert result['status'] == 'available'
    assert metric['stationCount'] == 2
    assert metric['recordCount'] == 4
    assert metric['periodStart'] == '2026-05-21'
    assert metric['periodEnd'] == '2026-05-23'
    assert metric['points'] == [
        dict(date='2026-05-21', value=22.5, stationCount=2, recordCount=3),
        dict(date='2026-05-22', value=None, stationCount=0, recordCount=0),
        dict(date='2026-05-23', value=0.0, stationCount=1, recordCount=1),
    ]


def test_water_separates_metrics_units_and_does_not_infer_safety(tmp_path, monkeypatch):
    water = pd.DataFrame([
        ['2026-05-21', 'A', 'Conductivity', 1.2, 'mS/cm'],
        ['2026-05-21', 'B', 'Conductivity', 1.4, 'mS/cm'],
        ['2026-05-21', 'C', 'Conductivity', 900, 'uS/cm'],
        ['2026-05-21', 'A', 'WaterTemp', 12, 'celsius'],
        ['2026-05-21', 'A', 'WaterLevel', -2, 'm'],
    ], columns=['timestamp', 'location', 'measurement_type', 'value', 'unit'])
    write_sources(tmp_path, monkeypatch, water=water)
    result = conditions.get_environmental_conditions()['categories']['water']
    metrics = {metric['key']: metric for metric in result['metrics']}
    assert metrics['conductivity']['points'][0]['value'] == 1.3
    assert metrics['conductivity']['stationCount'] == 2
    assert metrics['waterTemperature']['points'][0]['value'] == 12
    assert metrics['waterLevel']['points'][0]['value'] == -2
    assert 'safety' in result['description']
    assert 'healthScore' not in result


def test_noise_uses_sound_energy_not_arithmetic_decibels(tmp_path, monkeypatch):
    noise = pd.DataFrame([
        ['2026-05-21', 'A', 'LAEQ nappali', 40, 'dB'],
        ['2026-05-21', 'B', 'LAEQ nappali', 50, 'dB'],
        ['2026-05-21', 'B', 'LAEQ nappali', 50, 'dB'],
        ['2026-05-21', 'A', 'LAEQ éjszakai', 0, 'dB'],
        ['2026-05-21', 'B', 'LAEQ éjszakai', 250, 'dB'],
        ['2026-05-23', 'A', 'LAEQ nappali', 50, 'dB'],
    ], columns=['timestamp', 'location', 'measurement_type', 'value', 'unit'])
    write_sources(tmp_path, monkeypatch, noise=noise)
    metrics = conditions.get_environmental_conditions()['categories']['noise']['metrics']
    assert metrics[0]['points'][0]['value'] == pytest.approx(10 * math.log10(55000), abs=.001)
    assert metrics[0]['points'][1]['value'] is None
    assert metrics[0]['recordCount'] == 3
    assert metrics[1]['points'][0]['value'] == 0
    assert metrics[1]['points'][2]['value'] is None


def test_missing_empty_and_malformed_sources_are_independent(tmp_path, monkeypatch):
    write_sources(tmp_path, monkeypatch,
                  water=pd.DataFrame(columns=['timestamp', 'location', 'measurement_type', 'value', 'unit']),
                  noise=pd.DataFrame([dict(unexpected=1)]))
    response = TestClient(app).get('/api/official-dataset/conditions')
    assert response.status_code == 200
    result = response.json()
    assert result['schemaVersion'] == '1.0'
    assert result['categories']['air']['status'] == 'unavailable'
    assert result['categories']['water']['status'] == 'empty'
    assert result['categories']['noise']['status'] == 'unavailable'
    assert all(metric['points'] == [] for metric in result['categories']['air']['metrics'])
    assert str(tmp_path) not in response.text


def test_source_updates_are_reflected_without_restart(tmp_path, monkeypatch):
    air = pd.DataFrame([['2026-05-21', 'A', 10]], columns=['timestamp', 'station_code', 'pm25'])
    paths = write_sources(tmp_path, monkeypatch, air=air)
    assert conditions.get_environmental_conditions()['categories']['air']['metrics'][0]['points'][0]['value'] == 10
    air.loc[0, 'pm25'] = 200
    air.to_csv(paths['air'], index=False)
    assert conditions.get_environmental_conditions()['categories']['air']['metrics'][0]['points'][0]['value'] == 200
