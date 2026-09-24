import type { LatLng, LocationState } from './types';

/** Central, Hong Kong — fallback when geolocation is denied/unavailable */
export const DEFAULT_LOCATION: LatLng = {
  lat: 22.2819,
  lng: 114.1577,
};

const GEO_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 10_000,
  maximumAge: 60_000,
};

export function getCurrentLocation(): Promise<LocationState> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve({
        coords: DEFAULT_LOCATION,
        isApproximate: true,
        source: 'default',
      });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          coords: {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          },
          isApproximate: false,
          source: 'geolocation',
        });
      },
      () => {
        resolve({
          coords: DEFAULT_LOCATION,
          isApproximate: true,
          source: 'default',
        });
      },
      GEO_OPTIONS,
    );
  });
}

/** Haversine distance in metres */
export function distanceMetres(a: LatLng, b: LatLng): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function formatDistance(metres: number): string {
  if (metres < 1000) {
    return `${Math.round(metres)} m`;
  }
  return `${(metres / 1000).toFixed(1)} km`;
}
