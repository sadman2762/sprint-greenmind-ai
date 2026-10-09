import io
import json
from urllib.error import URLError

import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.routes import geocoding


@pytest.fixture(autouse=True)
def isolated_cache(monkeypatch):
    monkeypatch.setattr(geocoding, '_cache', __import__('collections').OrderedDict())
    monkeypatch.setattr(geocoding, '_next_request', 0)


def test_address_lookup_preserves_nearest_match_and_caches(monkeypatch):
    calls = []
    def lookup(request, timeout):
        calls.append(request)
        return io.BytesIO(json.dumps({'display_name': 'Synthetic Road, Debrecen', 'lat': '47.5302', 'lon': '21.6201', 'address': {'road': 'Synthetic Road'}}).encode())
    monkeypatch.setattr(geocoding, 'urlopen', lookup)
    client = TestClient(app)
    for _ in range(2):
        result = client.get('/api/geocoding/reverse?lat=47.53&lng=21.62')
        assert result.status_code == 200
        assert result.json()['address'] == {'road': 'Synthetic Road'}
        assert result.json()['matchedLat'] == '47.5302'
    assert len(calls) == 1
    assert 'GreenMindAI' in calls[0].headers['User-agent']
    assert client.get('/api/geocoding/reverse?lat=91&lng=21').status_code == 422


def test_address_failure_does_not_invent_address(monkeypatch):
    def unavailable(*args, **kwargs):
        raise URLError('Synthetic outage')
    monkeypatch.setattr(geocoding, 'urlopen', unavailable)
    result = TestClient(app).get('/api/geocoding/reverse?lat=47.53&lng=21.62')
    assert result.status_code == 502
    assert 'displayName' not in result.json()


def test_no_mapped_object_is_explicit(monkeypatch):
    monkeypatch.setattr(geocoding, 'urlopen', lambda *args, **kwargs: io.BytesIO(b'{"error":"Unable to geocode"}'))
    result = TestClient(app).get('/api/geocoding/reverse?lat=47.53&lng=21.62')
    assert result.status_code == 200
    assert result.json()['displayName'] is None
