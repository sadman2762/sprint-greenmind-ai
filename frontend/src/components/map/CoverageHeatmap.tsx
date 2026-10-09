import React, { useMemo } from "react";
import { Rectangle } from "react-leaflet";

import { cityGrid, GRID_STEP } from "../../services/gridService";
import type { Station } from "../../types/station";
import { useRanges } from "../../context/rangeState";
import { relativeRangeAt } from "../../utils/sensorRange";
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
  const { radii, overrides } = useRanges();
  const heatmapPoints = useMemo(() => {
    const airStations = stations.filter((station) => isCoverageStation(station, category));

    if (airStations.length === 0) {
      return [];
    }

    return cityGrid
      .map((point) => {
        const relativeDistance = relativeRangeAt(point, airStations, radii, overrides);
        const band = getCoverageBand(relativeDistance, category, 1);
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
  }, [stations, category, visibleBands, radii, overrides]);

  if (heatmapPoints.length === 0) {
    return null;
  }

  return (
    <>
      {heatmapPoints.map((point) => (
        <Rectangle
          key={`heat-${point.id}`}
          bounds={[[point.lat - GRID_STEP / 2, point.lng - GRID_STEP / 2], [point.lat + GRID_STEP / 2, point.lng + GRID_STEP / 2]]}
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