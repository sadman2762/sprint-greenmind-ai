"""Adapter for the actual Sayem-Kabir/greenmind-ai recommendation sequence.

The local recommendation_engine.py is byte-identical to the pinned upstream
file. Its selection loop is preserved, including dynamic updates and relaxation.
IDW/ML fields are historical reporting outputs, not the selection objective.
"""
from threading import RLock

from app.services.recommendation_engine import generate_recommendations

SOURCE = {
    'repository': 'https://github.com/Sayem-Kabir/greenmind-ai',
    'commit': 'c15c09f694012d8abc75fb252c89a27c3fa4faef',
    'file': 'backend/app/services/recommendation_engine.py',
    'sha256': 'f695f66ab415ae932011e6a831dac1290e9d085781d51cbb9cc81533ada897a3',
}
_LOCK = RLock()


def run_original(stations, count):
    # The upstream route exposes this sequence's prefix. Never re-sort by its
    # post-selection Priority Score or pass the new planner's separation setting.
    with _LOCK:
        return generate_recommendations(stations, count=count, minimum_distance_km=2.8)
