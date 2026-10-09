import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Divider,
} from "@mui/material";
import {
  Air as AirIcon,
  VolumeUp as VolumeIcon,
  WaterDrop as WaterIcon,
  Sensors as SensorsIcon,
  AutoAwesome as AiIcon,
} from "@mui/icons-material";
import { useAppTheme } from "../../context/ThemeContext";

interface CitizenGlossaryDialogProps {
  open: boolean;
  onClose: () => void;
}

export default function CitizenGlossaryDialog({
  open,
  onClose,
}: CitizenGlossaryDialogProps) {
  const { tokens } = useAppTheme();

  const terms = [
    {
      icon: <AirIcon sx={{ color: "#10b981", fontSize: 28 }} />,
      title: "PM2.5 (Fine Dust Particles)",
      simpleAnswer:
        "Microscopic airborne particles smaller than 2.5 microns (30 times thinner than a human hair).",
      whyItMatters:
        "Particles can come from combustion and road dust. Interpreting health guidance requires the matching averaging period; a station snapshot does not establish a safe exposure level.",
      badgeColor: "#10b981",
      badgeBg: "#ecfdf5",
    },
    {
      icon: <VolumeIcon sx={{ color: "#8b5cf6", fontSize: 28 }} />,
      title: "Decibels (dB) & Urban Sound",
      simpleAnswer:
        "The standard unit for loudness. Every 10 dB jump sounds roughly twice as loud to human ears.",
      whyItMatters:
        "Noise effects depend on duration, time of day and the measurement method. District values here are estimates, not evidence of compliance with a noise standard.",
      badgeColor: "#8b5cf6",
      badgeBg: "#f5f3ff",
    },
    {
      icon: <WaterIcon sx={{ color: "#3b82f6", fontSize: 28 }} />,
      title: "Groundwater Vital Signs",
      simpleAnswer:
        "The natural water stored deep beneath Debrecen's soil that feeds plants, trees, and thermal baths.",
      whyItMatters:
        "Temperature describes one property of groundwater. It cannot establish chemical quality, absence of contamination or suitability for drinking.",
      badgeColor: "#3b82f6",
      badgeBg: "#eff6ff",
    },
    {
      icon: <SensorsIcon sx={{ color: "#f59e0b", fontSize: 28 }} />,
      title: "Monitoring Blind Spot",
      simpleAnswer:
        "A neighborhood or park in the city that currently does not have a nearby sensor station.",
      whyItMatters:
        "The coverage preview counts grid points near air stations using a 2 km planning radius. Distance alone cannot establish environmental representativeness.",
      badgeColor: "#f59e0b",
      badgeBg: "#fffbeb",
    },
    {
      icon: <AiIcon sx={{ color: "#00dc82", fontSize: 28 }} />,
      title: "How GreenMind AI Helps Debrecen",
      simpleAnswer:
        "An intelligent system developed for Debrecen that combines official Green Sentinel data and public transport routes.",
      whyItMatters:
        "The system scores a defined set of candidate locations using environmental and coverage assumptions. Recommendations require review of feasible sites and model limitations.",
      badgeColor: "#0f766e",
      badgeBg: "#e6fffa",
    },
  ];

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      slotProps={{
        paper: {
          sx: {
            borderRadius: 3,
            p: 1,
            border: `1px solid ${tokens.cardBorder}`,
          },
        },
      }}
    >
      <DialogTitle sx={{ pb: 1 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: 2,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "#0b1329",
              color: "#ffffff",
              fontSize: "1.25rem",
            }}
          >
            🌿
          </Box>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 600, color: tokens.textPrimary }}>
              Citizen Environmental Guide
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Understand Debrecen's environmental indicators in simple, everyday language
            </Typography>
          </Box>
        </Box>
      </DialogTitle>

      <DialogContent dividers sx={{ borderColor: "rgba(0,0,0,0.06)" }}>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2, py: 1 }}>
          {terms.map((term) => (
            <Box
              key={term.title}
              sx={{
                p: 2,
                borderRadius: 2.5,
                backgroundColor: term.badgeBg,
                border: `1px solid ${term.badgeColor}33`,
              }}
            >
              <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5, mb: 1 }}>
                {term.icon}
                <Box>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600, color: tokens.textPrimary }}>
                    {term.title}
                  </Typography>
                  <Typography variant="body2" sx={{ color: tokens.textPrimary, mt: 0.5, fontWeight: 500 }}>
                    {term.simpleAnswer}
                  </Typography>
                </Box>
              </Box>
              <Divider sx={{ my: 1, borderColor: `${term.badgeColor}22` }} />
              <Typography variant="caption" sx={{ color: "text.secondary", display: "block", pl: 5 }}>
                <strong>Why it matters: </strong> {term.whyItMatters}
              </Typography>
            </Box>
          ))}
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button
          onClick={onClose}
          variant="contained"
          sx={{
            borderRadius: 2,
            px: 3,
            fontWeight: 600,
            textTransform: "none",
            backgroundColor: "#0b1329",
            color: "#ffffff",
            "&:hover": {
              backgroundColor: "#1e293b",
            },
          }}
        >
          Got it, thanks!
        </Button>
      </DialogActions>
    </Dialog>
  );
}
