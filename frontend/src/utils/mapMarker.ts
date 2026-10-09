import L, { type LeafletKeyboardEvent } from "leaflet";
import type { MarkerSymbol } from "./mapLegend";

export function activateMapMarker(event: LeafletKeyboardEvent) {
  if (event.originalEvent.key !== "Enter" && event.originalEvent.key !== " ") return;
  event.originalEvent.preventDefault();
  event.originalEvent.stopPropagation();
  event.target.fire("click");
}

export function createMapMarkerIcon(color: string, selected: boolean, size = 18, symbol: MarkerSymbol = "dot", planned = false, className = "") {
  const radius = symbol === "dot" ? "50%" : "15%";
  return L.divIcon({
    className: `greenmind-map-marker ${className}${selected ? " is-selected" : ""}`,
    html: `<span class="map-marker-symbol" data-shape="${symbol}" data-planned="${planned}" style="display:block;box-sizing:border-box;width:100%;height:100%;border:2px solid ${color};border-radius:${radius};background:${planned ? "transparent" : color};transform:${symbol === "diamond" ? "rotate(45deg)" : "none"}"></span>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}
