"""Refresh public BKK route metadata; no API key is needed or read."""
import argparse
import csv
import io
from pathlib import Path
from urllib.request import urlopen
from zipfile import ZipFile

URL = 'https://go.bkk.hu/api/static/v1/public-gtfs/budapest_gtfs.zip'
DEST = Path(__file__).resolve().parents[1] / '.cache/transit/bkk-routes.txt'


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--archive', type=Path, help='Use an already downloaded official BKK archive')
    args = parser.parse_args()
    if args.archive:
        source = args.archive
    else:
        with urlopen(URL, timeout=60) as response:
            data = response.read(100_000_001)
        if len(data) > 100_000_000:
            raise ValueError('GTFS archive exceeds size limit')
        source = io.BytesIO(data)
    with ZipFile(source) as archive:
        if archive.getinfo('routes.txt').file_size > 5_000_000:
            raise ValueError('Routes file exceeds size limit')
        routes = archive.read('routes.txt')
    rows = list(csv.DictReader(io.StringIO(routes.decode('utf-8-sig'))))
    if not rows or not {'route_id', 'route_short_name', 'route_type'} <= rows[0].keys():
        raise ValueError('Unexpected GTFS routes schema')
    DEST.parent.mkdir(parents=True, exist_ok=True)
    temporary = DEST.with_suffix('.tmp')
    temporary.write_bytes(routes)
    temporary.replace(DEST)
    print(f'Updated {len(rows)} BKK routes in {DEST}')


if __name__ == '__main__':
    main()
