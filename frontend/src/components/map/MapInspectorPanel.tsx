import { useId, useState } from "react";
import { Box, Button, Collapse, IconButton, Paper, Stack, Typography, useMediaQuery, useTheme } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { useMapInspector } from "../../context/mapInspectorState";

export default function MapInspectorPanel({ compact = false }: { compact?: boolean }) {
  const { selection, setHost, close } = useMapInspector();
  const [expanded, setExpanded] = useState(false);
  const headingId = useId();
  const theme = useTheme();
  const desktop = useMediaQuery(theme.breakpoints.up("md"));
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const open = desktop || expanded;
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
        height: { xs: "auto", md: compact ? "clamp(380px, 48vh, 540px)" : "68vh" },
        maxHeight: { xs: "50dvh", md: compact ? "clamp(380px, 48vh, 540px)" : "68vh" },
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
            onClick={() => setExpanded((value) => !value)}
            endIcon={open ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          >
            {open ? "Collapse details" : "Expand details"}
          </Button>
        )}
        <IconButton aria-label="Close location details" onClick={() => close()} size="small"><CloseIcon /></IconButton>
      </Stack>
      <Collapse in={open} timeout={reducedMotion ? 0 : theme.transitions.duration.shorter}>
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
      </Collapse>
    </Paper>
  );
}
