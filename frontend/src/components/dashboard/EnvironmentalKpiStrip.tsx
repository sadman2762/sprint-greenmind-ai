import { Box, ButtonBase, Skeleton, Typography } from "@mui/material";
import AirRoundedIcon from "@mui/icons-material/AirRounded";
import WaterDropOutlinedIcon from "@mui/icons-material/WaterDropOutlined";
import GraphicEqRoundedIcon from "@mui/icons-material/GraphicEqRounded";
import type { ConditionMetric, EnvironmentalConditions } from "../../services/environmentalConditionsService";

function latest(metric?: ConditionMetric) {
  return metric?.points.filter(point => point.value !== null && Number.isFinite(point.value)).sort((a, b) => b.date.localeCompare(a.date))[0];
}
const valueLabel = (value: number | null | undefined) => value == null ? "—" : value.toLocaleString(undefined, { maximumFractionDigits: 2 });

export default function EnvironmentalKpiStrip({ data, error, onOpen }: { data: EnvironmentalConditions | null; error: string; onOpen: () => void }) {
  const air = latest(data?.categories.air.metrics.find(metric => metric.key === "pm25"));
  const water = latest(data?.categories.water.metrics.find(metric => metric.key === "conductivity"));
  const day = latest(data?.categories.noise.metrics.find(metric => metric.key === "daytimeNoise"));
  const night = latest(data?.categories.noise.metrics.find(metric => metric.key === "nighttimeNoise"));
  const cards = [
    { title: "Air · PM2.5", icon: <AirRoundedIcon fontSize="small" />, color: "#27735b", point: air, value: valueLabel(air?.value), unit: "µg/m³" },
    { title: "Water · Conductivity", icon: <WaterDropOutlinedIcon fontSize="small" />, color: "#327c9c", point: water, value: valueLabel(water?.value), unit: "mS/cm" },
    { title: "Noise · Day / night", icon: <GraphicEqRoundedIcon fontSize="small" />, color: "#98713e", point: day, value: `${valueLabel(day?.value)} / ${valueLabel(night?.value)}`, unit: "dB" },
  ];
  return <Box component="section" aria-label="Historical environmental KPIs" sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(3, minmax(210px, 1fr))", md: "repeat(3, minmax(0, 1fr))" }, flexShrink: 0, gap: 1.25, px: { xs: 2, md: 3 }, py: 1.25, bgcolor: "#f5f7f2", borderBottom: 1, borderColor: "divider", overflowX: "auto" }}>
    {cards.map(card => <ButtonBase key={card.title} onClick={onOpen} aria-label={`View ${card.title} history`} sx={{ p: 1.25, px: 1.75, border: "1px solid #e1e7dd", borderRadius: "14px", bgcolor: "#fff", display: "flex", gap: 1.25, justifyContent: "flex-start", textAlign: "left", minWidth: 0 }}>
      <Box sx={{ color: card.color, bgcolor: `${card.color}0c`, width: 34, height: 34, borderRadius: "10px", display: "grid", placeItems: "center", flexShrink: 0 }}>{card.icon}</Box>
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography variant="caption" sx={{ display: "block", fontWeight: 600, color: "text.secondary", fontSize: 11 }}>{card.title}</Typography>
        {!data && !error ? <Skeleton width={100} height={26} /> : <Typography sx={{ fontWeight: 650, color: card.color, fontSize: 23, letterSpacing: "-.65px", lineHeight: 1.3, fontVariantNumeric: "tabular-nums" }}>{card.value}<Box component="span" sx={{ fontSize: 11, letterSpacing: 0, fontWeight: 400, ml: .6 }}>{card.unit}</Box></Typography>}
      </Box>
      <Typography variant="caption" sx={{ color: "text.secondary", fontSize: 10, textAlign: "right", display: { xs: "none", lg: "block" }, lineHeight: 1.5 }}>
        {error ? "Unavailable · retry" : card.point ? <>Historical · {card.point.date}<br />{card.point.stationCount} reporting sites{card.title.startsWith("Noise") && night?.date !== day?.date ? <><br />Night: {night?.date ?? "unavailable"}</> : null}</> : data ? "No measurements" : "Loading measurements"}
      </Typography>
    </ButtonBase>)}
  </Box>;
}
