import { Alert, Box, Table, TableBody, TableCell, TableHead, TableRow, Typography } from "@mui/material";
import type { JointPlan } from "../../services/jointPlanService";

export default function MethodComparison({ plan }: { plan: JointPlan }) {
  const original = plan.originalPlan;
  const joint = plan.jointPlan;
  const comparable = original.status === "available" && original.stations.length === joint.stations.length && original.metrics;
  const difference = original.metrics ? joint.metrics.addedKm2 - original.metrics.addedKm2 : null;
  const cellArea = plan.studyArea.areaKm2 / plan.studyArea.gridPoints;
  if (plan.planningCategory === "noise") return <Box>
    <Typography component="h2" variant="h6">Independent versus joint noise plan</Typography>
    <Typography variant="body2" sx={{ mt: 1 }}>For {joint.stations.length} noise sensors, choosing from the initial ranking adds {plan.independentPlan.metrics.addedKm2.toFixed(2)} km². Recalculating after each selection adds {joint.metrics.addedKm2.toFixed(2)} km².</Typography>
    <Typography variant="caption" color="text.secondary">Same noise sites, study area and 1 km reach. The original repository has no equivalent noise-placement mode; this is an independent-ranking control.</Typography>
  </Box>;
  return <Box component="section" aria-label="Method results on the same area">
    <Typography component="h2" variant="h6">Same starting network. Two plans.</Typography>
    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>Both methods recalculate after each placement. We measure their results on the same study area, with the same 2 km reach.</Typography>
    <Table size="small" aria-label="Original and Joint results" sx={{ my: 1.5 }}>
      <TableHead><TableRow><TableCell>Result</TableCell><TableCell align="right">Original</TableCell><TableCell align="right">Joint</TableCell></TableRow></TableHead>
      <TableBody>
        <TableRow><TableCell>New sensors</TableCell><TableCell align="right">{original.stations.length}</TableCell><TableCell align="right">{joint.stations.length}</TableCell></TableRow>
        <TableRow><TableCell>Extra area</TableCell><TableCell align="right">{original.metrics ? `${original.metrics.addedKm2.toFixed(2)} km²` : "Unavailable"}</TableCell><TableCell align="right">{joint.metrics.addedKm2.toFixed(2)} km²</TableCell></TableRow>
        <TableRow><TableCell>Total coverage</TableCell><TableCell align="right">{original.metrics ? `${original.metrics.coveragePercent.toFixed(1)}%` : "Unavailable"}</TableCell><TableCell align="right">{joint.metrics.coveragePercent.toFixed(1)}%</TableCell></TableRow>
      </TableBody>
    </Table>
    {!comparable ? <Alert severity="warning">An equal-count comparison is unavailable. Review the Original status below.</Alert> : <Typography variant="body2" sx={{ fontWeight: 600 }}>{Math.abs(difference!) < cellArea ? "Nearly the same area: the difference is smaller than one study-grid cell. This does not establish a meaningful coverage advantage." : `Joint reaches ${Math.abs(difference!).toFixed(2)} km² ${difference! > 0 ? "more" : "less"} additional area with the same number of sensors.`}</Typography>}
    <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>Different siting rules and objectives can produce different locations. This comparison alone does not prove one method is universally better.</Typography>
  </Box>;
}
