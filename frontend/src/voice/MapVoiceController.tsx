import { useMap } from 'react-leaflet';
import { useMediaQuery } from '@mui/material';
import { useVoiceActions } from './actionContext';
import type { NetworkNode } from '../utils/networkGraph';
import { isInsideDebrecenBoundary } from '../utils/isInsideDebrecenBoundary';
export default function MapVoiceController({ nodes }: { nodes: NetworkNode[] }) {
  const map = useMap();
  const reduced = useMediaQuery('(prefers-reduced-motion: reduce)');
  useVoiceActions('viewport', {
    zoom: c => { if (c.direction === 'in') map.zoomIn(); else map.zoomOut(); return { ok: true, message: `Map zoom ${map.getZoom()}.` }; },
    focus_sensor: c => {
      const node = c.sensorId ? nodes.find(n => n.id === c.sensorId) : null;
      const latitude = node?.lat ?? c.latitude; const longitude = node?.lng ?? c.longitude;
      if (latitude === undefined || longitude === undefined || !isInsideDebrecenBoundary(latitude, longitude)) return { ok: false, message: 'Choose a known sensor or coordinates inside the Debrecen boundary.' };
      map.stop();
      if (reduced) map.setView([latitude, longitude], 14, { animate: false });
      else map.flyTo([latitude, longitude], 14, { duration: .65 });
      return { ok: true, message: `Map focused on ${node?.name ?? 'the requested coordinates'}.`, data: { latitude, longitude } };
    },
  }, () => ({ center: map.getCenter(), zoom: map.getZoom() }));
  return null;
}
