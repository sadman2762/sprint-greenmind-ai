import React from "react";
import { Circle, Marker, Tooltip } from "react-leaflet";
import MapFeatureDetails from "./MapFeatureDetails";
import { activateMapMarker, createMapMarkerIcon } from "../../utils/mapMarker";
import { useMapInspector } from "../../context/mapInspectorState";
import { Box } from "@mui/material";
import PlannedSensorDetails from "./PlannedSensorDetails";

import { useSimulation } from "../../context/SimulationContext";
import { TIER_CONFIGS, type SensorTier } from "../../types/budget";
import type { Station } from "../../types/station";
import { CATEGORY_MARKERS, isCoverageStation, type MapView } from "../../utils/mapLegend";

interface SimulatedSensorLayerProps {
  stations?: Station[];
  view?: MapView;
  showHalos?: boolean;
}

const SimulatedSensorLayer = React.memo(function SimulatedSensorLayer({ stations = [], view = "all", showHalos = true }: SimulatedSensorLayerProps) {
  const { selection, select } = useMapInspector();
  const {
    simulatedStations,
    updateStationPosition,
  } = useSimulation();

  const aiStations = simulatedStations.filter((station) => !station.isCustom && (view === "all" || isCoverageStation(station, view)));


  return (
    <>
      {aiStations.map((station) => {
        const tier = (station.sensorTier as SensorTier) || "air";
        const tierConfig = TIER_CONFIGS[tier];

        const markerColor = tierConfig ? tierConfig.color : "#0284c7";
        const fillColor = tierConfig ? tierConfig.borderColor : "#38bdf8";
        const coverageRadiusMeters = tierConfig
          ? tierConfig.radiusKm * 1000
          : 2000;

        const featureId = `simulated-${station.id}`;
        const icon = createMapMarkerIcon(CATEGORY_MARKERS[tier].color, selection?.id === featureId, 22, CATEGORY_MARKERS[tier].symbol, true, `simulated-sensor-marker-${tier}`);

        return (
          <Box key={`sim-sensor-${station.id}`} component="span">
            {/* Dynamic Coverage Halo moving with the marker */}
            {showHalos && <Circle
              center={[station.lat, station.lng]}
              radius={coverageRadiusMeters}
              pathOptions={{
                color: markerColor,
                fillColor: fillColor,
                fillOpacity: 0.08,
                opacity: 0.5,
                weight: 2,
                dashArray: "6 6",
              }}
            />}

            {/* Draggable Station Marker */}
            <Marker
              position={[station.lat, station.lng]}
              icon={icon}
              title={station.name}
              zIndexOffset={selection?.id === featureId ? 1000 : 0}
              draggable={true}
              eventHandlers={{
                keydown: activateMapMarker,
                click: (event) => select({ id: featureId, title: station.name, description: "Planned location · not an installed sensor." }, event.target.getElement()),
                dragend: (e) => {
                  const marker = e.target;
                  const pos = marker.getLatLng();
                  updateStationPosition(station.id, pos.lat, pos.lng, stations);
                },
              }}
            >
              <Tooltip>{station.name} · Simulated {tierConfig?.name ?? "air sensor"}</Tooltip>
              <MapFeatureDetails featureId={featureId}>
                <PlannedSensorDetails station={station} stations={stations} />
              </MapFeatureDetails>
            </Marker>
          </Box>
        );
      })}
    </>
  );
});

export default SimulatedSensorLayer;
