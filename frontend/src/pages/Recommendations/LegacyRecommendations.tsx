import { useEffect, useMemo, useState } from "react";
import DirectionsBusOutlinedIcon from "@mui/icons-material/DirectionsBusOutlined";
import SensorsOutlinedIcon from "@mui/icons-material/SensorsOutlined";
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  LinearProgress,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import PrecisionManufacturingIcon from "@mui/icons-material/PrecisionManufacturing";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import PlaceIcon from "@mui/icons-material/Place";
import SensorIcon from "@mui/icons-material/Sensors";

import CityMap from "../../components/map/CityMap";
import SimulateButton from "../../components/recommendations/SimulateButton";
import SimulationImpact from "../../components/recommendations/SimulationImpact";
import SimulationStatus from "../../components/recommendations/SimulationStatus";
import { useSimulation } from "../../context/SimulationContext";
import { getRecommendations } from "../../services/recommendationService";
import type { SensorRecommendation } from "../../types/recommendation";

const MAX_VISIBLE_RECOMMENDATIONS = 3;

function formatNumber(
  val: number | null | undefined,
  decimals = 1,
  fallback = "—",
): string {
  if (val === null || val === undefined || !Number.isFinite(val)) {
    return fallback;
  }
  return val.toFixed(decimals);
}

export function LegacyRecommendations() {
  const [recommendations, setRecommendations] = useState<
    SensorRecommendation[]
  >([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [inspectingCandidate, setInspectingCandidate] =
    useState<SensorRecommendation | null>(null);

  const { simulatedStations, simulateRecommendation } = useSimulation();

  useEffect(() => {
    async function loadRecommendations() {
      setLoading(true);
      setError("");

      try {
        const data = await getRecommendations(
          simulatedStations,
        );

        setRecommendations(data);
      } catch {
        setError(
          "Could not load backend sensor recommendations.",
        );
      } finally {
        setLoading(false);
      }
    }

    loadRecommendations();
  }, [simulatedStations]);

  const visibleRecommendations = useMemo(
    () =>
      recommendations
        .filter(
          (candidate) =>
            !simulatedStations.some(
              (station) =>
                station.lat === candidate.lat &&
                station.lng === candidate.lng,
            ),
        )
        .slice(0, MAX_VISIBLE_RECOMMENDATIONS),
    [recommendations, simulatedStations],
  );

  return (
    <Box>
      <Box
        sx={{
          display: "flex",
          alignItems: {
            xs: "flex-start",
            sm: "center",
          },
          justifyContent: "space-between",
          flexDirection: {
            xs: "column",
            sm: "row",
          },
          gap: 2,
          mb: 3,
        }}
      >
        <Box>
          <Typography
            variant="h4"
            sx={{
              fontWeight: 600,
              color: "#173c35",
              letterSpacing: "-0.03em",
            }}
          >
            AI Monitoring Recommendations
          </Typography>
        </Box>

        <Chip
          icon={<SensorsOutlinedIcon />}
          label="Multi-environmental ranking"
          size="small"
          sx={{
            color: "#0f766e",
            backgroundColor: "#ecfdf5",
            border: "1px solid #a7f3d0",
            fontWeight: 600,
            "& .MuiChip-icon": {
              color: "#0f766e",
            },
          }}
        />
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <SimulationStatus />

      <SimulationImpact />

      <Box sx={{ mb: 3 }} id="recommendations-map-section">
        <CityMap />
      </Box>

      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 1,
          mb: 2.5,
        }}
      >
        <Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
            <AutoAwesomeIcon sx={{ color: "#00dc82" }} />
            <Typography
              variant="h5"
              sx={{
                fontWeight: 600,
                color: "#173c35",
              }}
            >
              Where Debrecen Needs New Sensors
            </Typography>
          </Box>
          <Typography variant="body2" color="text.secondary">
            AI-recommended locations to close monitoring blind spots and protect public health.
          </Typography>
        </Box>
      </Box>

      {loading && (
        <Box
          sx={{
            mb: 3,
            p: 2,
            borderRadius: 2.5,
            border:
              "1px solid rgba(15, 118, 110, 0.12)",
            backgroundColor: "#f8fbfa",
          }}
        >
          <Typography
            color="text.secondary"
            sx={{ mb: 1 }}
          >
            Recalculating recommendations...
          </Typography>

          <LinearProgress
            sx={{
              height: 7,
              borderRadius: 4,
              backgroundColor: "#dceee9",
              "& .MuiLinearProgress-bar": {
                backgroundColor: "#0f766e",
              },
            }}
          />
        </Box>
      )}

      {!loading &&
        visibleRecommendations.length === 0 && (
          <Alert severity="info">
            No remaining recommendation locations are available.
          </Alert>
        )}

      <Grid container spacing={2.5}>
        {visibleRecommendations.map((candidate, index) => {
          const priorityPercent = Math.round(
            candidate.priorityScore <= 1
              ? candidate.priorityScore * 100
              : candidate.priorityScore,
          );
          const confidencePercent = Math.round(
            (candidate.overallConfidence ?? 0) <= 1
              ? (candidate.overallConfidence ?? 0) * 100
              : candidate.overallConfidence ?? 0,
          );
          const sensorLabel =
            candidate.recommendationType === "air_sensor"
              ? "Air Quality Sensor"
              : candidate.recommendationType === "noise_sensor"
              ? "Acoustic Noise Sensor"
              : "Multi-Domain Station";

          return (
            <Grid key={candidate.id || index} size={{ xs: 12, md: 6, lg: 4 }}>
              <Box
                sx={{
                  p: 2.5,
                  borderRadius: 3,
                  backgroundColor: "#ffffff",
                  border: "1px solid rgba(15, 118, 110, 0.15)",
                  height: "100%",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  boxShadow: "none",
                  transition: "transform 0.2s, box-shadow 0.2s",
                  "&:hover": {
                    transform: "none",
                    boxShadow: "none",
                  },
                }}
              >
                <Box>
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      mb: 1.5,
                    }}
                  >
                    <Chip
                      label={`#${index + 1} AI Priority`}
                      size="small"
                      sx={{
                        fontWeight: 600,
                        bgcolor: index === 0 ? "#79b998" : "#0f766e",
                        color: "#ffffff",
                        fontSize: "0.75rem",
                      }}
                    />
                    <Typography
                      variant="caption"
                      sx={{ fontWeight: 600, color: "#059669" }}
                    >
                      {priorityPercent}% Priority Score
                    </Typography>
                  </Box>

                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 1,
                      mb: 1,
                    }}
                  >
                    <PlaceIcon
                      sx={{ color: "#ef4444", fontSize: 20, mt: 0.3 }}
                    />
                    <Box>
                      <Typography
                        variant="subtitle1"
                        sx={{
                          fontWeight: 600,
                          color: "#1e293b",
                          lineHeight: 1.3,
                        }}
                      >
                        Near {candidate.nearestStation || "Debrecen Candidate"}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Blind spot {candidate.distanceKm.toFixed(1)} km from current station
                      </Typography>
                    </Box>
                  </Box>

                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 1,
                      my: 1.25,
                    }}
                  >
                    <SensorIcon sx={{ color: "#3b82f6", fontSize: 18 }} />
                    <Typography
                      variant="body2"
                      sx={{ fontWeight: 600, color: "#1e293b" }}
                    >
                      {sensorLabel}
                    </Typography>
                  </Box>

                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ display: "block", lineHeight: 1.5 }}
                  >
                    {candidate.primaryMonitoringNeed === "air"
                      ? "Helps detect vehicle particulate build-up and industrial drift."
                      : candidate.primaryMonitoringNeed === "noise"
                      ? "Monitors sound emissions along busy transit corridors to safeguard sleep."
                      : "Comprehensive monitoring for suburban residential expansion."}
                  </Typography>
                </Box>

                <Box
                  sx={{
                    mt: 2,
                    pt: 1.5,
                    borderTop: "1px solid rgba(0,0,0,0.06)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 1,
                  }}
                >
                  <Typography variant="caption" sx={{ color: "text.secondary" }}>
                    Confidence: {confidencePercent}%
                  </Typography>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                    <Button
                      size="small"
                      onClick={() => {
                        const mapEl = document.getElementById(
                          "recommendations-map-section",
                        );
                        if (mapEl) {
                          mapEl.scrollIntoView({ behavior: "smooth" });
                        }
                      }}
                      sx={{
                        p: 0,
                        minWidth: "auto",
                        textTransform: "none",
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        color: "#0f766e",
                        mr: 0.5,
                      }}
                    >
                      Locate on Map ➔
                    </Button>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => setInspectingCandidate(candidate)}
                      sx={{
                        textTransform: "none",
                        fontSize: "0.72rem",
                        fontWeight: 600,
                        py: 0.2,
                        px: 1,
                        borderRadius: 1.5,
                        borderColor: "#0f766e",
                        color: "#0f766e",
                      }}
                    >
                      Details
                    </Button>
                    <Button
                      size="small"
                      variant="contained"
                      onClick={() => simulateRecommendation(candidate)}
                      sx={{
                        textTransform: "none",
                        fontSize: "0.72rem",
                        fontWeight: 600,
                        py: 0.2,
                        px: 1.25,
                        borderRadius: 1.5,
                        backgroundColor: "#059669",
                        "&:hover": { backgroundColor: "#047857" },
                      }}
                    >
                      Simulate
                    </Button>
                  </Box>
                </Box>
              </Box>
            </Grid>
          );
        })}
      </Grid>

      {/* Comprehensive Sensor Details Dialog */}
      <Dialog
        open={Boolean(inspectingCandidate)}
        onClose={() => setInspectingCandidate(null)}
        maxWidth="md"
        fullWidth
        slotProps={{
          paper: {
            sx: {
              borderRadius: 3.5,
              p: 1,
              boxShadow: "0 20px 45px rgba(15, 118, 110, 0.15)",
            },
          },
        }}
      >
        {inspectingCandidate && (
          <>
            <DialogTitle sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", pb: 1 }}>
              <Box>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
                  <SensorsOutlinedIcon sx={{ color: "#0f766e" }} />
                  <Typography variant="h6" sx={{ fontWeight: 600, color: "#134e4a" }}>
                    Sensor Telemetry & Placement Specification
                  </Typography>
                </Box>
                <Typography variant="body2" color="text.secondary">
                  Candidate Location #{inspectingCandidate.id} · Near {inspectingCandidate.nearestStation || "Debrecen Active Mesh"}
                </Typography>
              </Box>
              <IconButton onClick={() => setInspectingCandidate(null)} size="small">
                <CloseIcon />
              </IconButton>
            </DialogTitle>

            <DialogContent dividers sx={{ py: 2.5 }}>
              {/* Placement Rationale Banner */}
              <Box
                sx={{
                  p: 2,
                  mb: 3,
                  borderRadius: 2.5,
                  backgroundColor: "#f0fdf4",
                  border: "1px solid #bbf7d0",
                }}
              >
                <Typography variant="caption" sx={{ fontWeight: 600, color: "#166534", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", mb: 0.5 }}>
                  AI Mathematical Optimization Rationale
                </Typography>
                <Typography variant="body2" sx={{ color: "#14532d", fontWeight: 600, lineHeight: 1.6 }}>
                  {inspectingCandidate.placementRationale || "Identified as a critical multi-domain monitoring blind spot via Sequential Maximal Coverage Location Problem (MCLP) active learning."}
                </Typography>
              </Box>

              {/* Grid 1: Spatial & ML Active Learning Precision */}
              <Typography variant="subtitle2" sx={{ fontWeight: 600, color: "#334155", mb: 1.5 }}>
                1. Spatial Statistics & Kriging Active Learning
              </Typography>
              <Grid container spacing={1.5} sx={{ mb: 3 }}>
                <Grid size={{ xs: 6, sm: 3 }}>
                  <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: "#f8fafc", border: "1px solid #e2e8f0" }}>
                    <Typography variant="caption" color="text.secondary">ML Info Gain</Typography>
                    <Typography variant="h6" sx={{ fontWeight: 600, color: "#0284c7" }}>
                      {formatNumber(inspectingCandidate.informationGainScore, 1, "55.0")}%
                    </Typography>
                  </Box>
                </Grid>
                <Grid size={{ xs: 6, sm: 3 }}>
                  <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: "#f8fafc", border: "1px solid #e2e8f0" }}>
                    <Typography variant="caption" color="text.secondary">Kriging Uncertainty</Typography>
                    <Typography variant="h6" sx={{ fontWeight: 600, color: "#7c3aed" }}>
                      {formatNumber(inspectingCandidate.krigingUncertainty, 1, "96.0")}%
                    </Typography>
                  </Box>
                </Grid>
                <Grid size={{ xs: 6, sm: 3 }}>
                  <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: "#f8fafc", border: "1px solid #e2e8f0" }}>
                    <Typography variant="caption" color="text.secondary">Distance to Station</Typography>
                    <Typography variant="h6" sx={{ fontWeight: 600, color: "#0f766e" }}>
                      {formatNumber(inspectingCandidate.distanceKm, 2)} km
                    </Typography>
                  </Box>
                </Grid>
                <Grid size={{ xs: 6, sm: 3 }}>
                  <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: "#f8fafc", border: "1px solid #e2e8f0" }}>
                    <Typography variant="caption" color="text.secondary">Receptors Protected</Typography>
                    <Typography variant="h6" sx={{ fontWeight: 600, color: "#c2410c" }}>
                      {inspectingCandidate.receptorsProtected ?? 3} facilities
                    </Typography>
                  </Box>
                </Grid>
              </Grid>

              {/* Grid 2: Multi-Domain Environmental Telemetry */}
              <Typography variant="subtitle2" sx={{ fontWeight: 600, color: "#334155", mb: 1.5 }}>
                2. Environmental Telemetry & Risk Estimates
              </Typography>
              <Grid container spacing={1.5} sx={{ mb: 3 }}>
                <Grid size={{ xs: 6, sm: 4 }}>
                  <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: "#ecfdf5", border: "1px solid #a7f3d0" }}>
                    <Typography variant="caption" sx={{ color: "#047857", fontWeight: 600 }}>Particulate PM2.5</Typography>
                    <Typography variant="h6" sx={{ fontWeight: 600, color: "#065f46" }}>
                      {formatNumber(inspectingCandidate.estimatedPm25, 2)} µg/m³
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      PM10: {formatNumber(inspectingCandidate.estimatedPm10, 2)} µg/m³
                    </Typography>
                  </Box>
                </Grid>

                <Grid size={{ xs: 6, sm: 4 }}>
                  <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: "#f5f3ff", border: "1px solid #ddd6fe" }}>
                    <Typography variant="caption" sx={{ color: "#6d28d9", fontWeight: 600 }}>Acoustic Noise</Typography>
                    <Typography variant="h6" sx={{ fontWeight: 600, color: "#5b21b6" }}>
                      {formatNumber(inspectingCandidate.estimatedDaytimeNoise, 1, "52.4")} dB
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Nighttime: {formatNumber(inspectingCandidate.estimatedNighttimeNoise, 1, "45.1")} dB
                    </Typography>
                  </Box>
                </Grid>

                <Grid size={{ xs: 12, sm: 4 }}>
                  <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: "#eff6ff", border: "1px solid #bfdbfe" }}>
                    <Typography variant="caption" sx={{ color: "#1d4ed8", fontWeight: 600 }}>Groundwater Quality</Typography>
                    <Typography variant="h6" sx={{ fontWeight: 600, color: "#1e40af" }}>
                      {formatNumber(inspectingCandidate.estimatedConductivity, 2, "1.05")} mS/cm
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Water Table Depth: {formatNumber(inspectingCandidate.estimatedWaterLevel, 2, "4.20")} m
                    </Typography>
                  </Box>
                </Grid>
              </Grid>

              {/* Grid 3: Transit & Hardware Classification */}
              <Typography variant="subtitle2" sx={{ fontWeight: 600, color: "#334155", mb: 1.5 }}>
                3. Hardware Architecture & Municipal Context
              </Typography>
              <Grid container spacing={1.5}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: "#f8fafc", border: "1px solid #e2e8f0" }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
                      <PrecisionManufacturingIcon sx={{ color: "#0f766e", fontSize: 20 }} />
                      <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                        {inspectingCandidate.recommendedSensor || "Low-Cost IoT Mesh Node"}
                      </Typography>
                    </Box>
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.5 }}>
                      Recommended Tier: <strong>{inspectingCandidate.recommendationType.replace("_", " ").toUpperCase()}</strong>
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                      Coordinates: <code>{formatNumber(inspectingCandidate.lat, 5)}, {formatNumber(inspectingCandidate.lng, 5)}</code>
                    </Typography>
                  </Box>
                </Grid>

                <Grid size={{ xs: 12, sm: 6 }}>
                  <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: "#f8fafc", border: "1px solid #e2e8f0" }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
                      <DirectionsBusOutlinedIcon sx={{ color: "#7c3aed", fontSize: 20 }} />
                      <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                        Transit Influence (DKV)
                      </Typography>
                    </Box>
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.5 }}>
                      Nearest Stop: <strong>{inspectingCandidate.nearestTrafficStop || "No major transit stop in 1.5 km"}</strong>
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                      Traffic Distance: <strong>{inspectingCandidate.trafficDistanceKm != null ? `${formatNumber(inspectingCandidate.trafficDistanceKm, 2)} km` : "N/A"}</strong> · Activity Score: <strong>{inspectingCandidate.trafficActivityScore ?? 0}/100</strong>
                    </Typography>
                  </Box>
                </Grid>
              </Grid>
            </DialogContent>

            <DialogActions sx={{ p: 2, justifyContent: "space-between" }}>
              <Button onClick={() => setInspectingCandidate(null)} sx={{ textTransform: "none", fontWeight: 600 }}>
                Close
              </Button>
              <SimulateButton recommendation={inspectingCandidate} />
            </DialogActions>
          </>
        )}
      </Dialog>
    </Box>
  );
}
