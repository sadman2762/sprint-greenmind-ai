export function cleanStationLocation(location?: string | null): string {
  if (!location) return "Location unavailable";
  // Remove trailing coordinate suffixes like (47.44742297, 21.63063962)
  return location.replace(/\s*\([\d.,\s-]+\)$/, "").trim() || "Location unavailable";
}

export function formatRecordedTime(timestamp?: string): string {
  const match = timestamp?.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?(Z|[+-]\d{2}:\d{2})?$/);
  if (!match) return "Recording time unavailable";
  const [, year, month, day, hour, minute, zone] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (date.getUTCFullYear() !== Number(year) || date.getUTCMonth() !== Number(month) - 1 || date.getUTCDate() !== Number(day) || Number(hour) > 23 || Number(minute) > 59) return "Recording time unavailable";
  const label = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(date);
  return `Recorded ${label}, ${hour}:${minute}${zone === "Z" ? " UTC" : zone ? ` UTC${zone}` : ""}`;
}

export function formatMeasurement(value: number | null | undefined, unit: string, decimals = 1): string {
  return value == null || !Number.isFinite(value) || value < 0 ? "—" : `${value.toFixed(decimals)}${unit === "%" ? "" : " "}${unit}`.trim();
}

export function formatCoValue(value?: number | null): string {
  return formatMeasurement(value != null && value > 10 ? value / 1000 : value, "mg/m³", 2);
}

export function compassDirection(degrees?: number | null): string {
  if (degrees == null || !Number.isFinite(degrees)) return "";
  const labels = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
  return labels[Math.round((((degrees % 360) + 360) % 360) / 22.5) % 16];
}
