"""Historical noise sites, separate from live air telemetry and legacy demo scores."""
import csv
import hashlib
import math
from collections import defaultdict
from pathlib import Path
from app.services.recommendation_engine import parse_location_coordinates

NOISE_PATH = Path(__file__).resolve().parents[3] / 'data/processed/noise_measurements_cleaned.csv'


def load_noise_sites(path=NOISE_PATH):
    grouped = defaultdict(lambda: defaultdict(dict))
    try:
        with Path(path).open(encoding='utf-8-sig', newline='') as handle:
            for row in csv.DictReader(handle):
                kind = {'LAEQ nappali': 'daytimeNoise', 'LAEQ éjszakai': 'nighttimeNoise'}.get(row.get('measurement_type'))
                if not kind or row.get('unit') != 'dB':
                    continue
                try:
                    value = float(row['value'])
                    coordinates = parse_location_coordinates(row['location'])
                    if not coordinates or not (-90 <= coordinates[0] <= 90 and -180 <= coordinates[1] <= 180) or not math.isfinite(value) or not 0 <= value <= 200 or not row.get('timestamp'):
                        continue
                except (ValueError, KeyError):
                    continue
                # One reported day/night interval per date, never duplicate it.
                grouped[row['location']][kind][row['timestamp']] = value
    except (OSError, csv.Error):
        return []
    sites = []
    for location, kinds in sorted(grouped.items()):
        lat, lng = parse_location_coordinates(location)
        dates = sorted({date for values in kinds.values() for date in values})
        code = 'NOISE-' + hashlib.sha256(location.encode()).hexdigest()[:10]
        # Equal-duration daily periods: combine sound energy, not arithmetic dB.
        values = {kind: 10 * math.log10(sum(10 ** (v / 10) for v in records.values()) / len(records)) for kind, records in kinds.items()}
        sites.append(dict(id=-int(hashlib.sha256(location.encode()).hexdigest()[:8], 16),
                          stationCode=code, name=location, lat=lat, lng=lng, station_type=2,
                          sensorTier='noise', periodStart=dates[0], periodEnd=dates[-1],
                          recordCount=sum(len(records) for records in kinds.values()), **values))
    return sites
