import React, { useMemo } from "react";
import { CircleMarker } from "react-leaflet";

import { cityGrid } from "../../services/gridService";
import type { Station } from "../../types/station";
import { findNearestStation } from "../../utils/nearestStation";
import type { SensorTier } from "../../types/budget";
import { getCoverageBand, isCoverageStation, type CoverageBandId } from "../../utils/mapLegend";

interface CoverageHeatmapProps {
  stations: Station[];
  category: SensorTier;
  visibleBands: readonly CoverageBandId[];
}

const CoverageHeatmap = React.memo(function CoverageHeatmap({
  stations, category, visibleBands,
}: CoverageHeatmapProps) {
  const heatmapPoints = useMemo(() => {
    const airStations = stations.filter((station) => isCoverageStation(station, category));

    if (airStations.length === 0) {
      return [];
    }

    // Benchmark distance scale for Green Sentinel physical network coverage:
    // - Full coverage: radius <= 2.0 km (Green, score >= 70, matches 2000m sensor circles)
    // - Interpolated coverage: 2.0 km < radius <= 4.0 km (Yellow, score 40 - 69)
    // - Unmonitored blind spot: radius > 4.0 km (Red, score < 40)

    return cityGrid
      .map((point) => {
        const nearest = findNearestStation(
          point.lat,
          point.lng,
          airStations,
          category,
        );

        if (nearest.distanceKm === null || !Number.isFinite(nearest.distanceKm)) {
          return null;
        }

        const band = getCoverageBand(nearest.distanceKm, category);
        if (!band || !visibleBands.includes(band.id)) return null;
        const color = band.color;
        const fillOpacity = band.opacity;

        return {
          id: point.id,
          lat: point.lat,
          lng: point.lng,
          color,
          fillOpacity,
        };
      })
      .filter((p): p is NonNullable<typeof p> => p !== null);
  }, [stations, category, visibleBands]);

  if (heatmapPoints.length === 0) {
    return null;
  }

  return (
    <>
      {heatmapPoints.map((point) => (
        <CircleMarker
          key={`heat-${point.id}`}
          center={[point.lat, point.lng]}
          radius={8}
          interactive={false}
          pathOptions={{
            color: point.color,
            fillColor: point.color,
            fillOpacity: point.fillOpacity,
            opacity: 0,
            weight: 0,
          }}
        />
      ))}
    </>
  );
});

export default CoverageHeatmap;