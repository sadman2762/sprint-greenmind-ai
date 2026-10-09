import { useEffect, useState } from "react";
import { Button, Link, Stack, Typography } from "@mui/material";

interface Address { displayName: string | null; address: Record<string, string>; }
const cache = new Map<string, Promise<Address>>();
function addressAt(lat: number, lng: number) {
  const key = `${lat.toFixed(6)},${lng.toFixed(6)}`;
  let request = cache.get(key);
  if (!request) {
    request = fetch(`/api/geocoding/reverse?lat=${lat.toFixed(6)}&lng=${lng.toFixed(6)}`).then(async response => {
      if (!response.ok) throw new Error("Address lookup unavailable");
      return response.json() as Promise<Address>;
    }).catch(error => { cache.delete(key); throw error; });
    cache.set(key, request);
  }
  return request;
}

export default function LocationAddress({ lat, lng, compact = false }: { lat: number; lng: number; compact?: boolean }) {
  return <AddressResult key={`${lat},${lng}`} lat={lat} lng={lng} compact={compact} />;
}
function AddressResult({ lat, lng, compact }: { lat: number; lng: number; compact: boolean }) {
  const [address, setAddress] = useState<Address | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let current = true;
    addressAt(lat, lng).then(value => { if (current) setAddress(value); }).catch(() => { if (current) setError(true); });
    return () => { current = false; };
  }, [lat, lng, attempt]);
  const osmLink = `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=18/${lat}/${lng}`;
  const fields = address?.address;
  const street = fields?.road ?? fields?.pedestrian ?? fields?.path ?? fields?.residential;
  const shortAddress = street ? [fields?.house_number, street].filter(Boolean).join(" ") : address?.displayName?.split(",").slice(0, 2).join(",");
  if (compact) return <Stack spacing={0.25}>
    <Typography variant="body2" sx={{ fontWeight: 600, overflowWrap: "anywhere" }} title={address?.displayName ?? undefined}>{shortAddress || (error ? "Address unavailable" : address ? "No mapped address" : "Finding street name…")}</Typography>
    <Typography variant="caption" color="text.secondary">{fields ? [fields.suburb ?? fields.neighbourhood, fields.city ?? fields.town].filter(Boolean).join(" · ") : "OpenStreetMap"}</Typography>
    {error && <Button size="small" onClick={() => { setError(false); setAttempt(attempt + 1); }}>Retry address</Button>}
  </Stack>;
  return <Stack spacing={0.5} sx={{ minWidth: 0 }}>
    <Typography variant="caption" color="text.secondary">Nearest mapped address · OpenStreetMap</Typography>
    <Typography variant="body2" sx={{ overflowWrap: "anywhere" }}>{address ? address.displayName || "No mapped street address at this location." : error ? "Address lookup unavailable. Use the pin coordinates below." : "Looking up the address…"}</Typography>
    {error && <Button size="small" onClick={() => { setError(false); setAttempt(attempt + 1); }}>Retry address lookup</Button>}
    {address && <Typography variant="caption" color="text.secondary">{address.address.house_number ? "Mapped address nearby; confirm the pin is on the intended site." : "No house number returned. This is the nearest mapped road or area."}</Typography>}
    <Link href={osmLink} target="_blank" rel="noopener noreferrer" variant="body2">Open exact pin: {lat.toFixed(6)}, {lng.toFixed(6)}</Link>
    <Typography variant="caption" color="text.secondary">© OpenStreetMap contributors</Typography>
  </Stack>;
}
