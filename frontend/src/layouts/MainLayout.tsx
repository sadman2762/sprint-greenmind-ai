import { useState } from "react";
import EnvironmentalOverview from "../components/dashboard/EnvironmentalOverview";
import VoiceControl from "../voice/VoiceControl";
import "../theme/workspace.css";
import RangeController from "../components/map/RangeController";
import { Box, Button, CssBaseline, Stack, Typography } from "@mui/material";
import RadarRoundedIcon from "@mui/icons-material/RadarRounded";
import { Outlet } from "react-router-dom";

export default function MainLayout() {
  const [conditionsOpen, setConditionsOpen] = useState(false);
  return <Box sx={{ height: "100dvh", display: "flex", flexDirection: "column", overflow: "hidden", bgcolor: "background.default" }}>
    <CssBaseline />
    <Stack component="header" direction="row" sx={{ minHeight: 72, py: 1, flexWrap: "wrap", gap: 1, flexShrink: 0, px: { xs: 2, md: 3 }, alignItems: "center", justifyContent: "space-between", bgcolor: "background.paper", borderBottom: 1, borderColor: "divider", zIndex: 1200 }}>
      <Stack direction="row" sx={{ alignItems: "center", gap: 1.25 }}>
        <Box sx={{ width: { xs: 32, sm: 38 }, height: { xs: 32, sm: 38 }, display: "grid", placeItems: "center", bgcolor: "primary.main", color: "white", borderRadius: "12px", boxShadow: "0 4px 12px #17665022" }}><RadarRoundedIcon sx={{ fontSize: 21 }} /></Box>
        <Typography sx={{ fontSize: { xs: 18, sm: 21 }, fontWeight: 750, letterSpacing: "-0.6px" }}>greenmind<span style={{ color: "#78857e", fontWeight: 400 }}> / </span><Box component="span" sx={{ fontSize: 13, fontWeight: 500, letterSpacing: 0, display: { xs: "none", sm: "inline" } }}>Urban intelligence</Box></Typography>
      </Stack>
      <Stack direction="row" sx={{ gap: { xs: .5, sm: 2 }, flexWrap: "wrap", alignItems: "center" }}><Typography variant="caption" sx={{ color: "text.secondary", display: { xs: "none", lg: "block" }, letterSpacing: ".02em" }}>Debrecen, Hungary</Typography><Button size="small" variant={conditionsOpen ? "contained" : "text"} aria-label="Environmental overview" aria-expanded={conditionsOpen} aria-controls="environmental-overview" onClick={() => setConditionsOpen(value => !value)}>Conditions</Button><RangeController /><VoiceControl /></Stack>
    </Stack>
    <EnvironmentalOverview open={conditionsOpen} onOpen={() => setConditionsOpen(true)} />
    <Box component="main" sx={{ flex: 1, minHeight: 0, minWidth: 0 }}><Outlet /></Box>
  </Box>;
}
