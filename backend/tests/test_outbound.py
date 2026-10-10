import socket
import ssl
from urllib.error import HTTPError, URLError
import pytest
from app.services import outbound

@pytest.fixture(autouse=True)
def clean_network(monkeypatch):
    monkeypatch.delenv('GREENMIND_PROXY_URL', raising=False)
    monkeypatch.delenv('GREENMIND_NETWORK_MODE', raising=False)
    monkeypatch.setattr(outbound, 'getproxies', lambda: {'https': 'http://proxy.test:8080'})
    monkeypatch.setattr(outbound, 'proxy_bypass', lambda host: False)

def test_routes_adapt_to_proxy_and_direct_networks(monkeypatch):
    assert outbound.proxy_routes('https://azure.test') == ['http://proxy.test:8080', None]
    monkeypatch.setenv('GREENMIND_NETWORK_MODE', 'direct')
    assert outbound.proxy_routes('https://azure.test') == [None]
    monkeypatch.setenv('GREENMIND_NETWORK_MODE', 'proxy')
    assert outbound.proxy_routes('https://azure.test') == ['http://proxy.test:8080']
    monkeypatch.setattr(outbound, 'getproxies', lambda: {})
    with pytest.raises(ValueError): outbound.proxy_routes('https://azure.test')

def test_loopback_and_no_proxy_never_use_corporate_proxy(monkeypatch):
    for host in ['localhost', '127.0.0.1', '[::1]']:
        assert outbound.proxy_routes('http://' + host + ':8000/api/health') == [None]
    monkeypatch.setattr(outbound, 'proxy_bypass', lambda host: True)
    assert outbound.proxy_routes('https://azure.test') == [None]

def test_http_uses_direct_when_stale_proxy_cannot_connect(monkeypatch):
    routes = []
    class Opener:
        def __init__(self, handler): self.proxy = handler.proxies
        def open(self, request, timeout):
            routes.append(self.proxy)
            if self.proxy: raise URLError(socket.gaierror('proxy unavailable'))
            return 'response'
    monkeypatch.setattr(outbound, 'build_opener', Opener)
    assert outbound.urlopen('https://azure.test', timeout=8) == 'response'
    assert routes == [{'https': 'http://proxy.test:8080', 'http': 'http://proxy.test:8080'}, {}]

@pytest.mark.parametrize('error', [HTTPError('https://azure.test', 407, 'auth required', {}, None), URLError(ssl.SSLError('certificate rejected')), TimeoutError('read timeout')])
def test_http_never_retries_rejections_tls_or_ambiguous_read_timeout(monkeypatch, error):
    attempts = []
    class Opener:
        def open(self, request, timeout):
            attempts.append(1)
            raise error
    monkeypatch.setattr(outbound, 'build_opener', lambda handler: Opener())
    with pytest.raises(type(error)): outbound.urlopen('https://azure.test', timeout=8)
    assert len(attempts) == 1

def test_websocket_retries_connect_only_then_closes_once():
    import asyncio
    attempts = []
    class Socket:
        async def close(self): attempts.append('close')
    async def connector(url, **kwargs):
        attempts.append(kwargs['proxy'])
        if kwargs['proxy']: raise ConnectionRefusedError('unavailable proxy')
        return Socket()
    async def check():
        async with outbound.connect_websocket('wss://azure.test/live', connector=connector): pass
    asyncio.run(check())
    assert attempts == ['http://proxy.test:8080', None, 'close']

def test_websocket_never_replays_after_session_has_connected():
    import asyncio
    attempts = []
    class Socket:
        async def close(self): attempts.append('close')
    async def connector(url, **kwargs):
        attempts.append(kwargs['proxy'])
        return Socket()
    async def check():
        with pytest.raises(ConnectionResetError):
            async with outbound.connect_websocket('wss://azure.test/live', connector=connector):
                raise ConnectionResetError('stream interrupted')
    asyncio.run(check())
    assert attempts == ['http://proxy.test:8080', 'close']
