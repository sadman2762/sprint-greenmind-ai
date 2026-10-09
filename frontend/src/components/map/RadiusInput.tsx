import { useEffect, useState } from "react";
import { Box, Slider, TextField } from "@mui/material";
import { MAX_RADIUS_KM, MIN_RADIUS_KM, validRadius } from "../../utils/sensorRange";

export default function RadiusInput({ label, value, onChange, onValidityChange }: { label: string; value: number; onChange: (value: number) => void; onValidityChange?: (valid: boolean) => void }) {
  useEffect(() => { onValidityChange?.(true); }, [onValidityChange]);
  const [draft, setDraft] = useState(String(value));
  const valid = draft.trim() !== "" && validRadius(Number(draft));
  const commit = () => { if (valid) onChange(Number(draft)); };
  return <Box>
    <TextField size="small" label={label} value={draft} type="number" fullWidth error={!valid} helperText={!valid ? "Use 0.05–10 km" : "Radius in km · 0.05–10"} onChange={event => { setDraft(event.target.value); onValidityChange?.(event.target.value.trim() !== "" && validRadius(Number(event.target.value))); }} onBlur={commit} onKeyDown={event => { if (event.key === "Enter") commit(); }} slotProps={{ htmlInput: { min: MIN_RADIUS_KM, max: MAX_RADIUS_KM, step: 0.05 } }} />
    <Slider aria-label={`${label} slider`} value={valid ? Number(draft) : value} min={MIN_RADIUS_KM} max={MAX_RADIUS_KM} step={0.05} valueLabelDisplay="auto" onChange={(_, next) => { setDraft(String(next)); onValidityChange?.(true); }} onChangeCommitted={(_, next) => onChange(next as number)} />
  </Box>;
}
