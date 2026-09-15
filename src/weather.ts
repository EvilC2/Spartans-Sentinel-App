// Sentinel — live weather for the hero card, from Open-Meteo (no API key).
// Location is the school: 1250 Chartwell Drive, West Vancouver.
// Refreshes every 15 minutes while a screen using it is mounted.

import { useEffect, useState } from 'react';
import type { IconName } from './components/Icon';

const LAT = 49.3396, LON = -123.1519;
const URL =
  `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}` +
  `&current=temperature_2m,weather_code,is_day&timezone=America%2FVancouver`;

export type Weather = { temp: number; code: number; isDay: boolean; at: Date };

let cache: Weather | null = null;

export const useWeather = () => {
  const [w, setW] = useState<Weather | null>(cache);
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const r = await fetch(URL);
        const j = await r.json();
        const cur = j?.current;
        if (!alive || !cur) return;
        cache = { temp: Number(cur.temperature_2m), code: Number(cur.weather_code), isDay: cur.is_day === 1, at: new Date() };
        setW(cache);
      } catch { /* offline — keep whatever we had */ }
    };
    if (!cache || Date.now() - cache.at.getTime() > 15 * 60_000) load();
    const id = setInterval(load, 15 * 60_000);
    return () => { alive = false; clearInterval(id); };
  }, []);
  return w;
};

// WMO weather code → icon + short label.
export const describeWeather = (code: number, isDay: boolean): { icon: IconName; label: string } => {
  if (code === 0) return { icon: isDay ? 'sun' : 'moon', label: 'Clear' };
  if (code <= 2) return { icon: isDay ? 'cloud-sun' : 'cloud', label: 'Partly cloudy' };
  if (code === 3) return { icon: 'cloud', label: 'Overcast' };
  if (code === 45 || code === 48) return { icon: 'fog', label: 'Fog' };
  if (code >= 51 && code <= 57) return { icon: 'drizzle', label: 'Drizzle' };
  if (code >= 61 && code <= 67) return { icon: 'rain', label: 'Rain' };
  if (code >= 71 && code <= 77) return { icon: 'snow', label: 'Snow' };
  if (code >= 80 && code <= 82) return { icon: 'rain', label: 'Showers' };
  if (code >= 85 && code <= 86) return { icon: 'snow', label: 'Snow showers' };
  if (code >= 95) return { icon: 'storm', label: 'Thunderstorm' };
  return { icon: 'cloud', label: 'Cloudy' };
};
