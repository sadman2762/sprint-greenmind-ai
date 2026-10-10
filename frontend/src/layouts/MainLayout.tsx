import VoiceControl from "../voice/VoiceControl";
import RangeController from "../components/map/RangeController";
import { Box, CssBaseline, Stack, Typography } from "@mui/material";
import RadarRoundedIcon from "@mui/icons-material/RadarRounded";
import { Outlet } from "react-router-dom";

export default function MainLayout() {
  return <Box sx={{ height: "100dvh", display: "flex", flexDirection: "column", overflow: "hidden", bgcolor: "background.default" }}>
    <CssBaseline />
    <Stack component="header" direction="row" sx={{ height: 60, flexShrink: 0, px: { xs: 2, md: 3 }, alignItems: "center", justifyContent: "space-between", bgcolor: "background.paper", borderBottom: 1, borderColor: "divider", zIndex: 1200 }}>
      <Stack direction="row" sx={{ alignItems: "center", gap: 1.25 }}>
        <Box sx={{ width: 32, height: 32, display: "grid", placeItems: "center", bgcolor: "primary.main", color: "white", borderRadius: "9px" }}><RadarRoundedIcon sx={{ fontSize: 21 }} /></Box>
        <Typography sx={{ display: { xs: "none", sm: "block" }, fontSize: 17, fontWeight: 750, letterSpacing: "-0.6px" }}>greenmind<span style={{ color: "#78857e", fontWeight: 400 }}> / </span><Box component="span" sx={{ fontSize: 13, fontWeight: 500, letterSpacing: 0, display: { xs: "none", sm: "inline" } }}>Network planner</Box></Typography>
      </Stack>
      <Stack direction="row" sx={{ gap: 1, alignItems: "center" }}><VoiceControl /><RangeController /></Stack>
    </Stack>
    <Box component="main" sx={{ flex: 1, minHeight: 0, minWidth: 0 }}><Outlet /></Box>
  </Box>;
}
