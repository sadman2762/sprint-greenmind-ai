import { Box, Button, Slider, Stack, Typography, ToggleButton, ToggleButtonGroup } from "@mui/material";
import { networkColor, type NetworkNode, type NetworkRelation } from "../../utils/networkGraph";

export default function NetworkConnections({ node, relations, distance, onDistance, onSelect, unavailable, filter, onFilter, onBack }: { onBack?: () => void; node: NetworkNode; relations: NetworkRelation[]; distance: number; onDistance: (distance: number) => void; onSelect: (node: NetworkNode) => void; unavailable?: string; filter: "all" | "sensors" | "transit"; onFilter: (filter: "all" | "sensors" | "transit") => void }) {
  const visible = relations.slice(0, 6);
  return <Stack spacing={2} sx={{ p: 2 }}>
    {onBack && <Button size="small" onClick={onBack} sx={{ alignSelf: "flex-start", p: 0 }}>← Previous sensor</Button>}
    <Box><Typography variant="subtitle2">Connections</Typography><Typography variant="caption" color="text.secondary">{node.source}. Links are derived from coordinates and your zone settings.</Typography></Box>
    <Box><Typography variant="caption">Nearby search · {distance} km</Typography><Slider aria-label="Connection search distance" value={distance} min={0.1} max={10} step={0.1} onChange={(_, value) => onDistance(value as number)} /><Typography variant="caption" color="text.secondary">Overlapping zones are included even beyond this distance.</Typography></Box>
    <ToggleButtonGroup exclusive fullWidth size="small" value={filter} aria-label="Connection types" onChange={(_, value) => { if (value) onFilter(value); }}><ToggleButton value="all">All</ToggleButton><ToggleButton value="sensors">Sensors</ToggleButton><ToggleButton value="transit">DKV</ToggleButton></ToggleButtonGroup>
    {unavailable && <Typography role="status" variant="caption" color="warning.main">{unavailable}</Typography>}
    <Box key={node.id} component="svg" viewBox="0 0 300 240" role="group" aria-label="Sensor and transit relationship graph" sx={{ width: "100%", bgcolor: "#f6f8f3", borderRadius: 3, animation: "panel-arrive 300ms ease", "& g[role=button]:focus-visible": { outline: "2px solid #176650", outlineOffset: 3 }, "& g[role=button]:hover circle": { stroke: "#fff", strokeWidth: 4 } }}>
      {visible.map((relation, i) => {
        const angle = -Math.PI / 2 + i * 2 * Math.PI / Math.max(visible.length, 1);
        const x = 150 + Math.cos(angle) * 106, y = 120 + Math.sin(angle) * 86;
        return <g key={relation.target.id}>
          <line x1="150" y1="120" x2={x} y2={y} stroke={networkColor(relation.target)} strokeOpacity="0.4" strokeWidth="2" strokeDasharray={relation.kind === "shared-zone" ? undefined : "4 4"} />
          <g role="button" tabIndex={0} aria-label={`Explore ${relation.target.name}`} onClick={() => onSelect(relation.target)} onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSelect(relation.target); } }} style={{ cursor: "pointer" }}>
            <title>{relation.target.name}: {relation.title}, {relation.distanceKm.toFixed(2)} km</title>
            <circle cx={x} cy={y} r="18" fill={networkColor(relation.target)} />
            <text x={x} y={y + 4} textAnchor="middle" fill="white" fontSize="12" fontWeight="700">{i + 1}</text>
            <text x={x} y={y + 31} textAnchor="middle" fill="#42574d" fontSize="10">{relation.distanceKm.toFixed(2)} km</text>
          </g>
        </g>;
      })}
      <circle cx="150" cy="120" r="36" fill={networkColor(node)} opacity="0.08" /><circle cx="150" cy="120" r="25" fill={networkColor(node)} /><text x="150" y="124" textAnchor="middle" fill="white" fontSize="11">{node.category.toUpperCase()}</text>
    </Box>
    <Typography variant="caption" color="text.secondary">{relations.length} connections · showing {visible.length} nearest. Solid lines: overlapping zones. Dashed: proximity.</Typography>
    {visible.length === 0 && <Typography variant="body2">No connections found in this search distance.</Typography>}
    {visible.map((relation, i) => <Box key={relation.target.id} sx={{ borderTop: 1, borderColor: "divider", pt: 1.5 }}>
      <Button size="small" sx={{ textAlign: "left", justifyContent: "flex-start" }} onClick={() => onSelect(relation.target)}>{i + 1}. {relation.target.name}</Button>
      <Typography variant="body2">{relation.title} · {relation.distanceKm.toFixed(2)} km</Typography>
      <Typography variant="caption" color="text.secondary">{relation.explanation}</Typography>
      {relation.target.category === "transit" && <Typography variant="caption" component="p">DKV · May 2026 · activity index {Number.isFinite(relation.target.activity) ? relation.target.activity?.toFixed(1) : "unavailable"}/100. Source: processed DKV stop statistics.</Typography>}
    </Box>)}
    {node.category === "transit" && <Typography variant="caption">DKV May 2026 · activity index {Number.isFinite(node.activity) ? node.activity?.toFixed(1) : "unavailable"}/100. Passenger activity is not vehicle frequency.</Typography>}
  </Stack>;
}
