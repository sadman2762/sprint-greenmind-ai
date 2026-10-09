import { useState } from "react";
import { isInsideDebrecenBoundary } from "../../utils/isInsideDebrecenBoundary";
import type { Icon, DivIcon } from "leaflet";
import { Marker, Tooltip } from "react-leaflet";
import { useMapInspector } from "../../context/mapInspectorState";
import { activateMapMarker } from "../../utils/mapMarker";
import type { PlanStation } from "../../services/jointPlanService";

export default function SuggestedStationMarker({ station, index, icon, disabled, onMove }: { station: PlanStation; index: number; icon: Icon | DivIcon; disabled?: boolean; onMove: (index: number, lat: number, lng: number) => Promise<boolean> }) {
  const [invalidMove, setInvalidMove] = useState(false);
  const { select } = useMapInspector();
  return <Marker draggable={!disabled} autoPan position={[station.lat, station.lng]} icon={icon} title={`Joint station ${index + 1}`} eventHandlers={{ dragstart: () => setInvalidMove(false), dragend: async event => {
    const marker = event.target;
    const { lat, lng } = marker.getLatLng();
    if (!isInsideDebrecenBoundary(lat, lng)) { marker.setLatLng([station.lat, station.lng]); setInvalidMove(true); marker.openTooltip(); return; }
    const accepted = await onMove(index, lat, lng);
    if (!accepted) marker.setLatLng([station.lat, station.lng]);
  }, keydown: activateMapMarker, click: event => select({ id: `proposal-${-2000 - index}`, title: `Suggested location ${index + 1}`, subtitle: "Unapplied suggestion · drag to adjust" }, event.target.getElement()) }}><Tooltip>{invalidMove ? "Keep the proposal inside the study boundary." : `Suggested location ${index + 1} · drag to adjust · click for connections`}</Tooltip></Marker>;
}
