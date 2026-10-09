import { useId, useState, type ReactNode } from "react";
import { Box, Button, Collapse, IconButton, Paper, Stack, Typography, useMediaQuery, useTheme, ToggleButton, ToggleButtonGroup } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { useMapInspector } from "../../context/mapInspectorState";

export default function MapInspectorPanel({ compact = false, workspace = false, connections, rangeEditor, fallbackDetails, connectionsOpen = false, onConnectionsChange }: { compact?: boolean; workspace?: boolean; connections?: ReactNode; rangeEditor?: ReactNode; fallbackDetails?: ReactNode; connectionsOpen?: boolean; onConnectionsChange?: (open: boolean) => void }) {
  const { selection, setHost, close } = useMapInspector();
  const [expanded, setExpanded] = useState(false);
  const headingId = useId();
  const theme = useTheme();
  const desktop = useMediaQuery(theme.breakpoints.up("md"));
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const open = desktop || expanded || connectionsOpen;
  if (!selection) return null;

  return (
    <Paper
      component="aside"
      aria-label="Map feature details"
      elevation={0}
      square
      sx={{
        minWidth: 0,
        minHeight: 0,
        position: workspace ? { xs: "absolute", md: "relative" } : undefined,
        bottom: 0, left: 0, right: 0, zIndex: 1250,
        height: workspace ? { xs: "auto", md: "100%" } : { xs: "auto", md: compact ? "clamp(380px, 48vh, 540px)" : "68vh" },
        maxHeight: workspace ? { xs: "85%", md: "100%" } : { xs: "50dvh", md: compact ? "clamp(380px, 48vh, 540px)" : "68vh" },
        overflowY: "auto",
        overscrollBehavior: "contain",
        borderLeft: { xs: 0, md: 1 },
        borderTop: { xs: 1, md: 0 },
        borderColor: "divider",
        bgcolor: "background.paper",
      }}
    >
      {/* Header */}
      <Stack direction="row" sx={{ alignItems: "flex-start", gap: 1, p: 2.5, position: "sticky", top: 0, bgcolor: "background.paper", zIndex: 1, borderBottom: 1, borderColor: "divider" }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography component="h3" variant="subtitle1" sx={{ fontWeight: 600, lineHeight: 1.35, overflowWrap: "anywhere" }} id={headingId}>{selection.title}</Typography>
          {selection.subtitle && <Typography component="p" variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>{selection.subtitle}</Typography>}
          {selection.description && <Typography component="p" variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>{selection.description}</Typography>}
        </Box>
        {!desktop && (
          <Button
            size="small"
            aria-expanded={open}
            aria-controls={`${headingId}-content`}
            onClick={() => { if (open) { setExpanded(false); onConnectionsChange?.(false); } else setExpanded(true); }}
            endIcon={open ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          >
            {open ? "Collapse details" : "Expand details"}
          </Button>
        )}
        <IconButton aria-label="Close location details" onClick={() => close()} size="small"><CloseIcon /></IconButton>
      </Stack>
      {connections && <ToggleButtonGroup exclusive fullWidth size="small" value={connectionsOpen ? "connections" : "details"} aria-label="Location inspector view" onChange={(_, value) => { if (value) onConnectionsChange?.(value === "connections"); }}><ToggleButton value="details">Details</ToggleButton><ToggleButton value="connections">Connections</ToggleButton></ToggleButtonGroup>}
      <Collapse in={open} timeout={reducedMotion ? 0 : theme.transitions.duration.shorter}>{connectionsOpen && rangeEditor ? <Box component="details" sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: "divider" }}><Typography component="summary" variant="body2" sx={{ cursor: "pointer" }}>Adjust this sensor’s radius</Typography>{rangeEditor}</Box> : rangeEditor}{connectionsOpen && connections}</Collapse>
      <Collapse in={open && !connectionsOpen} timeout={reducedMotion ? 0 : theme.transitions.duration.shorter}>
        <Box
          id={`${headingId}-content`}
          ref={setHost}
          sx={{
            p: 2.5,
            "& .MuiTypography-caption": { fontSize: theme.typography.caption.fontSize, lineHeight: 1.6 },
            "& .MuiTypography-noWrap": { whiteSpace: "normal", overflowWrap: "anywhere" },
            "& .MuiTypography-h6": { fontSize: theme.typography.h5.fontSize, lineHeight: 1.4 },
          }}
        />
        {fallbackDetails && !connectionsOpen && <Box sx={{ px: 2.5, pb: 2.5 }}>{fallbackDetails}</Box>}
      </Collapse>
    </Paper>
  );
}
