"""Outbound routing that tolerates a stale VPN proxy without changing OS settings.

Fallback is restricted to connection failures, never HTTP refusals, TLS failures,
or an established voice session. Explicit proxy mode never tries a direct route.
"""
from contextlib import asynccontextmanager
import os
import ssl
from urllib.error import URLError
from urllib.parse import urlsplit
from urllib.request import ProxyHandler, Request, build_opener, getproxies, proxy_bypass
from websockets.asyncio.client import connect


def proxy_routes(url):
    parts = urlsplit(url)
    if parts.hostname in {'localhost', '127.0.0.1', '::1'}:
        return [None]
    mode = os.getenv('GREENMIND_NETWORK_MODE', 'auto').strip().lower()
    if mode not in {'auto', 'direct', 'proxy'}:
        raise ValueError('GREENMIND_NETWORK_MODE must be auto, direct or proxy.')
    if mode == 'direct':
        return [None]
    explicit = os.getenv('GREENMIND_PROXY_URL', '').strip()
    proxies = getproxies()
    scheme = 'https' if parts.scheme in {'https', 'wss'} else 'http'
    proxy = explicit or proxies.get(parts.scheme) or proxies.get(scheme) or proxies.get('all')
    if mode == 'auto' and not explicit and proxy_bypass(parts.netloc):
        return [None]
    if not proxy:
        if mode == 'proxy':
            raise ValueError('Proxy mode requires GREENMIND_PROXY_URL or a system proxy.')
        return [None]
    parsed = urlsplit(proxy)
    if parsed.scheme not in {'http', 'https'} or not parsed.hostname or parsed.path not in {'', '/'} or parsed.query or parsed.fragment:
        raise ValueError('Configure an HTTP or HTTPS proxy URL.')
    return [proxy, None] if mode == 'auto' else [proxy]


def connection_unavailable(error):
    return isinstance(error, OSError) and not isinstance(error, ssl.SSLError)


def urlopen(request, timeout=8):
    url = request.full_url if isinstance(request, Request) else request
    routes = proxy_routes(url)
    for index, proxy in enumerate(routes):
        handler = ProxyHandler({'https': proxy, 'http': proxy} if proxy else {})
        try:
            return build_opener(handler).open(request, timeout=timeout)
        except URLError as error:
            # urllib wraps connect failures in URLError; read timeouts aren't retried.
            if index + 1 == len(routes) or not connection_unavailable(error.reason):
                raise


@asynccontextmanager
async def connect_websocket(url, *, connector=None, **kwargs):
    connector = connector or connect
    routes = proxy_routes(url)
    socket = None
    for index, proxy in enumerate(routes):
        try:
            options = {**kwargs, 'proxy': proxy}
            # A stale corporate proxy must not consume the full session startup budget.
            if index + 1 < len(routes):
                options['open_timeout'] = min(options.get('open_timeout', 20), 5)
            socket = await connector(url, **options)
            break
        except OSError as error:
            if index + 1 == len(routes) or not connection_unavailable(error):
                raise
    try:
        yield socket
    finally:
        await socket.close()
