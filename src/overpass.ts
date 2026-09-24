import type { Cafe, LatLng } from './types';
import { distanceMetres } from './geo';

const OVERPASS_ENDPOINTS = [
  'https://overpass.openstreetmap.fr/api/interpreter',
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

const SEARCH_RADIUS_M = 1500;

function buildQuery(center: LatLng): string {
  const { lat, lng } = center;
  return `
[out:json][timeout:25];
(
  node["amenity"="cafe"](around:${SEARCH_RADIUS_M},${lat},${lng});
  way["amenity"="cafe"](around:${SEARCH_RADIUS_M},${lat},${lng});
);
out center tags;
`.trim();
}

function addressFromTags(tags: Record<string, string> | undefined): string | undefined {
  if (!tags) return undefined;
  const parts = [
    tags['addr:housenumber'],
    tags['addr:street'],
    tags['addr:place'],
    tags['addr:suburb'] || tags['addr:district'],
    tags['addr:city'],
  ].filter(Boolean);
  if (parts.length > 0) return parts.join(', ');
  return tags['addr:full'] || undefined;
}

interface OverpassElement {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

interface OverpassResponse {
  elements: OverpassElement[];
}

export async function fetchNearbyCafes(center: LatLng): Promise<Cafe[]> {
  const query = buildQuery(center);
  let lastError: Error | null = null;

  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 28_000);

      const res = await fetch(endpoint, {
        method: 'POST',
        body: `data=${encodeURIComponent(query)}`,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
          Accept: 'application/json',
        },
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (!res.ok) {
        throw new Error(`Overpass HTTP ${res.status}`);
      }

      const text = await res.text();
      let data: OverpassResponse;
      try {
        data = JSON.parse(text) as OverpassResponse;
      } catch {
        throw new Error('Overpass returned non-JSON (server busy?)');
      }
      const cafes: Cafe[] = [];

      for (const el of data.elements ?? []) {
        const lat = el.lat ?? el.center?.lat;
        const lng = el.lon ?? el.center?.lon;
        if (lat == null || lng == null) continue;

        const name = el.tags?.name?.trim() || 'Unnamed café';
        const coords = { lat, lng };
        cafes.push({
          id: el.id,
          name,
          lat,
          lng,
          address: addressFromTags(el.tags),
          distanceM: distanceMetres(center, coords),
        });
      }

      cafes.sort((a, b) => a.distanceM - b.distanceM);
      return cafes;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }

  throw lastError ?? new Error('Failed to fetch cafés');
}

export { SEARCH_RADIUS_M };
