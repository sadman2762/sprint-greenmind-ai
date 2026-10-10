import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { useMediaQuery } from "@mui/material";
import { Circle } from "react-leaflet";
import L from "leaflet";

/** Only animates the outline of a returned proposal; coverage metrics stay authoritative. */
export default function AnimatedCoverage({ lat, lng, radiusKm, children }: { lat: number; lng: number; radiusKm: number; children: ReactNode }) {
  const circle = useRef<L.Circle>(null);
  const renderer = useMemo(() => L.svg({ padding: 0.5 }), []);
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  useEffect(() => {
    const target = radiusKm * 1000;
    const layer = circle.current;
    if (reducedMotion) { layer?.setRadius(target); return; }
    let frame = 0;
    let start: number | undefined;
    const animate = (time: number) => {
      start ??= time;
      const progress = Math.min((time - start) / 850, 1);
      layer?.setRadius(target * (1 - Math.pow(1 - progress, 3)));
      if (progress < 1) frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => { cancelAnimationFrame(frame); layer?.setRadius(target); };
  }, [lat, lng, radiusKm, reducedMotion]);
  return <Circle ref={circle} center={[lat, lng]} radius={radiusKm * 1000} renderer={renderer} interactive={false}
    pathOptions={{ color: "#7961b4", weight: 1.5, fillColor: "#947ac8", fillOpacity: 0.1, className: "proposal-coverage" }}>{children}</Circle>;
}
