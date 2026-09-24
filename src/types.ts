export interface LatLng {
  lat: number;
  lng: number;
}

export interface Cafe {
  id: number;
  name: string;
  lat: number;
  lng: number;
  address?: string;
  distanceM: number;
}

export interface LocationState {
  coords: LatLng;
  isApproximate: boolean;
  source: 'geolocation' | 'default';
}
