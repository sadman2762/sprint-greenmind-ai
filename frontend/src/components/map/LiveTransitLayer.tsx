import { useCityView } from "../../context/cityView";
import { useVoiceActions } from '../../voice/actionContext';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Box, Button, Stack, Typography } from '@mui/material';
import L from 'leaflet';
import { Marker, Popup, Tooltip, useMap } from 'react-leaflet';
import { getLiveVehicles, type LiveSnapshot, type LiveVehicle } from '../../services/liveTransitService';

const MODE_LABELS: Record<string, string> = { bus: 'Buses', tram: 'Trams', trolley: 'Trolleybuses', subway: 'Metro', suburban: 'HÉV / suburban rail', train: 'Trains', ferry: 'Ferries', default: 'Unknown type' };
const MODES = new Set(['bus', 'tram', 'trolley', 'train', 'subway', 'suburban', 'ferry']);
function timeLabel(timestamp: number | null) {
  return timestamp ? new Date(timestamp * 1000).toLocaleTimeString() : 'Not reported';
}
const VehicleMarker = memo(function VehicleMarker({ vehicle, stale }: { vehicle: LiveVehicle; stale: boolean }) {
  const mode = MODES.has(vehicle.mode) ? vehicle.mode : 'default';
  const icon = useMemo(() => L.icon({ iconUrl: `/vehicles/${mode}.png`, iconSize: [44, 44], iconAnchor: [22, 39], popupAnchor: [0, -36], className: 'live-vehicle-marker' }), [mode]);
  const name = vehicle.routeName ? `Route ${vehicle.routeName}` : vehicle.routeId ? `Route ID ${vehicle.routeId}` : 'Vehicle';
  return <Marker position={[vehicle.latitude, vehicle.longitude]} icon={icon} opacity={stale ? 0.45 : 1} title={`${name} · ${vehicle.label || vehicle.vehicleId || vehicle.id}`} bubblingMouseEvents={false}>
    <Tooltip>{name} · {vehicle.label || vehicle.vehicleId || vehicle.id}{stale ? ' · Old or unverified position' : ''}</Tooltip>
    <Popup>
      <Stack spacing={0.5} sx={{ minWidth: 190 }}>
        <Typography variant="subtitle2">{name}</Typography>
        <Typography variant="body2">Vehicle ID: {vehicle.vehicleId || vehicle.id}</Typography>
        {vehicle.label && <Typography variant="body2">Feed label: {vehicle.label}</Typography>}
        <Typography variant="body2">Type: {mode === 'default' ? 'Not reported' : mode}</Typography>
        <Typography variant="body2">Speed: {vehicle.speedKmh === null ? 'Not reported' : `${vehicle.speedKmh} km/h`}</Typography>
        <Typography variant="body2">Position time: {timeLabel(vehicle.observedAt)}</Typography>
        {!vehicle.observedAt && <Typography variant="caption">Freshness uses the feed timestamp; individual position time is missing.</Typography>}
        {stale && <Typography variant="body2" color="warning.main">Old or unverified position</Typography>}
        <Typography variant="caption">{vehicle.latitude.toFixed(6)}, {vehicle.longitude.toFixed(6)}</Typography>
      </Stack>
    </Popup>
  </Marker>;
});

/** Mounted only while the layer is enabled; no requests while the document is hidden. */
export default function LiveTransitLayer({ onClose }: { onClose: () => void }) {
  const map = useMap();
  const { city } = useCityView();
  const panel = useRef<HTMLDivElement>(null);
  const [snapshot, setSnapshot] = useState<LiveSnapshot | null>(null);
  const [error, setError] = useState('');
  const [now, setNow] = useState(() => Date.now() / 1000);
  const [attempt, setAttempt] = useState(0);
  const [mode, setMode] = useState('all');
  useEffect(() => {
    const previous = map.getMinZoom();
    map.setMinZoom(5);
    return () => { map.setMinZoom(previous); };
  }, [map]);
  useEffect(() => {
    if (panel.current) { L.DomEvent.disableClickPropagation(panel.current); L.DomEvent.disableScrollPropagation(panel.current); }
  }, []);
  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    let controller: AbortController | null = null;
    async function poll() {
      if (document.hidden || stopped) return;
      const activeController = new AbortController();
      controller = activeController;
      let delay = 15_000;
      try {
        const result = await getLiveVehicles(activeController.signal);
        if (stopped || activeController.signal.aborted) return;
        setSnapshot(result); setError(''); setNow(Date.now() / 1000);
        delay = Math.max(15, result.refreshSeconds) * 1000;
      } catch (failure) {
        if (stopped || activeController.signal.aborted) return;
        setSnapshot(null);
        setError(failure instanceof Error ? failure.message : 'Live transport is unavailable. Retrying automatically.');
      }
      if (!stopped) timer = setTimeout(poll, delay);
    }
    function visibility() {
      clearTimeout(timer); controller?.abort();
      if (!document.hidden) void poll();
    }
    void poll();
    document.addEventListener('visibilitychange', visibility);
    const clock = setInterval(() => setNow(Date.now() / 1000), 1000);
    return () => { stopped = true; clearTimeout(timer); clearInterval(clock); controller?.abort(); document.removeEventListener('visibilitychange', visibility); };
  }, [attempt]);
  const allVehicles = snapshot?.vehicles ?? [];
  const vehicles = allVehicles.filter(v => mode === 'all' || v.mode === mode);
  const counts = allVehicles.reduce<Record<string, number>>((result, v) => { result[v.mode] = (result[v.mode] ?? 0) + 1; return result; }, {});
  const stale = (v: LiveVehicle) => v.stale || !v.freshnessAt || now - v.freshnessAt > 120 || now - v.freshnessAt < -60;
  const currentCount = vehicles.filter(v => !stale(v)).length;
  useVoiceActions('transit', {
    set_transit_filter: c => { setMode(c.mode!); return { ok: true, message: `Transport filter set to ${c.mode}.`, data: { count: c.mode === 'all' ? allVehicles.length : counts[c.mode!] ?? 0 } }; },
    refresh_transit: () => { setAttempt(a => a + 1); return { ok: true, message: 'Vehicle feed refresh requested; availability is not yet confirmed.' }; },
    focus_transit: () => {
      if (!vehicles.length) return { ok: false, message: 'No vehicle positions available for this filter.' };
      map.fitBounds(vehicles.map(v => [v.latitude, v.longitude] as [number, number]), { padding: [50, 50], maxZoom: 13, animate: false });
      return { ok: true, message: `Showing ${vehicles.length} reported vehicle positions.`, data: { provider: snapshot?.provider, recent: currentCount } };
    },
  }, () => ({ provider: snapshot?.provider ?? null, error, mode, counts, recent: currentCount, feedTimestamp: snapshot?.feedTimestamp ?? null }));
  return <>
    <Box ref={panel} role="region" aria-label="Live transport status" sx={{ position: 'absolute', top: 12, right: 12, zIndex: 1000, width: 280, maxWidth: 'calc(100% - 70px)', bgcolor: 'background.paper', border: 1, borderColor: 'divider', borderRadius: 2, boxShadow: 2, p: 1.5 }}>
      <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="subtitle2">{snapshot?.provider ?? 'Live transport'}</Typography>
        <Button size="small" onClick={onClose}>Hide</Button>
      </Stack>
      <Typography variant="body2" role="status">{error || (snapshot ? `${currentCount} recent · ${vehicles.length - currentCount} old / unverified` : 'Connecting to vehicle feed…')}</Typography>
      {snapshot && <>
        <Box component="select" aria-label="Transport type" value={mode} onChange={event => setMode(event.target.value)} sx={{ mt: 1, mb: 0.5, width: '100%', p: 1, border: 1, borderColor: 'divider', borderRadius: 1, bgcolor: 'background.paper', color: 'text.primary', font: 'inherit', fontSize: 13 }}>
          <option value="all">All transport ({allVehicles.length})</option>
          {Object.entries(MODE_LABELS).filter(([key]) => counts[key] || mode === key).map(([key, label]) => <option key={key} value={key}>{label} ({counts[key] ?? 0})</option>)}
        </Box>
        <Typography variant="caption" sx={{ display: 'block' }}>Feed: {timeLabel(snapshot.feedTimestamp)} · updates every {snapshot.refreshSeconds}s</Typography>
        <Typography variant="caption" sx={{ display: 'block' }}>Vehicle icons = reported positions. Faded = over 2 minutes old or unknown time.</Typography>
        {snapshot.provider.includes('BKK') && <Typography variant="caption" sx={{ display: 'block' }} color="warning.main">BKK feed · Budapest and regional services. DKV coverage is not confirmed.</Typography>}
        {vehicles.length === 0 && <Typography variant="body2">No vehicle positions in this snapshot.</Typography>}
      </>}
      <Stack direction="row" sx={{ mt: 0.5, gap: 1 }}>
        <Button size="small" disabled={!vehicles.length} onClick={() => map.fitBounds(vehicles.map(v => [v.latitude, v.longitude] as [number, number]), { padding: [50, 50], maxZoom: 13, animate: false })}>Show vehicles</Button>
        {city !== 'budapest' && snapshot?.provider.includes('BKK') && <Button size="small" onClick={() => map.setView([47.4979, 19.0402], 13, { animate: false })}>Budapest</Button>}
        <Button size="small" onClick={() => setAttempt(a => a + 1)}>Refresh</Button>
      </Stack>
    </Box>
    {vehicles.map(vehicle => <VehicleMarker key={vehicle.id} vehicle={vehicle} stale={stale(vehicle)} />)}
  </>;
}
