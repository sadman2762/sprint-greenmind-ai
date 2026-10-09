import React from "react";
import { GeoJSON } from "react-leaflet";
import boundary from "../../data/debrecenBoundary.json";
import { BOUNDARY_COLOR } from "../../utils/mapLegend";

const DebrecenBoundary = React.memo(function DebrecenBoundary() {
  return (
    <GeoJSON
      data={boundary as GeoJSON.GeoJsonObject}
      style={{
        color: BOUNDARY_COLOR,
        weight: 3,
        opacity: 1,
        fillColor: BOUNDARY_COLOR,
        fillOpacity: 0.05,
      }}
    />
  );
});

export default DebrecenBoundary;