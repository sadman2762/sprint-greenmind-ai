import type { ReactNode } from "react";
import { Box, Paper, Typography, Chip, Tooltip, IconButton } from "@mui/material";
import { InfoOutlined } from "@mui/icons-material";

export interface VitalSignCardProps {
  category: string;
  icon: ReactNode;
  statusBadge: { label: string; color: string; bg: string };
  humanValue: string;
  technicalValue: string;
  onInfoClick?: () => void;
}

export default function VitalSignCard({ category, icon, statusBadge, humanValue, technicalValue, onInfoClick }: VitalSignCardProps) {
  return (
    <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3, height: "100%", boxSizing: "border-box" }}>
      <Box sx={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 1, mb: 2 }}>
        <Box sx={{ display: "flex", color: statusBadge.color }}>{icon}</Box>
        <Typography component="h2" variant="subtitle1" sx={{ fontWeight: 700, flex: 1 }}>{category}</Typography>
        {onInfoClick && <Tooltip title="Glossary details"><IconButton aria-label={`About ${category.toLowerCase()}`} size="small" onClick={onInfoClick}><InfoOutlined fontSize="small" /></IconButton></Tooltip>}
      </Box>
      <Chip size="small" label={statusBadge.label} sx={{ bgcolor: statusBadge.bg, color: statusBadge.color }} />
      <Typography variant="h4" sx={{ my: 2, fontWeight: 700, fontSize: { xs: "1.7rem", lg: "2rem" }, fontVariantNumeric: "tabular-nums" }}>{humanValue}</Typography>
      <Typography variant="body2" color="text.secondary">{technicalValue}</Typography>
    </Paper>
  );
}
