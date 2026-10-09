import { Accordion, AccordionDetails, AccordionSummary, Box, Chip, Grid, IconButton, Stack, Tooltip, Typography } from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import type { Station } from "../../types/station";
import { PM25_BANDS } from "../../utils/mapLegend";
import { cleanStationLocation, compassDirection, formatCoValue, formatMeasurement } from "../../utils/stationDetails";

export default function StationDetails({ station }: { station: Station }) {
  if (station.sensorTier === "noise") return <Stack spacing={2}>
    <Typography variant="subtitle2">Historical noise measurements</Typography>
    <Typography variant="body2">{station.periodStart} to {station.periodEnd}</Typography>
    <Typography variant="body2">Daytime: {formatMeasurement(station.daytimeNoise, "dB")}</Typography>
    <Typography variant="body2">Nighttime: {formatMeasurement(station.nighttimeNoise, "dB")}</Typography>
    <Typography variant="caption" color="text.secondary">Sound-energy averages of recorded daily periods. These are historical observations, not live readings or measurements at a suggested location.</Typography>
    <Typography variant="caption">{station.lat.toFixed(6)}, {station.lng.toFixed(6)}</Typography>
  </Stack>;
  const validPm25 = station.pm25 != null && Number.isFinite(station.pm25) && station.pm25 >= 0;
  const bandIndex = validPm25 ? PM25_BANDS.findIndex((band) => station.pm25! <= band.max) : -1;
  const measurements = [
    { label: "PM10", description: "Coarse particulate matter", value: formatMeasurement(station.pm10, "µg/m³") },
    { label: "NO₂", description: "Nitrogen dioxide", value: formatMeasurement(station.no2, "µg/m³") },
    { label: "O₃", description: "Ozone", value: formatMeasurement(station.o3, "µg/m³") },
    { label: "CO", description: "Carbon monoxide", value: formatCoValue(station.co) },
  ];
  const weather = [
    { label: "Wind", value: `${formatMeasurement(station.windSpeed, "km/h")}${compassDirection(station.windDirection) ? ` · ${compassDirection(station.windDirection)}` : ""}` },
    { label: "Humidity", value: formatMeasurement(station.humidity, "%", 0) },
    { label: "Pressure", value: formatMeasurement(station.pressure, "mbar", 0) },
  ];

  return (
    <Stack spacing={3}>
      {/* Air Quality or Surface Water Section */}
      {station.station_type === 1 ? (
        <Typography variant="body2" color="text.secondary">Water measurements are not included in this station response.</Typography>
      ) : (
        <>
          {/* Hero Card for PM2.5 */}
          <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between", gap: 2 }}>
            <Box>
              <Typography component="h4" variant="body2" color="text.secondary">PM2.5</Typography>
              <Typography variant="h4" sx={{ fontWeight: 600, fontVariantNumeric: "tabular-nums", mt: 0.5 }}>
                {validPm25 ? station.pm25!.toFixed(1) : "—"}
                {validPm25 && <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 0.75 }}>µg/m³</Typography>}
              </Typography>
            </Box>
            <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
              <Chip size="small" variant="outlined" label={bandIndex < 0 ? "No reading" : PM25_BANDS[bandIndex].label} color={bandIndex < 0 ? "default" : bandIndex === 0 ? "success" : bandIndex === 1 ? "warning" : "error"} />
              <Tooltip title="Application display bands, not a regulatory compliance assessment.">
                <IconButton size="small" aria-label="About PM2.5 display bands"><InfoOutlinedIcon fontSize="small" /></IconButton>
              </Tooltip>
            </Stack>
          </Stack>
          {/* 2x2 Secondary Pollutants Grid */}
          <Grid container component="dl" spacing={2} sx={{ m: 0, pt: 2, borderTop: 1, borderColor: "divider" }}>
            {measurements.map((measurement) => (
              <Grid key={measurement.label} size={6}>
                <Typography component="dt" variant="caption" color="text.secondary" title={measurement.description}>{measurement.label}</Typography>
                <Typography component="dd" variant="body1" sx={{ m: 0, mt: 0.5, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{measurement.value}</Typography>
              </Grid>
            ))}
          </Grid>
        </>
      )}
      <Accordion disableGutters elevation={0} sx={{ "&::before": { display: "none" }, borderTop: 1, borderColor: "divider" }}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ px: 0 }}>
          <Typography variant="body2">Weather & location</Typography>
        </AccordionSummary>
        <AccordionDetails sx={{ p: 0 }}>
          {/* Microclimate 3-Column Strip */}
          <Stack component="dl" spacing={1.5} sx={{ m: 0 }}>
            {weather.map((measurement) => (
              <Stack key={measurement.label} direction="row" sx={{ justifyContent: "space-between", gap: 2 }}>
                <Typography component="dt" variant="body2" color="text.secondary">{measurement.label}</Typography>
                <Typography component="dd" variant="body2" sx={{ m: 0, fontVariantNumeric: "tabular-nums" }}>{measurement.value}</Typography>
              </Stack>
            ))}
          </Stack>
          {/* Location & GPS Footer */}
          <Stack spacing={0.5} sx={{ mt: 2, pt: 2, borderTop: 1, borderColor: "divider" }}>
            <Typography variant="body2">{cleanStationLocation(station.location || station.name)}</Typography>
            <Typography variant="caption" color="text.secondary" sx={{ fontVariantNumeric: "tabular-nums" }}>
              {Number.isFinite(station.lat) && Number.isFinite(station.lng) ? `${station.lat.toFixed(4)}, ${station.lng.toFixed(4)}` : "Coordinates unavailable"}
            </Typography>
          </Stack>
        </AccordionDetails>
      </Accordion>
    </Stack>
  );
}
