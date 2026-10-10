import { useState } from "react";
import { Alert, Box, Card, Chip, MenuItem, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography, useMediaQuery, useTheme } from "@mui/material";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { ConditionCategory, ConditionDataset } from "../../services/environmentalConditionsService";

export interface EnvironmentalConditionCardProps {
  category: ConditionCategory;
  dataset: ConditionDataset;
}

const titles = { air: "Air conditions", water: "Water conditions", noise: "Noise conditions" };
const formatValue = (value: number | null | undefined) => value == null ? "Unavailable" : value.toLocaleString(undefined, { maximumFractionDigits: 2 });

export default function EnvironmentalConditionCard({ category, dataset }: EnvironmentalConditionCardProps) {
  const theme = useTheme();
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const [waterMetric, setWaterMetric] = useState("conductivity");
  const metrics = category === "water" ? dataset.metrics.filter(metric => metric.key === waterMetric) : dataset.metrics;
  const dates = [...new Set(metrics.flatMap(metric => metric.points.map(point => point.date)))].sort();
  const rows = dates.map(date => ({ date, ...Object.fromEntries(metrics.map(metric => [metric.key, metric.points.find(point => point.date === date)?.value ?? null])) }));
  const latestDate = [...dates].reverse().find(date => metrics.some(metric => metric.points.some(point => point.date === date && point.value !== null)));
  const unit = metrics[0]?.unit ?? "";
  const colors = category === "air" ? ["#27735b"] : category === "water" ? ["#327c9c"] : ["#98713e", "#78847d"];
  const id = `condition-${category}`;
  return <Card component="article" variant="outlined" aria-labelledby={`${id}-title`} sx={{ p: 2, minWidth: 0, height: "100%", borderRadius: "16px", borderTop: 2, borderTopColor: colors[0] }}>
    <Stack direction="row" sx={{ gap: 1, alignItems: "center", justifyContent: "space-between", mb: 1 }}>
      <Typography id={`${id}-title`} component="h3" variant="subtitle1">{titles[category]}</Typography>
      <Chip size="small" variant="outlined" label="Historical" />
    </Stack>
    {category === "water" ? <TextField select fullWidth size="small" label="Water metric" value={waterMetric} onChange={event => setWaterMetric(event.target.value)} sx={{ mt: 1, mb: 1 }}>
      {dataset.metrics.map(metric => <MenuItem key={metric.key} value={metric.key}>{metric.label} ({metric.unit})</MenuItem>)}
    </TextField> : <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>{category === "air" ? "Daily PM2.5 · µg/m³" : "Daytime and nighttime · dB"}</Typography>}
    {dataset.status !== "available" ? <Alert severity={dataset.status === "unavailable" ? "warning" : "info"}>{dataset.message ?? "No measurements available."}</Alert> : !latestDate ? <Alert severity="info">No valid readings for this metric.</Alert> : <>
      <Stack direction="row" sx={{ gap: 2, flexWrap: "wrap" }}>
        {metrics.map((metric, index) => {
          const point = metric.points.find(item => item.date === latestDate);
          return <Box key={metric.key}>
            <Typography component="p" variant="h5" sx={{ color: colors[index], fontVariantNumeric: "tabular-nums" }}>{formatValue(point?.value)}{point?.value != null && <Typography component="span" variant="caption"> {metric.unit}</Typography>}</Typography>
            <Typography variant="caption" color="text.secondary">{metric.label} · {point?.stationCount ?? 0} reporting sites</Typography>
          </Box>;
        })}
      </Stack>
      <Typography variant="caption" color="text.secondary">Latest recorded day: {latestDate}</Typography>
      <Box role="img" aria-label={`${titles[category]} daily trend in ${unit}. Exact values and site counts are in the data table below.`} sx={{ height: theme.spacing(20), mt: 1, minWidth: 0 }}>
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <LineChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} accessibilityLayer>
            <CartesianGrid stroke={theme.palette.divider} vertical={false} />
            <XAxis dataKey="date" tickFormatter={date => String(date).slice(5)} minTickGap={24} tick={{ fill: theme.palette.text.secondary, fontSize: 11 }} tickLine={false} axisLine={false} />
            <YAxis width={40} tick={{ fill: theme.palette.text.secondary, fontSize: 11 }} tickLine={false} axisLine={false} domain={["auto", "auto"]} />
            <Tooltip formatter={(value, name) => [`${formatValue(Number(value))} ${unit}`, name]} contentStyle={{ backgroundColor: theme.palette.background.paper, borderColor: theme.palette.divider, borderRadius: theme.shape.borderRadius, color: theme.palette.text.primary }} />
            {metrics.map((metric, index) => <Line key={metric.key} type="linear" dataKey={metric.key} name={metric.label} stroke={colors[index]} strokeWidth={2} strokeDasharray={index ? "5 3" : undefined} dot={{ r: 1.5 }} activeDot={{ r: 4 }} connectNulls={false} isAnimationActive={!reducedMotion} animationDuration={theme.transitions.duration.short} />)}
          </LineChart>
        </ResponsiveContainer>
      </Box>
      <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>{metrics[0]?.periodStart} – {metrics[0]?.periodEnd} · {metrics[0]?.stationCount ?? 0} sites in period</Typography>
      <Box component="details" sx={{ mt: 1 }}>
        <Typography component="summary" variant="caption" sx={{ cursor: "pointer", color: "primary.main" }}>View daily values</Typography>
        <TableContainer sx={{ maxHeight: theme.spacing(28) }}>
          <Table size="small" stickyHeader aria-label={`${titles[category]} daily values`}>
            <TableHead><TableRow><TableCell>Date</TableCell>{metrics.map(metric => <TableCell key={metric.key}>{metric.label} ({metric.unit}) / sites</TableCell>)}</TableRow></TableHead>
            <TableBody>{dates.map(date => <TableRow key={date}><TableCell component="th" scope="row" sx={{ whiteSpace: "nowrap" }}>{date}</TableCell>{metrics.map(metric => {
              const point = metric.points.find(item => item.date === date);
              return <TableCell key={metric.key}>{formatValue(point?.value)} / {point?.stationCount ?? 0}</TableCell>;
            })}</TableRow>)}</TableBody>
          </Table>
        </TableContainer>
      </Box>
    </>}
    <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: "block" }}>{dataset.description}</Typography>
    <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: "block", overflowWrap: "anywhere" }}>Source: {dataset.sourceFile}</Typography>
  </Card>;
}
