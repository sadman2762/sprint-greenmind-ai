"""Server-only GTFS-RT VehiclePositions proxy. No key or upstream URL in responses."""
import csv
import math
import os
import threading
import time
from pathlib import Path
from urllib.parse import urlencode, urlsplit, urlunsplit, parse_qsl
from urllib.request import Request
from app.services.outbound import urlopen

from dotenv import load_dotenv
from fastapi import HTTPException
from google.transit import gtfs_realtime_pb2

ROOT = Path(__file__).resolve().parents[3]
load_dotenv(ROOT / '.env')
load_dotenv(ROOT / 'backend' / '.env')
BKK_URL = 'https://go.bkk.hu/api/query/v1/ws/gtfs-rt/full/VehiclePositions.pb'
POLL_SECONDS = 15
_lock = threading.Lock()
_cache = None
_cache_key = None
_cache_until = 0.0
TYPES = {0: 'tram', 1: 'subway', 2: 'train', 3: 'bus', 4: 'ferry', 11: 'trolley', 12: 'train', 109: 'suburban'}


def route_metadata(bkk=False):
    """Optional provider-matched GTFS routes.txt; never infer a mode from route ID."""
    path = os.getenv('TRANSIT_GTFS_ROUTES_FILE')
    if not path and bkk:
        cached = ROOT / 'backend/.cache/transit/bkk-routes.txt'
        path = cached if cached.exists() else None
    if not path:
        return {}
    with open(path, encoding='utf-8-sig', newline='') as source:
        return {row['route_id']: {'routeName': row.get('route_short_name') or None,
                'mode': TYPES.get(int(row['route_type']), 'default')}
                for row in csv.DictReader(source)}


def decode_feed(content, provider, routes=None, now=None):
    now = time.time() if now is None else now
    routes = routes or {}
    feed = gtfs_realtime_pb2.FeedMessage()
    feed.ParseFromString(content)
    if not feed.IsInitialized() or not feed.header.gtfs_realtime_version:
        raise ValueError('Invalid GTFS feed')
    if feed.header.incrementality == gtfs_realtime_pb2.FeedHeader.DIFFERENTIAL:
        raise ValueError('Only full snapshots supported')
    feed_time = int(feed.header.timestamp) if feed.header.HasField('timestamp') else None
    vehicles = {}
    skipped = 0
    for entity in feed.entity:
        if entity.is_deleted or not entity.HasField('vehicle'):
            continue
        v = entity.vehicle
        if not v.HasField('position'):
            skipped += 1
            continue
        p = v.position
        lat, lng = p.latitude, p.longitude
        if not (p.HasField('latitude') and p.HasField('longitude') and math.isfinite(lat) and math.isfinite(lng)
                and -90 <= lat <= 90 and -180 <= lng <= 180):
            skipped += 1
            continue
        route_id = v.trip.route_id or None
        observed = int(v.timestamp) if v.HasField('timestamp') else None
        effective = observed or feed_time
        age = now - effective if effective else None
        vehicles[entity.id] = {
            'id': entity.id, 'vehicleId': v.vehicle.id or None, 'label': v.vehicle.label or None,
            'routeId': route_id, 'tripId': v.trip.trip_id or None,
            'routeName': routes.get(route_id, {}).get('routeName'),
            'mode': routes.get(route_id, {}).get('mode', 'default'),
            'latitude': lat, 'longitude': lng,
            'bearing': p.bearing if p.HasField('bearing') and math.isfinite(p.bearing) and 0 <= p.bearing < 360 else None,
            'speedKmh': round(p.speed * 3.6, 1) if p.HasField('speed') and math.isfinite(p.speed) and p.speed >= 0 else None,
            'observedAt': observed, 'freshnessAt': effective,
            'stale': age is None or age > 120 or age < -60,
        }
    return {'schemaVersion': '1.0', 'provider': provider, 'fetchedAt': int(now),
            'feedTimestamp': feed_time, 'refreshSeconds': POLL_SECONDS,
            'vehicles': list(vehicles.values()), 'skippedPositions': skipped}


def snapshot():
    global _cache, _cache_key, _cache_until
    url = os.getenv('TRANSIT_VEHICLE_POSITIONS_URL', BKK_URL)
    parts = urlsplit(url)
    key = os.getenv('TRANSIT_API_KEY') or os.getenv('API_KEY')
    bkk = parts.hostname == 'go.bkk.hu'
    provider = 'BKK · Budapest' if bkk else os.getenv('TRANSIT_PROVIDER_NAME', 'GTFS transport provider')
    if not os.getenv('TRANSIT_VEHICLE_POSITIONS_URL') and not key:
        raise HTTPException(503, 'Live transport is not configured on the server.')
    if parts.scheme != 'https' or not parts.netloc:
        raise HTTPException(503, 'Live transport requires a valid HTTPS feed URL.')
    query = dict(parse_qsl(parts.query))
    if key:
        query[os.getenv('TRANSIT_API_KEY_PARAM', 'key')] = key
    request_url = urlunsplit((parts.scheme, parts.netloc, parts.path, urlencode(query), ''))
    # BKK is publicly reachable. Don't tie it to Azure's corporate proxy route.
    # Explicit administrator/service configuration still takes precedence.
    network_mode = os.getenv('TRANSIT_NETWORK_MODE') or os.getenv('GREENMIND_NETWORK_MODE') or ('direct' if bkk else 'auto')
    config_key = (request_url, provider, os.getenv('TRANSIT_GTFS_ROUTES_FILE'), network_mode, os.getenv('GREENMIND_PROXY_URL'))
    with _lock:
        if config_key == _cache_key and time.monotonic() < _cache_until:
            if isinstance(_cache, HTTPException):
                raise _cache
            return _cache
        try:
            request = Request(request_url, headers={'Accept': 'application/x-protobuf', 'User-Agent': 'GreenMindAI/0.2'})
            with urlopen(request, timeout=8, network_mode=network_mode) as response:
                content = response.read(20_000_001)
            if len(content) > 20_000_000:
                raise ValueError('Feed too large')
            result = decode_feed(content, provider, route_metadata(bkk))
        except Exception:
            # Do not expose exception text: upstream errors may contain the API key.
            result = HTTPException(502, 'Live transport feed is unavailable. Check the server feed settings and try again.')
        _cache, _cache_key, _cache_until = result, config_key, time.monotonic() + POLL_SECONDS
        if isinstance(result, HTTPException):
            raise result
        return result
