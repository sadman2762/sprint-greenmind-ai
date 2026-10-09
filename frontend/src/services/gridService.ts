import { isInsideDebrecenBoundary } from "../utils/isInsideDebrecenBoundary";

export interface GridPoint {
  id: number;
  lat: number;
  lng: number;
}

/*
 * Bounding box of the Debrecen GeoJSON boundary.
 */
const MIN_LAT = 47.39058;
const MAX_LAT = 47.73228;
const MIN_LNG = 21.41611;
const MAX_LNG = 21.86276;

/*
 * Sample the distance layer at 0.007-degree intervals.
 * Rendering uses geographic cells so coverage does not change size with zoom.
 */
export const GRID_STEP = 0.007;

function generateCityGrid(): GridPoint[] {
  const points: GridPoint[] = [];
  let id = 1;

  for (
    let lat = MIN_LAT;
    lat <= MAX_LAT + 1e-9;
    lat += GRID_STEP
  ) {
    for (
      let lng = MIN_LNG;
      lng <= MAX_LNG + 1e-9;
      lng += GRID_STEP
    ) {
      const pLat = Number(lat.toFixed(6));
      const pLng = Number(lng.toFixed(6));

      // Pre-filter boundary at initialization time so render cycles never recalculate polygon raycasting
      if (isInsideDebrecenBoundary(pLat, pLng)) {
        points.push({
          id,
          lat: pLat,
          lng: pLng,
        });
        id += 1;
      }
    }
  }

  return points;
}

export const cityGrid = generateCityGrid();