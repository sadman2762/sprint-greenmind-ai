import { CATEGORY_MARKERS } from "./mapLegend.ts";
import type { SensorTier } from "../types/budget.ts";
import type { Station } from "../types/station.ts";
import { scenarioDistanceKm } from "./sensorRange.ts";

export interface NetworkNode {
  id: string; name: string; lat: number; lng: number;
  category: SensorTier | "transit";
  radiusKm?: number; station?: Station;
  activity?: number; passengerActivity?: number;
  source: string;
}
export interface NetworkRelation {
  target: NetworkNode; distanceKm: number;
  kind: "shared-zone" | "nearby-sensor" | "nearby-transit";
  title: string; explanation: string;
  overlapKm2?: number;
}
export function circleOverlapKm2(r1: number, r2: number, distance: number) {
  if (distance >= r1 + r2) return 0;
  if (distance <= Math.abs(r1 - r2)) return Math.PI * Math.min(r1, r2) ** 2;
  const angle = (a: number, b: number) => Math.acos(Math.max(-1, Math.min(1, (distance ** 2 + a ** 2 - b ** 2) / (2 * distance * a))));
  return r1 ** 2 * angle(r1, r2) + r2 ** 2 * angle(r2, r1) - 0.5 * Math.sqrt(Math.max(0, (-distance + r1 + r2) * (distance + r1 - r2) * (distance - r1 + r2) * (distance + r1 + r2)));
}
export function networkRelations(source: NetworkNode, nodes: NetworkNode[], proximityKm: number): NetworkRelation[] {
  return nodes.filter(node => node.id !== source.id && Number.isFinite(node.lat) && Number.isFinite(node.lng)).flatMap(target => {
    const distanceKm = scenarioDistanceKm(source, target);
    if (source.category === "transit" && target.category === "transit") return [];
    const transit = source.category === "transit" || target.category === "transit";
    const overlapKm2 = !transit && source.category === target.category ? circleOverlapKm2(source.radiusKm ?? 0, target.radiusKm ?? 0, distanceKm) : 0;
    if (distanceKm > proximityKm && overlapKm2 <= 0) return [];
    const kind = transit ? "nearby-transit" : overlapKm2 > 0 ? "shared-zone" : "nearby-sensor";
    return [{ target, distanceKm, kind,
      title: transit ? "Near a DKV stop" : overlapKm2 > 0 ? "Scenario zones overlap" : "Nearby sensor",
      explanation: transit ? "Spatial proximity to a mapped DKV stop. Recorded passenger activity is context, not measured emissions or proof that this stop caused a reading. DKV does not influence placement ranking yet."
        : overlapKm2 > 0 ? `${overlapKm2.toFixed(2)} km² of the configured circles intersect before clipping to the study boundary. This does not prove duplicate measurements${source.category === "water" ? " or a shared water body" : ""}.`
        : source.category !== target.category ? "Different measurement categories at nearby locations. Neither sensor substitutes for the other; proximity does not establish a causal relationship."
        : "Same measurement category within the selected search distance. Their configured circles do not overlap.",
      ...(overlapKm2 > 0 ? { overlapKm2 } : {}),
    } satisfies NetworkRelation];
  }).sort((a, b) => a.distanceKm - b.distanceKm || a.target.id.localeCompare(b.target.id));
}

export const networkColor = (node: NetworkNode) => node.category === "transit" ? "#b45309" : CATEGORY_MARKERS[node.category].color;
