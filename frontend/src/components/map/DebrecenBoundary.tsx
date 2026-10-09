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
        weight: 1.5,
        opacity: 0.65,
        fillColor: BOUNDARY_COLOR,
        fillOpacity: 0,
      }}
    />
  );
});

export default DebrecenBoundary;