import { useState } from "react";
import { Alert, Box, Paper, Typography, Tabs, Tab, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, useMediaQuery } from "@mui/material";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, PieChart, Pie, Cell } from "recharts";
import type { DistrictProfile } from "../../services/aiAnalyticsService";
import { finiteValue, measurement } from "../../utils/dashboardMetrics";

interface DashboardChartsProps {
  districtProfiles?: DistrictProfile[];
  coveragePercentage: number | null;
  loading: boolean;
}

export default function DashboardCharts({ districtProfiles, coveragePercentage, loading }: DashboardChartsProps) {
  const [activeTab, setActiveTab] = useState(0);
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const profiles = Array.isArray(districtProfiles) ? districtProfiles : [];
  const air = profiles.map((profile) => ({ district: profile.district, pm25: finiteValue(profile.pm25) }))
    .filter((profile) => profile.pm25 !== null && profile.pm25 >= 0);
  const noise = profiles.map((profile) => ({ district: profile.district, day: finiteValue(profile.dayNoise), night: finiteValue(profile.nightNoise) }))
    .filter((profile) => profile.day !== null || profile.night !== null);
  const coverage = finiteValue(coveragePercentage);
  const covered = coverage !== null && coverage >= 0 && coverage <= 100 ? coverage : null;
  const coverageData = covered === null ? [] : [
    { name: "Within 2 km of an air station", value: covered, color: "#38785b" },
    { name: "Beyond 2 km", value: 100 - covered, color: "#d69a35" },
  ];
  const empty = loading ? "Loading chart data…" : "No district estimates are available.";
  return (
    <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 }, mt: 3, borderRadius: 3, minWidth: 0, overflow: "hidden" }}>
      <Typography component="h2" variant="h6">Explore the monitoring data</Typography>
      <Tabs value={activeTab} onChange={(_, value: number) => setActiveTab(value)} aria-label="Environmental charts"
        variant="scrollable" scrollButtons="auto" allowScrollButtonsMobile sx={{ mt: 1, mb: 3, borderBottom: 1, borderColor: "divider" }}>
        {["Air quality", "Noise levels", "Coverage"].map((label, index) => <Tab key={label} label={label} id={`dashboard-tab-${index}`} aria-controls={`dashboard-panel-${index}`} />)}
      </Tabs>
      <Box role="tabpanel" id={`dashboard-panel-${activeTab}`} aria-labelledby={`dashboard-tab-${activeTab}`}>
        {activeTab < 2 && <>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{activeTab === 0 ? "Estimated PM2.5 by district" : "Estimated day and night noise"}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>Model estimates at district locations, not measurements at each location. Missing values are omitted from the chart.</Typography>
          {(activeTab === 0 ? air.length === 0 : noise.length === 0) ? <Alert severity="info">{empty}</Alert> :
            <Box sx={{ height: Math.max(300, profiles.length * 48), minWidth: 0, overflow: "hidden" }}>
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <BarChart<{ district: string; pm25?: number | null; day?: number | null; night?: number | null }> layout="vertical" data={activeTab === 0 ? air : noise} margin={{ top: 8, right: 16, left: 0, bottom: 20 }}>
                  <XAxis type="number" domain={[0, "auto"]} tick={{ fontSize: 11 }} label={{ value: activeTab === 0 ? "PM2.5 (µg/m³)" : "Sound level (dB)", position: "insideBottom", offset: -12 }} />
                  <YAxis type="category" dataKey="district" width={115} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(value) => [`${value} ${activeTab === 0 ? "µg/m³" : "dB"}`]} />
                  {activeTab === 0 ? <Bar dataKey="pm25" name="Estimated PM2.5" fill="#38785b" radius={[0, 4, 4, 0]} isAnimationActive={!reducedMotion} /> : <>
                    <Legend />
                    <Bar dataKey="day" name="Day" fill="#2563eb" isAnimationActive={!reducedMotion} />
                    <Bar dataKey="night" name="Night" fill="#7c3aed" isAnimationActive={!reducedMotion} />
                  </>}
                </BarChart>
              </ResponsiveContainer>
            </Box>}
          {profiles.length > 0 && <Box component="details" sx={{ mt: 2 }}>
            <Typography component="summary" variant="body2" sx={{ cursor: "pointer" }}>View estimate values</Typography>
            <TableContainer><Table size="small" aria-label="District estimates">
              <TableHead><TableRow><TableCell>District</TableCell><TableCell>{activeTab === 0 ? "PM2.5" : "Day"}</TableCell>{activeTab === 1 && <TableCell>Night</TableCell>}</TableRow></TableHead>
              <TableBody>{profiles.map((profile, index) => <TableRow key={`${profile.district}-${index}`}>
                <TableCell>{profile.district}</TableCell><TableCell>{measurement(finiteValue(activeTab === 0 ? profile.pm25 : profile.dayNoise), activeTab === 0 ? "µg/m³" : "dB")}</TableCell>
                {activeTab === 1 && <TableCell>{measurement(finiteValue(profile.nightNoise), "dB")}</TableCell>}
              </TableRow>)}</TableBody>
            </Table></TableContainer>
          </Box>}
        </>}
        {activeTab === 2 && <>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Air-network proximity preview</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>Share of sampled urban grid points within 2 km of an air station. This local distance model does not measure pollution or establish coverage for noise or water.</Typography>
          {covered === null ? <Alert severity="info">{loading ? "Loading station locations…" : "Station locations are unavailable."}</Alert> : <>
            <Typography variant="h4" sx={{ fontVariantNumeric: "tabular-nums" }}>{covered.toFixed(1)}%</Typography>
            <Typography variant="body2" color="text.secondary">within 2 km · {(100 - covered).toFixed(1)}% beyond 2 km</Typography>
            <Box sx={{ height: 240 }}>
              <ResponsiveContainer width="100%" height="100%" minWidth={0}><PieChart>
                <Pie data={coverageData} dataKey="value" innerRadius={65} outerRadius={100} isAnimationActive={!reducedMotion}>
                  {coverageData.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
                </Pie>
                <Tooltip formatter={(value) => `${Number(value).toFixed(1)}%`} />
              </PieChart></ResponsiveContainer>
            </Box>
          </>}
        </>}
      </Box>
    </Paper>
  );
}
