import { useMediaQuery } from "@mui/material";
import { useEffect, useEffectEvent } from "react";
import L from "leaflet";
import { useMap } from "react-leaflet";

import debrecenBoundary from "../../data/debrecenBoundary.json";
import type { Station } from "../../types/station";

export default function MapBoundsController({ stations, resetStations = stations, resetKey, focusLocation }: { stations: Station[]; resetStations?: Station[]; resetKey: number; focusLocation?: { lat: number; lng: number; token: number } }) {
  const map = useMap();
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const getResetStations = useEffectEvent(() => resetStations);

  useEffect(() => {
    const boundaryLayer = L.geoJSON(debrecenBoundary as GeoJSON.GeoJsonObject);
    const bounds = boundaryLayer.getBounds();
    if (!bounds.isValid()) return;

    // Provide ample buffer (40%) beyond Debrecen city limits so Leaflet auto-pan
    // can smoothly reposition popups without hitting a hard boundary ceiling
    map.setMaxBounds(bounds.pad(0.40));

    const coordinates = (resetKey ? getResetStations() : stations)
      .filter((station) => Number.isFinite(station.lat) && Number.isFinite(station.lng))
      .map((station): [number, number] => [station.lat, station.lng]);
    const stationBounds = L.latLngBounds(coordinates);
    map.fitBounds(stationBounds.isValid() ? stationBounds : bounds, {
      padding: [40, 40],
      maxZoom: 13,
      animate: false,
    });
  }, [map, stations, resetKey]);

  useEffect(() => {
    if (focusLocation) {
      map.stop();
      if (reducedMotion) map.setView([focusLocation.lat, focusLocation.lng], 14, { animate: false });
      else map.flyTo([focusLocation.lat, focusLocation.lng], 14, { duration: 0.85 });
    }
  }, [map, focusLocation, reducedMotion]);

  useEffect(() => {
    let frame = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => map.invalidateSize({ animate: false, pan: true, debounceMoveend: true }));
    });
    observer.observe(map.getContainer());
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [map]);

  return null;
}
