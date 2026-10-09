# Live vehicle positions

The map's **Live transport** button enables a GTFS-Realtime VehiclePositions layer. It is separate from historical DKV passenger activity, sensor coverage and planning. No live vehicle data enters the placement algorithm.

## Configure locally

Keep credentials in an ignored `backend/.env` (never in frontend or git). Restart the backend after changing environment settings.

```dotenv
TRANSIT_VEHICLE_POSITIONS_URL=https://YOUR-PROVIDER/VehiclePositions.pb
TRANSIT_PROVIDER_NAME=DKV Debrecen
TRANSIT_API_KEY=YOUR_LOCAL_KEY
TRANSIT_API_KEY_PARAM=key
```

Only use the DKV label with a confirmed DKV feed. The supplied `https://go.bkk.hu/api/query/v1/ws/gtfs-rt/full/VehiclePositions.pb` is **BKK Budapest**, and is always labeled accordingly. This URL is the default when only `API_KEY` or `TRANSIT_API_KEY` is set. An explicit HTTPS URL can also be used for a public feed without a key.

Standard GTFS-RT vehicle positions do not carry a transport mode or a public route number. Optionally set `TRANSIT_GTFS_ROUTES_FILE` to a local, provider-matched static GTFS `routes.txt`. The adapter joins `route_id`, `route_short_name`, `route_type`. Supported standard types: 0 tram, 1 subway, 2/12 train, 3 bus, 4 ferry, 11 trolleybus. Unknown/extended types use the neutral icon. No route-name/type guessing is performed. Icons were supplied by the user and resized for map display; originals are unchanged.

## API and behavior

`GET /api/transit/vehicles` returns schema 1.0: `provider`, `fetchedAt`, `feedTimestamp`, `refreshSeconds`, `skippedPositions`, `vehicles`. Each vehicle has a stable feed entity ID, optional label/vehicle/route/trip IDs, optional joined route name/type, coordinates, optional bearing and speed (converted m/s to km/h), individual timestamp, effective freshness timestamp and stale flag. Absent fields are null.

The server requests at most once every 15 seconds per worker/configuration, coalescing concurrent requests. Timeouts (8 seconds), 20 MB limit, invalid payloads and differential snapshots are rejected. Full snapshots replace the previous set, so disappeared vehicles are removed. HTTP 503 means missing/invalid server configuration; 502 means the upstream or metadata could not be read. Error details never include keys or upstream exception text. There is no fabricated fallback or cached-success fallback after an upstream failure.

The browser polls every 15 seconds only while enabled and visible, aborts obsolete requests, removes vehicles on request failure, and updates freshness every second. Markers are faded when over 120 seconds old, future-dated by over 60 seconds, or lacking any timestamp. Feed time is used if the individual timestamp is absent, and the popup states this limitation. Empty snapshots and errors are distinct states.

The map keeps the user's view until **Show vehicles** is pressed. This fits all reported positions (the tested BKK feed includes regional services); it does not relocate the Debrecen sensor network. **Layers → Reset view** restores the planning map. Popup data are reported values, not interpolated speed, inferred bus routes, or fabricated arrivals.

This is polling of reported positions, not continuous GPS streaming. A real DKV deployment still requires the confirmed DKV endpoint and credentials. Tests use clearly synthetic fixtures and no external feed calls.

Live verification on 2026-10-09: the user configured the key locally; the endpoint returned 1,192 positions, 1,175 recent at the time of the check. The source is BKK, with regional positions beyond Budapest. This does not establish a DKV vehicle feed. Counts change over time.

## BKK transport types

To join current public BKK route names and transport types, run from the repository root:

```sh
backend/.venv/bin/python backend/tools/update_transit_routes.py
```

The command downloads the official public GTFS archive, extracts only `routes.txt` into ignored `backend/.cache/transit/bkk-routes.txt`, and leaves the source datasets unchanged. Refresh this cache when the timetable changes. BKK snapshots automatically use this cache unless `TRANSIT_GTFS_ROUTES_FILE` overrides it. Extended GTFS type 109 is shown as HÉV/suburban rail. Vehicles without a matching route retain the unknown icon.

The map offers a transport-type filter with counts and a **Budapest** button for the confirmed BKK source. **Show vehicles** fits the currently filtered positions. A vehicle's feed label is displayed separately from its ID: in this feed the label often describes its destination.
