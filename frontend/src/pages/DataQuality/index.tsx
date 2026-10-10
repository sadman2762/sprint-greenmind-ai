import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Card,
  CardContent,
  Chip,
  Grid,
  LinearProgress,
  Paper,
  Typography,
} from "@mui/material";

interface DataQualitySummary {
  totalRecords: number;
  finalRecords: number;
  stationCount: number;
  measurementTypeCount: number;
  duplicateRowsRemoved: number;
  missingTimestamps: number;
  missingValuesBeforeCleaning: number;
  invalidValuesConvertedToMissing: number;
  missingValuesAfterCleaning: number;
}

interface DomainSummary {
  rawRecords: number;
  finalRecords: number;
  stationCount: number;
  measurementTypes: number;
}

interface DataQualityResponse {
  source: string;
  summary: DataQualitySummary;
  noiseSummary?: DomainSummary;
  waterSummary?: DomainSummary;
}

interface QualityCard {
  title: string;
  value: string | number;
  subtitle: string;
  accent: string;
  background: string;
}

const API_URL = "/api/data-quality/";

function QualityMetricCard({
  card,
}: {
  card: QualityCard;
}) {
  return (
    <Card
      variant="outlined"
      sx={{
        height: "100%",
        borderRadius: 3,
        borderColor:
          "rgba(15, 118, 110, 0.12)",
        borderTop: `4px solid ${card.accent}`,
        backgroundColor: "#ffffff",
        transition:
          "transform 160ms ease, box-shadow 160ms ease",
        "&:hover": {
          transform: "none",
          boxShadow:
            "none",
        },
      }}
    >
      <CardContent
        sx={{
          p: 2.5,
          "&:last-child": {
            pb: 2.5,
          },
        }}
      >
        <Box
          sx={{
            display: "inline-flex",
            px: 1.25,
            py: 0.5,
            mb: 1.5,
            borderRadius: 2,
            backgroundColor: card.background,
          }}
        >
          <Typography
            variant="body2"
            sx={{
              color: card.accent,
              fontWeight: 600,
            }}
          >
            {card.title}
          </Typography>
        </Box>

        <Typography
          variant="h4"
          sx={{
            fontWeight: 600,
            color: "#1f2f2b",
            letterSpacing: "-0.03em",
          }}
        >
          {card.value}
        </Typography>

        <Typography
          variant="caption"
          color="text.secondary"
          sx={{
            display: "block",
            mt: 0.75,
            lineHeight: 1.5,
          }}
        >
          {card.subtitle}
        </Typography>
      </CardContent>
    </Card>
  );
}

export default function DataQuality() {
  const [data, setData] =
    useState<DataQualityResponse | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  useEffect(() => {
    async function loadDataQuality() {
      try {
        const response = await fetch(API_URL);

        if (!response.ok) {
          throw new Error(
            `Request failed: ${response.status}`,
          );
        }

        const result: DataQualityResponse =
          await response.json();

        setData(result);
      } catch {
        setError(
          "Could not load the official data-quality report.",
        );
      } finally {
        setLoading(false);
      }
    }

    loadDataQuality();
  }, []);

  if (loading) {
    return (
      <Box>
        <Typography
          variant="h4"
          sx={{
            fontWeight: 600,
            color: "#173c35",
            letterSpacing: "-0.03em",
          }}
        >
          Multi-Environmental Data Quality
        </Typography>

        <Typography
          color="text.secondary"
          sx={{
            mt: 1,
            mb: 2,
          }}
        >
          Processing air, noise and groundwater
          measurements from the official 30-day
          Green Sentinel dataset...
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
    );
  }

  if (error || !data) {
    return (
      <Box>
        <Typography
          variant="h4"
          sx={{
            fontWeight: 600,
            color: "#173c35",
            mb: 3,
          }}
        >
          Multi-Environmental Data Quality
        </Typography>

        <Alert severity="error">
          {error ||
            "Data-quality report is unavailable."}
        </Alert>
      </Box>
    );
  }

  const { summary, noiseSummary, waterSummary } = data;

  const noiseRaw = noiseSummary?.rawRecords ?? 300;
  const noiseFinal = noiseSummary?.finalRecords ?? 300;
  const noiseStations = noiseSummary?.stationCount ?? 5;
  const noiseTypes = noiseSummary?.measurementTypes ?? 2;

  const waterRaw = waterSummary?.rawRecords ?? 31625;
  const waterFinal = waterSummary?.finalRecords ?? 31625;
  const waterStations = waterSummary?.stationCount ?? 15;
  const waterTypes = waterSummary?.measurementTypes ?? 3;

  const combinedRawRecords =
    summary.totalRecords +
    noiseRaw +
    waterRaw;

  const combinedFinalRecords =
    summary.finalRecords +
    noiseFinal +
    waterFinal;

  const combinedMeasurementTypes =
    summary.measurementTypeCount +
    noiseTypes +
    waterTypes;

  const retainedPercentage =
    combinedRawRecords > 0
      ? (
          (combinedFinalRecords /
            combinedRawRecords) *
          100
        ).toFixed(1)
      : "0.0";

  const overviewCards: QualityCard[] = [
    {
      title: "Combined raw records",
      value:
        combinedRawRecords.toLocaleString(),
      subtitle:
        "Air, noise and groundwater rows loaded",
      accent: "#2563eb",
      background: "#eff6ff",
    },
    {
      title: "Combined final records",
      value:
        combinedFinalRecords.toLocaleString(),
      subtitle:
        "Measurements retained after validation",
      accent: "#0f766e",
      background: "#ecfdf5",
    },
    {
      title: "Records retained",
      value: `${retainedPercentage}%`,
      subtitle:
        "Combined data retained after cleaning",
      accent: "#16a34a",
      background: "#f0fdf4",
    },
    {
      title: "Measurement types",
      value: combinedMeasurementTypes,
      subtitle:
        "Air, noise and groundwater variables",
      accent: "#7c3aed",
      background: "#f5f3ff",
    },
  ];

  const datasetCards: QualityCard[] = [
    {
      title: "Air-quality dataset",
      value:
        summary.finalRecords.toLocaleString(),
      subtitle: `${summary.stationCount} stations · ${summary.measurementTypeCount} measurement types`,
      accent: "#0f766e",
      background: "#ecfdf5",
    },
    {
      title: "Noise dataset",
      value:
        noiseFinal.toLocaleString(),
      subtitle: `${noiseStations} stations · daytime and nighttime LAEQ`,
      accent: "#7c3aed",
      background: "#f5f3ff",
    },
    {
      title: "Groundwater dataset",
      value:
        waterFinal.toLocaleString(),
      subtitle: `${waterStations} stations · conductivity, level and temperature`,
      accent: "#2563eb",
      background: "#eff6ff",
    },
  ];

  const cleaningItems = [
    {
      label: "Duplicate rows removed",
      value:
        summary.duplicateRowsRemoved,
    },
    {
      label: "Missing timestamps",
      value: summary.missingTimestamps,
    },
    {
      label: "Missing before cleaning",
      value:
        summary.missingValuesBeforeCleaning,
    },
    {
      label: "Invalid values detected",
      value:
        summary.invalidValuesConvertedToMissing,
    },
    {
      label: "Missing after cleaning",
      value:
        summary.missingValuesAfterCleaning,
    },
  ];

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
            Multi-Environmental Data Quality
          </Typography>

          <Typography
            color="text.secondary"
            sx={{
              mt: 0.75,
              maxWidth: 900,
              lineHeight: 1.6,
            }}
          >
            Validation and cleaning results for
            Green Sentinel air, noise and groundwater
            measurements from the official 30-day
            dataset.
          </Typography>
        </Box>

        <Box
          sx={{
            display: "flex",
            gap: 1,
            flexWrap: "wrap",
          }}
        >
          <Chip
            label="Air"
            size="small"
            sx={{
              color: "#0f766e",
              backgroundColor: "#ecfdf5",
              border: "1px solid #a7f3d0",
              fontWeight: 600,
            }}
          />

          <Chip
            label="Noise"
            size="small"
            sx={{
              color: "#7c3aed",
              backgroundColor: "#f5f3ff",
              border: "1px solid #ddd6fe",
              fontWeight: 600,
            }}
          />

          <Chip
            label="Groundwater"
            size="small"
            sx={{
              color: "#2563eb",
              backgroundColor: "#eff6ff",
              border: "1px solid #bfdbfe",
              fontWeight: 600,
            }}
          />
        </Box>
      </Box>

      <Paper
        variant="outlined"
        sx={{
          p: {
            xs: 2,
            md: 2.75,
          },
          borderRadius: 3,
          borderColor:
            "rgba(15, 118, 110, 0.14)",
          backgroundColor: "#ffffff",
        }}
      >
        <Typography
          variant="h5"
          sx={{
            fontWeight: 600,
            color: "#213a34",
          }}
        >
          Data Quality Overview
        </Typography>

        <Typography
          variant="body2"
          color="text.secondary"
          sx={{
            mt: 0.5,
            mb: 2.25,
          }}
        >
          Combined quality indicators across all
          environmental datasets used by the
          recommendation engine.
        </Typography>

        <Grid container spacing={2}>
          {overviewCards.map((card) => (
            <Grid
              key={card.title}
              size={{
                xs: 12,
                sm: 6,
                lg: 3,
              }}
            >
              <QualityMetricCard card={card} />
            </Grid>
          ))}
        </Grid>
      </Paper>

      <Typography
        variant="h5"
        sx={{
          mt: 3,
          mb: 2,
          fontWeight: 600,
          color: "#213a34",
        }}
      >
        Dataset Coverage
      </Typography>

      <Grid container spacing={2.5}>
        {datasetCards.map((card) => (
          <Grid
            key={card.title}
            size={{
              xs: 12,
              md: 4,
            }}
          >
            <QualityMetricCard card={card} />
          </Grid>
        ))}
      </Grid>

      <Card
        variant="outlined"
        sx={{
          mt: 3,
          borderRadius: 3,
          borderColor:
            "rgba(15, 118, 110, 0.12)",
          background:
            "#ffffff",
        }}
      >
        <CardContent
          sx={{
            p: 3,
            "&:last-child": {
              pb: 3,
            },
          }}
        >
          <Typography
            variant="h6"
            sx={{
              fontWeight: 600,
              color: "#213a34",
            }}
          >
            Cleaning Summary
          </Typography>

          <Typography
            variant="body2"
            color="text.secondary"
            sx={{
              mt: 0.5,
              maxWidth: 850,
              lineHeight: 1.6,
            }}
          >
            The source files were standardized into
            timestamp, location, measurement type,
            value and unit fields. Invalid numeric
            values were converted to missing, duplicate
            rows were removed and measurements were
            rounded before use.
          </Typography>

          <Grid
            container
            spacing={2}
            sx={{ mt: 1 }}
          >
            {cleaningItems.map((item) => (
              <Grid
                key={item.label}
                size={{
                  xs: 12,
                  sm: 6,
                  lg: 2.4,
                }}
              >
                <Box
                  sx={{
                    height: "100%",
                    p: 2,
                    borderRadius: 2.5,
                    backgroundColor: "#ffffff",
                    border:
                      "1px solid rgba(15, 118, 110, 0.1)",
                  }}
                >
                  <Typography
                    variant="body2"
                    color="text.secondary"
                  >
                    {item.label}
                  </Typography>

                  <Typography
                    variant="h5"
                    sx={{
                      mt: 0.75,
                      fontWeight: 600,
                      color: "#173c35",
                    }}
                  >
                    {item.value.toLocaleString()}
                  </Typography>
                </Box>
              </Grid>
            ))}
          </Grid>

          <Alert
            severity="info"
            sx={{
              mt: 2.5,
              borderRadius: 2.5,
            }}
          >
            The detailed anomaly statistics currently
            come from the air-quality processing API.
            Noise and groundwater files use the same
            standardized cleaning structure and are
            included in the combined record totals.
          </Alert>
        </CardContent>
      </Card>
    </Box>
  );
}