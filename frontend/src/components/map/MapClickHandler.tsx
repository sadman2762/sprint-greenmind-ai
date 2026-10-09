import { useRanges } from "../../context/rangeState";
import { useEffect } from "react";
import { useMap, useMapEvents } from "react-leaflet";
import { isInsideDebrecenBoundary } from "../../utils/isInsideDebrecenBoundary";
import { useSimulation } from "../../context/SimulationContext";
import type { Station } from "../../types/station";
import type { SensorTier } from "../../types/budget";

interface MapClickHandlerProps {
  stations: Station[];
  placementRadiusKm?: number | null;
  onInvalidLocation?: () => void;
  onPinAdded?: (lat: number, lng: number, tier: SensorTier) => void;
}

export default function MapClickHandler({
  stations,
  placementRadiusKm,
  onInvalidLocation,
  onPinAdded,
}: MapClickHandlerProps) {
  const { isPlacingCustomPin, addCustomPin, customPinTier } = useSimulation();
  const { setOverride } = useRanges();
  const map = useMap();

  // Change cursor when placing pin
  useEffect(() => {
    const container = map.getContainer();
    if (isPlacingCustomPin) {
      container.style.cursor = "crosshair";
    } else {
      container.style.cursor = "";
    }
  }, [isPlacingCustomPin, map]);

  useMapEvents({
    click(e) {
      if (!isPlacingCustomPin || placementRadiusKm === null) return;

      const { lat, lng } = e.latlng;

      if (!isInsideDebrecenBoundary(lat, lng)) {
        if (onInvalidLocation) {
          onInvalidLocation();
        }
        return;
      }

      const id = addCustomPin(lat, lng, stations, customPinTier);
      if (placementRadiusKm !== undefined) setOverride(`${customPinTier}:${id}`, placementRadiusKm);

      if (onPinAdded) {
        onPinAdded(lat, lng, customPinTier);
      }
    },
  });

  return null;
}
