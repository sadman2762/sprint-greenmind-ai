import { Box, Button, Paper, Typography } from "@mui/material";
import { useAppTheme } from "../../context/ThemeContext";

interface CitizenHealthHeroProps {
  healthScore: number | null;
  loading: boolean;
  onOpenGlossary: () => void;
}

export default function CitizenHealthHero({ healthScore, loading, onOpenGlossary }: CitizenHealthHeroProps) {
  const { tokens } = useAppTheme();
  return (
    <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 }, mb: 3, borderRadius: 3, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 3 }}>
      <Box sx={{ flex: "1 1 260px" }}>
        <Typography variant="overline" color="text.secondary">Green Sentinel · Debrecen</Typography>
        <Typography component="h1" variant="h5" sx={{ fontWeight: 700 }}>Environmental overview</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1, maxWidth: 600 }}>
          Explore station readings and district estimates. Dataset summaries describe the available records; they are not a live citywide health assessment.
        </Typography>
        <Button size="small" onClick={onOpenGlossary} sx={{ mt: 1 }}>Understand these indicators</Button>
      </Box>
      <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
        <Box aria-label={healthScore === null ? "Model index unavailable" : `Model index ${healthScore} out of 100`} sx={{
          width: 68, height: 68, borderRadius: "50%", p: "5px", display: "grid", placeItems: "center",
          background: `conic-gradient(#38785b 0% ${healthScore ?? 0}%, ${tokens.cardBorder} ${healthScore ?? 0}% 100%)`,
        }}>
          <Box sx={{ width: "100%", height: "100%", borderRadius: "50%", bgcolor: "background.paper", display: "grid", placeItems: "center" }}>
            <Typography variant="h6">{healthScore === null ? "—" : Math.round(healthScore)}</Typography>
          </Box>
        </Box>
        <Box sx={{ maxWidth: 190 }}>
          <Typography variant="subtitle2">{loading ? "Loading indicators…" : "Model index / 100"}</Typography>
          <Typography variant="caption" color="text.secondary">Heuristic score with assumed inputs. Not a safety rating.</Typography>
        </Box>
      </Box>
    </Paper>
  );
}
