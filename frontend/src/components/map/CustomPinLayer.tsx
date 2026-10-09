import React, { useMemo } from "react";
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

interface CustomPinLayerProps {
  stations: Station[];
  view?: MapView;
  showHalos?: boolean;
}


const CustomPinLayer = React.memo(function CustomPinLayer({ stations, view = "all", showHalos = true }: CustomPinLayerProps) {
  const { selection, select } = useMapInspector();
  const {
    simulatedStations,
    updateCustomPin,
  } = useSimulation();

  const customPins = useMemo(
    () => simulatedStations.filter((station) => station.isCustom && (view === "all" || isCoverageStation(station, view))),
    [simulatedStations, view],
  );


  if (customPins.length === 0) {
    return null;
  }

  return (
    <>
      {customPins.map((station) => {
        const tier = (station.sensorTier as SensorTier) || "air";
        const tierConfig = TIER_CONFIGS[tier] || TIER_CONFIGS.air;

        const markerColor = tierConfig.color;
        const fillColor = tierConfig.borderColor;
        const radiusMeters = tierConfig.radiusKm * 1000;
        const featureId = `custom-${station.id}`;
        const icon = createMapMarkerIcon(CATEGORY_MARKERS[tier].color, selection?.id === featureId, 22, CATEGORY_MARKERS[tier].symbol, true, `custom-pin-marker-${tier}`);

        return (
          <Box key={`custom-pin-${station.id}`} component="span">
            {/* Real-time category-specific coverage halo */}
            {showHalos && <Circle
              center={[station.lat, station.lng]}
              radius={radiusMeters}
              pathOptions={{
                color: markerColor,
                fillColor: fillColor,
                fillOpacity: 0.08,
                opacity: 0.6,
                weight: 2,
                dashArray: "6 6",
              }}
            />}

            {/* Draggable Custom Sensor Marker */}
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
                  updateCustomPin(
                    station.id,
                    pos.lat,
                    pos.lng,
                    stations,
                  );
                },
              }}
            >
              <Tooltip>{station.name} · Custom {tierConfig.name}</Tooltip>
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

export default CustomPinLayer;
