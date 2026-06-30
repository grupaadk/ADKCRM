"use client";

import { useEffect, useState } from "react";

// Mińsk Mazowiecki, ul. Siennicka
const ORIGIN_LAT = 52.1765;
const ORIGIN_LON = 21.5594;

type Status = "idle" | "loading" | "done" | "error";

async function geocodeCity(city: string): Promise<{ lat: number; lon: number } | null> {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(city + ", Polska")}&format=json&limit=1`;
  const res = await fetch(url, { headers: { "Accept-Language": "pl" } });
  const data = await res.json() as { lat: string; lon: string }[];
  if (!data[0]) return null;
  return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
}

async function getDrivingDistance(toLat: number, toLon: number): Promise<number | null> {
  const url = `https://router.project-osrm.org/route/v1/driving/${ORIGIN_LON},${ORIGIN_LAT};${toLon},${toLat}?overview=false`;
  const res = await fetch(url);
  const data = await res.json() as { routes?: { distance: number }[] };
  if (!data.routes?.[0]) return null;
  return Math.round(data.routes[0].distance / 1000);
}

export default function CityDistance({ city }: { city: string }) {
  const [km, setKm] = useState<number | null>(null);
  const [status, setStatus] = useState<Status>("idle");

  useEffect(() => {
    if (!city.trim()) return;
    setTimeout(() => {
      setStatus("loading");
      setKm(null);
    }, 0);

    let cancelled = false;

    (async () => {
      try {
        const coords = await geocodeCity(city);
        if (cancelled || !coords) { setStatus("error"); return; }
        const distance = await getDrivingDistance(coords.lat, coords.lon);
        if (cancelled) return;
        if (distance === null) { setStatus("error"); return; }
        setKm(distance);
        setStatus("done");
      } catch {
        if (!cancelled) setStatus("error");
      }
    })();

    return () => { cancelled = true; };
  }, [city]);

  if (status === "idle") return null;

  if (status === "loading") {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-slate-400">
        <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
        km...
      </span>
    );
  }

  if (status === "error") {
    return <span className="text-xs text-slate-400">— km</span>;
  }

  return (
    <span className="inline-flex items-center gap-1 text-xs text-slate-500">
      <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
      </svg>
      {km} km od Mińska
    </span>
  );
}
