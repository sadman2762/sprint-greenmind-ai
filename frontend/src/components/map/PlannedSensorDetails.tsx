import { Alert, Button, FormControl, InputLabel, MenuItem, Select, Stack, Typography } from "@mui/material";
import { useSimulation, type SimulatedStation } from "../../context/SimulationContext";
import { TIER_CONFIGS, type SensorTier } from "../../types/budget";
import type { Station } from "../../types/station";
import { findNearestStation } from "../../utils/nearestStation";
import LocationAddress from "./LocationAddress";

export default function PlannedSensorDetails({ station, stations }: { station: SimulatedStation; stations: Station[] }) {
  const { updateStationTier, removeSimulatedStation } = useSimulation();
  const tier = station.sensorTier ?? "air";
  const config = TIER_CONFIGS[tier];
  const nearest = findNearestStation(station.lat, station.lng, stations, tier);
  return <Stack spacing={2}>
    <FormControl fullWidth size="small"><InputLabel id={`category-${station.id}`}>Sensor category</InputLabel>
      <Select labelId={`category-${station.id}`} label="Sensor category" value={tier} onChange={event => { const value = event.target.value as SensorTier; updateStationTier(station.id, value, TIER_CONFIGS[value]); }}>
        <MenuItem value="air">Air quality</MenuItem><MenuItem value="noise">Noise</MenuItem><MenuItem value="water">Water</MenuItem>
      </Select>
    </FormControl>
    <LocationAddress lat={station.lat} lng={station.lng} />
    <Alert severity="info">Planned location only. No sensor has been installed here, so there are no measured air, noise or water readings for this pin.</Alert>
    <Typography variant="body2">Planning reach: <strong>{config.radiusKm} km</strong>. This is a coverage assumption.</Typography>
    <Typography variant="body2">Nearest existing {tier} sensor: {nearest.station ? `${nearest.station.name} (${nearest.distanceKm!.toFixed(2)} km away)` : "No compatible location available."}</Typography>
    <Typography variant="body2" color="text.secondary">Budget assumptions: €{config.unitCost.toLocaleString()} purchase and €{config.annualOm.toLocaleString()}/year upkeep. These are configured estimates, not a supplier quote.</Typography>
    <Typography variant="caption">Drag the pin to adjust its position. Coverage and the address will update.</Typography>
    <Button color="error" variant="outlined" onClick={() => removeSimulatedStation(station.id)}>{station.isCustom ? "Remove This Custom Sensor" : "Remove From Simulation"}</Button>
  </Stack>;
}
