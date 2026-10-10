"""Small, user-triggered OSM reverse lookups. No candidate-grid geocoding."""
import json
import threading
import time
from collections import OrderedDict
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request
from app.services.outbound import urlopen

from fastapi import APIRouter, HTTPException, Query

router = APIRouter(prefix="/api/geocoding", tags=["OpenStreetMap addresses"])
_lock = threading.Lock()
_cache = OrderedDict()
_next_request = 0.0
_USER_AGENT = "GreenMindAI/0.2 (https://github.com/sadman2762/sprint-greenmind-ai; local planning demo)"


def lookup_address(lat: float, lng: float):
    global _next_request
    key = (round(lat, 6), round(lng, 6))
    with _lock:
        cached = _cache.get(key)
        if cached and time.monotonic() - cached[0] < 86400:
            _cache.move_to_end(key)
            return cached[1]
        # Public Nominatim permits at most one request per second per application.
        delay = _next_request - time.monotonic()
        if delay > 0:
            time.sleep(delay)
        _next_request = time.monotonic() + 1.1
        url = "https://nominatim.openstreetmap.org/reverse?" + urlencode({
            "format": "jsonv2", "lat": key[0], "lon": key[1], "zoom": 18, "addressdetails": 1,
        })
        try:
            with urlopen(Request(url, headers={"User-Agent": _USER_AGENT, "Accept-Language": "en"}), timeout=8) as response:
                data = json.load(response)
        except (HTTPError, URLError, TimeoutError, ValueError) as error:
            raise HTTPException(status_code=502, detail="OpenStreetMap address lookup is unavailable. The pin coordinates are still valid.") from error
        result = {"displayName": data.get("display_name"), "address": data.get("address", {}),
                  "matchedLat": data.get("lat"), "matchedLng": data.get("lon"),
                  "attribution": "© OpenStreetMap contributors", "provider": "Nominatim"}
        _cache[key] = (time.monotonic(), result)
        if len(_cache) > 1000:
            _cache.popitem(last=False)
        return result


@router.get("/reverse")
def reverse(lat: float = Query(ge=-90, le=90, allow_inf_nan=False), lng: float = Query(ge=-180, le=180, allow_inf_nan=False)):
    return lookup_address(lat, lng)


@router.get('/search')
def search(query: str = Query(min_length=2, max_length=160)):
    """User-triggered named-place lookup bounded to the Debrecen area."""
    global _next_request
    key = ('search', query.strip().casefold())
    with _lock:
        cached = _cache.get(key)
        if cached and time.monotonic() - cached[0] < 86400:
            return cached[1]
        delay = _next_request - time.monotonic()
        if delay > 0:
            time.sleep(delay)
        _next_request = time.monotonic() + 1.1
        url = 'https://nominatim.openstreetmap.org/search?' + urlencode({
            'q': query.strip(), 'format': 'jsonv2', 'limit': 5, 'countrycodes': 'hu',
            'viewbox': '21.4,47.7,21.95,47.35', 'bounded': 1,
        })
        try:
            with urlopen(Request(url, headers={'User-Agent': _USER_AGENT, 'Accept-Language': 'en'}), timeout=8) as response:
                data = json.load(response)
            from app.services.recommendation_engine import is_inside_debrecen
            matches = [{'name': row['display_name'], 'latitude': float(row['lat']), 'longitude': float(row['lon'])}
                       for row in data if is_inside_debrecen(float(row['lat']), float(row['lon']))]
        except (HTTPError, URLError, TimeoutError, ValueError, KeyError, TypeError):
            raise HTTPException(502, 'OpenStreetMap place search is unavailable.') from None
        result = {'matches': matches, 'attribution': '© OpenStreetMap contributors', 'provider': 'Nominatim'}
        _cache[key] = (time.monotonic(), result)
        if len(_cache) > 1000:
            _cache.popitem(last=False)
        return result
