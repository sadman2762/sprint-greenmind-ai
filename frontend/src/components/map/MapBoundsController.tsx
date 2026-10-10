import { useMediaQuery } from "@mui/material";
import { useEffect, useEffectEvent, useRef } from "react";
import L from "leaflet";
import { useMap } from "react-leaflet";

import debrecenBoundary from "../../data/debrecenBoundary.json";
import type { Station } from "../../types/station";

export default function MapBoundsController({ city = "debrecen", stations, resetStations = stations, resetKey, focusLocation }: { city?: "debrecen" | "budapest"; stations: Station[]; resetStations?: Station[]; resetKey: number; focusLocation?: { lat: number; lng: number; token: number } }) {
  const map = useMap();
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const getResetStations = useEffectEvent(() => resetStations);
  const getCity = useEffectEvent(() => city);
  const previousCity = useRef<typeof city | null>(null);
  const previousReset = useRef(resetKey);
  const debrecenView = useRef<{ center: L.LatLng; zoom: number } | null>(null);

  useEffect(() => {
    const changedCity = previousCity.current !== city;
    const changedReset = previousReset.current !== resetKey;
    previousCity.current = city;
    previousReset.current = resetKey;
    if (city === "budapest") {
      if (!changedCity && !changedReset) return;
      if (changedCity && map.getCenter().lng > 20) debrecenView.current = { center: map.getCenter(), zoom: map.getZoom() };
      map.stop(); map.setMaxBounds(L.latLngBounds([])); map.setMinZoom(5);
      if (reducedMotion) map.setView([47.4979, 19.0402], 12, { animate: false });
      else map.flyTo([47.4979, 19.0402], 12, { duration: 1.6 });
      return;
    }
    const boundaryLayer = L.geoJSON(debrecenBoundary as GeoJSON.GeoJsonObject);
    const bounds = boundaryLayer.getBounds();
    if (!bounds.isValid()) return;

    if (changedCity && debrecenView.current) {
      const saved = debrecenView.current;
      map.stop(); map.setMaxBounds(L.latLngBounds([]));
      const finish = () => { map.setMaxBounds(bounds.pad(0.40)); map.setMinZoom(9); };
      if (reducedMotion) { map.setView(saved.center, saved.zoom, { animate: false }); finish(); }
      else { map.once("moveend", finish); map.flyTo(saved.center, saved.zoom, { duration: 1.6 }); }
      return () => { map.off("moveend", finish); };
    }

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
  }, [map, stations, resetKey, city, reducedMotion]);

  useEffect(() => {
    if (focusLocation && getCity() === "debrecen") {
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
