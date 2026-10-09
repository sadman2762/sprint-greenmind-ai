import { useEffect } from "react";
import { Circle, CircleMarker, Polyline, Tooltip, useMap } from "react-leaflet";
import { useMediaQuery } from "@mui/material";
import type { NetworkNode, NetworkRelation } from "../../utils/networkGraph";
import { networkColor } from "../../utils/networkGraph";

export default function ConnectionLayer({ node, relations, onSelect }: { node: NetworkNode; relations: NetworkRelation[]; onSelect: (node: NetworkNode) => void }) {
  const map = useMap();
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  useEffect(() => {
    map.stop();
    if (reducedMotion) map.setView([node.lat, node.lng], 14, { animate: false });
    else map.flyTo([node.lat, node.lng], 14, { duration: 0.85 });
  }, [map, node.id, node.lat, node.lng, reducedMotion]);
  return <>
    {node.radiusKm && <Circle center={[node.lat, node.lng]} radius={node.radiusKm * 1000} pathOptions={{ color: networkColor(node), weight: 2, fillOpacity: 0.04 }} interactive={false} />}
    <CircleMarker center={[node.lat, node.lng]} radius={13} pathOptions={{ color: networkColor(node), fillColor: "white", fillOpacity: 1, weight: 4 }}><Tooltip>{node.name}</Tooltip></CircleMarker>
    {relations.slice(0, 6).map((relation, i) => <Polyline key={relation.target.id} positions={[[node.lat, node.lng], [relation.target.lat, relation.target.lng]]} pathOptions={{ color: networkColor(relation.target), weight: 2, dashArray: relation.kind === "shared-zone" ? undefined : "5 7" }}>
      <Tooltip>{relation.title} · {relation.distanceKm.toFixed(2)} km</Tooltip>
      <CircleMarker center={[relation.target.lat, relation.target.lng]} radius={9} pathOptions={{ color: networkColor(relation.target), fillOpacity: 1 }} eventHandlers={{ click: () => onSelect(relation.target) }}><Tooltip permanent direction="top">{i + 1}</Tooltip></CircleMarker>
    </Polyline>)}
  </>;
}
