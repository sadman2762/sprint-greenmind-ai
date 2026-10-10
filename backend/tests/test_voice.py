import io
import json
import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from app.main import app
from app.services import voice_service as voice


@pytest.fixture
def configured(monkeypatch):
    for key, value in {
        'VOICE_AZURE_OPENAI_ENDPOINT': 'https://synthetic.services.ai.azure.com',
        'VOICE_AZURE_OPENAI_DEPLOYMENT': 'gpt-live-1',
        'VOICE_AZURE_OPENAI_REASONING_DEPLOYMENT': 'synthetic-reasoning',
        'VOICE_AZURE_OPENAI_API_KEY': 'synthetic-voice-secret',
        'GREENMIND_LOCAL_ONLY': 'false',
    }.items():
        monkeypatch.setenv(key, value)


def test_voice_bootstrap_keeps_key_and_configuration_server_side(configured, monkeypatch):
    def send(request, timeout):
        assert request.full_url == 'https://synthetic.services.ai.azure.com/openai/v1/live/sessions'
        assert request.get_header('Authorization') == 'Bearer synthetic-voice-secret'
        body = json.loads(request.data)
        assert body['session']['model'] == 'gpt-live-1'
        assert body['session']['delegation']['responses']['parallel_tool_calls'] is False
        assert body['session']['delegation']['responses']['tools'][0]['name'] == 'control_map'
        assert timeout == 20
        return io.BytesIO(json.dumps({'session': {'id': 'sess_test', 'secret': 'synthetic-voice-secret'}, 'transport': {'sdp': 'v=0\r\nanswer'}}).encode())
    monkeypatch.setattr(voice, 'urlopen', send)
    result = voice.create_session('v=0\r\nsynthetic offer')
    assert result == {'sdp': 'v=0\r\nanswer', 'sessionId': 'sess_test'}
    assert 'synthetic-voice-secret' not in str(voice.status())


def test_local_only_prevents_external_call_even_with_key(configured, monkeypatch):
    monkeypatch.setenv('GREENMIND_LOCAL_ONLY', 'true')
    monkeypatch.setattr(voice, 'urlopen', lambda *a, **k: pytest.fail('External call in local-only mode'))
    assert not voice.status()['configured']
    with pytest.raises(HTTPException) as e:
        voice.create_session('v=0\r\noffer')
    assert e.value.status_code == 403


def test_missing_deployment_and_arbitrary_host_rejected(configured, monkeypatch):
    monkeypatch.delenv('VOICE_AZURE_OPENAI_REASONING_DEPLOYMENT')
    assert 'VOICE_AZURE_OPENAI_REASONING_DEPLOYMENT' in voice.status()['missing']
    with pytest.raises(HTTPException):
        voice.create_session('v=0\r\noffer')
    monkeypatch.setenv('VOICE_AZURE_OPENAI_REASONING_DEPLOYMENT', 'model')
    monkeypatch.setenv('VOICE_AZURE_OPENAI_ENDPOINT', 'https://untrusted.example')
    assert not voice.status()['configured']


def test_session_route_rejects_cross_site_and_extra_config(configured):
    client = TestClient(app)
    assert client.post('/api/voice/session', json={'sdp': 'v=0' + 'x' * 30}, headers={'sec-fetch-site': 'cross-site'}).status_code == 403
    assert client.post('/api/voice/session', json={'sdp': 'v=0' + 'x' * 30, 'model': 'injected'}).status_code == 422
    assert client.post('/api/voice/session', json={'sdp': 'not SDP' + 'x' * 30}).status_code == 422


def test_search_is_bounded_and_filters_outside_city(monkeypatch):
    from app.routes import geocoding
    monkeypatch.setattr(geocoding, '_cache', {})
    monkeypatch.setattr(geocoding, '_next_request', 0)
    def send(request, timeout):
        assert 'bounded=1' in request.full_url and 'viewbox=' in request.full_url
        return io.BytesIO(json.dumps([
            {'display_name': 'Synthetic Debrecen', 'lat': '47.53', 'lon': '21.62'},
            {'display_name': 'Synthetic Budapest', 'lat': '47.50', 'lon': '19.04'},
        ]).encode())
    monkeypatch.setattr(geocoding, 'urlopen', send)
    assert len(geocoding.search('Synthetic')['matches']) == 1


def test_azure_live_tool_schema_avoids_decimal_serialization_regression():
    # Azure Live rejected numeric schema constraints with decimal.Decimal.
    def walk(value):
        if isinstance(value, dict):
            for child in value.values():
                walk(child)
        elif isinstance(value, list):
            for child in value:
                walk(child)
        else:
            assert isinstance(value, (str, bool)) or value is None
    walk(voice.TOOL)


def test_websocket_blocks_cross_origin_and_local_only(configured, monkeypatch):
    from starlette.websockets import WebSocketDisconnect
    from app.routes import voice as route
    monkeypatch.setattr(route, 'connect', lambda *a, **k: pytest.fail('Unexpected Azure connection'))
    client = TestClient(app)
    with pytest.raises(WebSocketDisconnect):
        with client.websocket_connect('/api/voice/stream', headers={'origin': 'https://untrusted.example'}):
            pass
    monkeypatch.setenv('GREENMIND_LOCAL_ONLY', 'true')
    with client.websocket_connect('/api/voice/stream', headers={'origin': 'http://localhost:5173'}) as ws:
        assert ws.receive_json()['type'] == 'relay.error'


def test_websocket_relays_fixed_session_audio_and_closes_upstream(configured, monkeypatch):
    import asyncio
    from app.routes import voice as route
    sent = []
    lifecycle = []

    class Azure:
        def __init__(self):
            self.events = asyncio.Queue()

        async def close(self):
            lifecycle.append('closed')

        async def send(self, raw):
            event = json.loads(raw)
            sent.append(event)
            if event['type'] == 'session.start':
                await self.events.put(json.dumps({'type': 'session.started'}))
            elif event['type'] == 'session.input_audio.append':
                await self.events.put(json.dumps({'type': 'session.input_transcript.delta', 'delta': 'test'}))

        def __aiter__(self):
            return self

        async def __anext__(self):
            return await self.events.get()

    async def connect(url, **kwargs):
        assert url == 'wss://synthetic.services.ai.azure.com/openai/v1/live/sessions'
        assert kwargs['additional_headers']['Authorization'] == 'Bearer synthetic-voice-secret'
        return Azure()

    monkeypatch.setattr(route, 'connect', connect)
    with TestClient(app).websocket_connect('/api/voice/stream', headers={'origin': 'http://localhost:5173'}) as ws:
        assert ws.receive_json() == {'type': 'session.started'}
        ws.send_json({'type': 'session.input_audio.append', 'audio': 'AAA='})
        assert ws.receive_json()['delta'] == 'test'
        ws.send_json({'type': 'session.close'})
        from starlette.websockets import WebSocketDisconnect
        with pytest.raises(WebSocketDisconnect):
            ws.receive_json()
    assert sent[0]['session']['delegation']['responses']['tools'] == [voice.TOOL]
    assert lifecycle == ['closed']
    assert sent[-1]['type'] == 'session.close'


def test_relay_rejects_session_injection_and_invalid_pcm():
    from app.routes.voice import allowed_voice_event
    assert not allowed_voice_event({'type': 'session.start', 'session': {'model': 'injected'}})
    for audio in ['', '!', 'AA==', 'AAAA']:
        assert not allowed_voice_event({'type': 'session.input_audio.append', 'audio': audio})
    assert allowed_voice_event({'type': 'session.input_audio.append', 'audio': 'AAA='})


def test_voice_network_errors_are_actionable_without_exposing_credentials():
    import ssl
    from app.routes.voice import connection_error
    for error, code in [(ConnectionRefusedError('http://user:password@proxy.test'), 'network_unreachable'),
                        (ssl.SSLError('private certificate details'), 'tls_failed')]:
        result = connection_error(error)
        assert result['code'] == code
        assert 'password' not in str(result) and 'private certificate' not in str(result)
