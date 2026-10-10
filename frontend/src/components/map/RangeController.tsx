import { useVoiceActions } from "../../voice/actionContext";
import RadiusInput from "./RadiusInput";
import { useState } from "react";
import { Box, Button, Dialog, DialogContent, DialogTitle, IconButton, Stack, Typography } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { useRanges } from "../../context/rangeState";
import { COVERAGE_CATEGORIES } from "../../utils/mapLegend";
import { sensorRangeKey } from "../../utils/sensorRange";
import type { Station } from "../../types/station";

export function SensorRangeEditor({ station }: { station: Station }) {
  const { radiusFor, overrides, setOverride } = useRanges();
  const key = sensorRangeKey(station);
  const value = radiusFor(station);
  return <Box sx={{ borderBottom: 1, borderColor: "divider", p: 2 }}>
    <RadiusInput key={`${key}-${value}`} label="This sensor’s scenario radius" value={value} onChange={next => setOverride(key, next)} />
    <Typography variant="caption" color="text.secondary">{overrides[key] === undefined ? "Uses the category setting." : "Individual setting overrides the category radius."} A scenario zone, not verified detection range.</Typography>
    {overrides[key] !== undefined && <Button size="small" onClick={() => setOverride(key, null)}>Use category radius</Button>}
  </Box>;
}
export default function RangeController() {
  const [open, setOpen] = useState(false);
  const { radii, setRadius, overrides } = useRanges();
  useVoiceActions("ranges", { open_panel: c => { setOpen(c.visible!); return { ok: true, message: `Sensor ranges ${c.visible ? "opened" : "closed"}.` }; } }, () => ({ open }));
  return <>
    <Button size="small" variant="outlined" onClick={() => setOpen(true)}>Sensor ranges</Button>
    <Dialog open={open} onClose={() => setOpen(false)} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>Sensor ranges<IconButton aria-label="Close sensor ranges" onClick={() => setOpen(false)}><CloseIcon /></IconButton></DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>Choose the radius for your scenario. These starting values are editable, not known hardware specifications. Changes update map zones and planning calculations.</Typography>
        <Stack spacing={2}>{COVERAGE_CATEGORIES.map(({ value, label }) => <RadiusInput key={`${value}-${radii[value]}`} label={`${label} radius`} value={radii[value]} onChange={next => setRadius(value, next)} />)}</Stack>
        <Typography variant="caption" color="text.secondary">Select a sensor on the map to set its own radius. {Object.keys(overrides).length} individual settings. Water zones show proximity, not water flow or catchment coverage.</Typography>
        <Button fullWidth variant="contained" sx={{ mt: 2 }} onClick={() => setOpen(false)}>Done</Button>
      </DialogContent>
    </Dialog>
  </>;
}
