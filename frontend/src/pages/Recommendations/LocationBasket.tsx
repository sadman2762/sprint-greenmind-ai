import { useState } from "react";
import { Alert, Box, Button, Chip, Divider, Drawer, IconButton, Stack, Tab, Tabs, TextField, Typography } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import LocationAddress from "../../components/map/LocationAddress";
import { useSimulation } from "../../context/SimulationContext";
import { getStationCategory } from "../../utils/mapLegend";
import { TIER_CONFIGS } from "../../types/budget";
import type { JointPlan } from "../../services/jointPlanService";

export default function LocationBasket({ open, onClose, plan, onShow, onDownload, onDiscard }: {
  open: boolean; onClose: () => void; plan: JointPlan | null;
  onShow: (lat: number, lng: number) => void; onDownload: () => void; onDiscard: () => void;
}) {
  const { simulatedStations, applySuggestedLocations, removeSimulatedStation } = useSimulation();
  const [section, setSection] = useState<"suggested" | "chosen">(plan ? "suggested" : "chosen");
  const [query, setQuery] = useState("");
  const items = section === "suggested" ? (plan?.steps ?? []).map((s, index) => ({ key: s.station.id, name: `Suggestion ${index + 1}`, lat: s.station.lat, lng: s.station.lng, category: "air", gain: s.marginalKm2, overlap: s.overlapFraction, id: null })) : simulatedStations.map(s => ({ key: String(s.id), id: s.id, name: s.name, lat: s.lat, lng: s.lng, category: getStationCategory(s) ?? "air", gain: null, overlap: null }));
  const visible = items.filter(item => `${item.name} ${item.category} ${item.lat} ${item.lng}`.toLowerCase().includes(query.toLowerCase()));
  return <Drawer sx={{ zIndex: theme => theme.zIndex.tooltip + 1 }} anchor="right" open={open} onClose={onClose} slotProps={{ paper: { sx: { width: { xs: "100%", sm: 440 }, maxWidth: "100%" } } }}>
    <Stack sx={{ height: "100%" }}>
      <Stack direction="row" sx={{ p: 2, alignItems: "center", justifyContent: "space-between" }}><Box><Typography component="h2" variant="h6">Location basket</Typography><Typography variant="caption" color="text.secondary">Review locations before applying</Typography></Box><IconButton aria-label="Close location basket" onClick={onClose}><CloseIcon /></IconButton></Stack>
      <Tabs value={section} onChange={(_, value) => { setSection(value); setQuery(""); }} variant="fullWidth" aria-label="Basket locations">
        <Tab value="suggested" label={`Suggested (${plan?.steps.length ?? 0})`} /><Tab value="chosen" label={`Chosen (${simulatedStations.length})`} />
      </Tabs>
      {items.length > 5 && <Box sx={{ px: 2, pt: 2 }}><TextField size="small" fullWidth label="Filter by name, category or coordinates" value={query} onChange={event => setQuery(event.target.value)} /></Box>}
      <Box sx={{ flex: 1, overflowY: "auto", p: 2 }}>
        {!items.length && <Typography color="text.secondary">{section === "suggested" ? "Request a suggestion to review locations here." : "Apply a suggestion or add a manual pin to start your plan."}</Typography>}
        {visible.map((item, index) => <Box key={item.key} sx={{ py: 1.5 }}>
          <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between", gap: 1 }}><Typography variant="subtitle2">{item.name}</Typography><Chip size="small" label={item.gain === null ? item.category : `+${item.gain.toFixed(2)} km²`} sx={{ bgcolor: "#f5f3ff", color: "#6d28d9" }} /></Stack>
          <Box sx={{ my: 1 }}><LocationAddress compact lat={item.lat} lng={item.lng} /></Box>
          {item.overlap !== null && item.overlap >= 0.8 && <Typography variant="caption" color="warning.main">{(item.overlap * 100).toFixed(0)}% overlaps existing coverage</Typography>}
          <Stack direction="row" sx={{ gap: 1 }}><Button size="small" onClick={() => onShow(item.lat, item.lng)}>Show on map</Button>{item.id !== null && <Button color="error" size="small" onClick={() => removeSimulatedStation(item.id!)}>Remove</Button>}</Stack>
          <AddressDisclosure lat={item.lat} lng={item.lng} />
          {index < visible.length - 1 && <Divider sx={{ mt: 1.5 }} />}
        </Box>)}
      </Box>
      <Stack spacing={1} sx={{ p: 2, borderTop: 1, borderColor: "divider", bgcolor: "background.paper" }}>
        {section === "suggested" && plan && <>
          <Stack direction="row" sx={{ justifyContent: "space-between" }}><Typography variant="body2">{plan.steps.length} sensor{plan.steps.length === 1 ? "" : "s"} · +{plan.jointPlan.metrics.addedKm2.toFixed(2)} km²</Typography><Typography variant="body2">€{(plan.steps.length * TIER_CONFIGS.air.unitCost).toLocaleString()} est.</Typography></Stack>
          {plan.steps.every(s => s.overlapFraction >= 0.8) && <Alert severity="warning" sx={{ py: 0 }}>Small extra reach. Review the cost before adding more.</Alert>}
          <Button variant="contained" onClick={() => { onClose(); applySuggestedLocations(plan.jointPlan.stations); }}>Apply {plan.steps.length === 1 ? "this suggestion" : `these ${plan.steps.length} suggestions`}</Button>
          <Stack direction="row" sx={{ justifyContent: "space-between" }}><Button size="small" onClick={onDownload}>Download placement plan</Button><Button size="small" onClick={() => { onClose(); onDiscard(); }}>Discard suggestions</Button></Stack>
        </>}
        <Typography variant="caption" color="text.secondary">Nearest mapped addresses · © OpenStreetMap contributors. Estimates use a 2 km air-sensor reach and configured hardware costs.</Typography>
      </Stack>
    </Stack>
  </Drawer>;
}
function AddressDisclosure({ lat, lng }: { lat: number; lng: number }) {
  const [expanded, setExpanded] = useState(false);
  return <Box sx={{ mt: 0.5 }}><Button size="small" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>{expanded ? "Hide address details" : "Address & coordinates"}</Button>{expanded && <LocationAddress lat={lat} lng={lng} />}</Box>;
}
