import io
import pytest
from fastapi import HTTPException
from google.transit import gtfs_realtime_pb2 as gtfs
from app.services import live_transit as live


def feed():
    f = gtfs.FeedMessage()
    f.header.gtfs_realtime_version = '2.0'
    f.header.timestamp = 1000
    e = f.entity.add(id='v1')
    e.vehicle.position.latitude = 47.53
    e.vehicle.position.longitude = 21.62
    e.vehicle.trip.route_id = 'r1'
    return f


def test_missing_fields_and_feed_timestamp_are_not_invented():
    result = live.decode_feed(feed().SerializeToString(), 'Test source', now=1050)
    v = result['vehicles'][0]
    assert v['mode'] == 'default'
    assert v['speedKmh'] is None and v['observedAt'] is None
    assert v['freshnessAt'] == 1000 and not v['stale']
    assert result['provider'] == 'Test source'


def test_explicit_route_metadata_speed_and_staleness():
    f = feed()
    f.entity[0].vehicle.position.speed = 10
    f.entity[0].vehicle.timestamp = 800
    v = live.decode_feed(f.SerializeToString(), 'Test', {'r1': {'mode': 'bus', 'routeName': '10'}}, now=1050)['vehicles'][0]
    assert v['speedKmh'] == 36 and v['mode'] == 'bus' and v['routeName'] == '10'
    assert v['stale'] and v['observedAt'] == 800


def test_invalid_coordinates_and_deleted_entities_are_skipped():
    f = feed()
    f.entity[0].vehicle.position.latitude = float('nan')
    f.entity.add(id='deleted', is_deleted=True)
    result = live.decode_feed(f.SerializeToString(), 'Test', now=1050)
    assert not result['vehicles'] and result['skippedPositions'] == 1


def test_invalid_and_differential_payloads_are_rejected():
    with pytest.raises(Exception):
        live.decode_feed(b'not a protobuf', 'Test')
    f = feed()
    f.header.incrementality = gtfs.FeedHeader.DIFFERENTIAL
    with pytest.raises(ValueError):
        live.decode_feed(f.SerializeToString(), 'Test')


@pytest.fixture
def clean_config(monkeypatch):
    for name in ['TRANSIT_VEHICLE_POSITIONS_URL', 'TRANSIT_API_KEY', 'API_KEY', 'TRANSIT_API_KEY_PARAM', 'TRANSIT_GTFS_ROUTES_FILE', 'TRANSIT_NETWORK_MODE', 'GREENMIND_NETWORK_MODE']:
        monkeypatch.delenv(name, raising=False)
    monkeypatch.setattr(live, '_cache_until', 0)


def test_missing_config_does_not_request_external_feed(clean_config, monkeypatch):
    monkeypatch.setattr(live, 'urlopen', lambda *a, **k: pytest.fail('Unexpected external request'))
    with pytest.raises(HTTPException) as exc:
        live.snapshot()
    assert exc.value.status_code == 503


def test_key_is_server_only_bkk_label_and_cache(clean_config, monkeypatch):
    monkeypatch.setenv('API_KEY', 'synthetic-test-secret')
    monkeypatch.setenv('TRANSIT_PROVIDER_NAME', 'DKV')
    calls = []
    def request(req, **kwargs):
        calls.append(req.full_url)
        assert kwargs['timeout'] == 8
        return io.BytesIO(feed().SerializeToString())
    monkeypatch.setattr(live, 'urlopen', request)
    first = live.snapshot()
    assert live.snapshot() == first and len(calls) == 1
    assert 'synthetic-test-secret' in calls[0]
    assert 'synthetic-test-secret' not in str(first)
    assert first['provider'] == 'BKK · Budapest'


def test_upstream_errors_do_not_leak_secret_and_are_throttled(clean_config, monkeypatch):
    monkeypatch.setenv('API_KEY', 'synthetic-secret')
    calls = []
    def request(*a, **k):
        calls.append(True)
        raise RuntimeError('https://test/?key=synthetic-secret')
    monkeypatch.setattr(live, 'urlopen', request)
    for _ in range(2):
        with pytest.raises(HTTPException) as exc:
            live.snapshot()
        assert exc.value.status_code == 502
        assert 'synthetic-secret' not in exc.value.detail
    assert len(calls) == 1


def test_unknown_and_future_timestamps_are_not_live():
    f = feed()
    f.header.ClearField('timestamp')
    assert live.decode_feed(f.SerializeToString(), 'Test', now=1050)['vehicles'][0]['stale']
    f.entity[0].vehicle.timestamp = 2000
    assert live.decode_feed(f.SerializeToString(), 'Test', now=1050)['vehicles'][0]['stale']


def test_static_routes_define_modes_without_guessing(tmp_path, monkeypatch):
    routes = tmp_path / 'routes.txt'
    routes.write_text('route_id,route_short_name,route_type\nbus,10,3\ntrolley,70,11\nsuburban,H5,109\nunknown,X,999\n')
    monkeypatch.setenv('TRANSIT_GTFS_ROUTES_FILE', str(routes))
    metadata = live.route_metadata()
    assert metadata['bus'] == {'routeName': '10', 'mode': 'bus'}
    assert metadata['trolley']['mode'] == 'trolley'
    assert metadata['suburban']['mode'] == 'suburban'
    assert metadata['unknown']['mode'] == 'default'


def test_bkk_defaults_to_direct_without_changing_voice_routing(clean_config, monkeypatch):
    monkeypatch.setenv('API_KEY', 'synthetic-secret')
    monkeypatch.delenv('GREENMIND_NETWORK_MODE', raising=False)
    monkeypatch.delenv('TRANSIT_NETWORK_MODE', raising=False)
    def request(req, **kwargs):
        assert kwargs['network_mode'] == 'direct'
        return io.BytesIO(feed().SerializeToString())
    monkeypatch.setattr(live, 'urlopen', request)
    assert live.snapshot()['vehicles']
    assert 'GREENMIND_NETWORK_MODE' not in live.os.environ


def test_transit_route_override_invalidates_cached_proxy_failure(clean_config, monkeypatch):
    monkeypatch.setenv('API_KEY', 'synthetic-secret')
    monkeypatch.setenv('TRANSIT_NETWORK_MODE', 'proxy')
    calls = []
    def request(req, **kwargs):
        calls.append(kwargs['network_mode'])
        if kwargs['network_mode'] == 'proxy': raise ConnectionRefusedError('Unavailable corporate proxy')
        return io.BytesIO(feed().SerializeToString())
    monkeypatch.setattr(live, 'urlopen', request)
    with pytest.raises(HTTPException): live.snapshot()
    monkeypatch.setenv('TRANSIT_NETWORK_MODE', 'direct')
    assert live.snapshot()['vehicles']
    assert calls == ['proxy', 'direct']
