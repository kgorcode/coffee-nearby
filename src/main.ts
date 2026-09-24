import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './style.css';
import { getCurrentLocation, formatDistance, DEFAULT_LOCATION } from './geo';
import { fetchNearbyCafes, SEARCH_RADIUS_M } from './overpass';
import type { Cafe, LocationState } from './types';

// Fix default Leaflet marker icons under Vite bundling
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

const userIcon = L.divIcon({
  className: 'user-marker',
  html: '<span class="user-marker-dot"></span>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

const cafeIcon = L.divIcon({
  className: 'cafe-marker',
  html: '<span class="cafe-marker-pin">☕</span>',
  iconSize: [32, 32],
  iconAnchor: [16, 28],
  popupAnchor: [0, -24],
});

const cafeIconSelected = L.divIcon({
  className: 'cafe-marker cafe-marker--selected',
  html: '<span class="cafe-marker-pin">☕</span>',
  iconSize: [36, 36],
  iconAnchor: [18, 32],
  popupAnchor: [0, -28],
});

const app = document.querySelector<HTMLDivElement>('#app')!;

app.innerHTML = `
  <div class="shell">
    <header class="topbar">
      <div class="brand">
        <span class="brand-mark" aria-hidden="true">☕</span>
        <div>
          <h1>Coffee Nearby</h1>
          <p class="tagline">Cafés within ~${(SEARCH_RADIUS_M / 1000).toFixed(1)} km</p>
        </div>
      </div>
      <button type="button" class="btn btn-primary" id="locate-btn" title="Use my location">
        <span class="btn-icon" aria-hidden="true">📍</span>
        Use my location
      </button>
    </header>

    <p class="banner banner--info" id="approx-banner" hidden>
      Location approximate — showing Central, Hong Kong. Allow location access or tap “Use my location” for results near you.
    </p>

    <div class="layout">
      <aside class="panel">
        <div class="search-row">
          <label class="sr-only" for="search">Search cafés</label>
          <input
            type="search"
            id="search"
            class="search"
            placeholder="Search by name or address…"
            autocomplete="off"
          />
        </div>
        <div class="status" id="status" role="status">Finding your location…</div>
        <ul class="cafe-list" id="cafe-list"></ul>
      </aside>
      <main class="map-wrap">
        <div id="map" role="application" aria-label="Map of nearby cafés"></div>
      </main>
    </div>
  </div>
`;

const statusEl = document.querySelector<HTMLElement>('#status')!;
const listEl = document.querySelector<HTMLUListElement>('#cafe-list')!;
const searchEl = document.querySelector<HTMLInputElement>('#search')!;
const locateBtn = document.querySelector<HTMLButtonElement>('#locate-btn')!;
const approxBanner = document.querySelector<HTMLElement>('#approx-banner')!;

let locationState: LocationState = {
  coords: DEFAULT_LOCATION,
  isApproximate: true,
  source: 'default',
};
let cafes: Cafe[] = [];
let selectedId: number | null = null;
let filterQuery = '';

const map = L.map('map', {
  zoomControl: false,
  attributionControl: true,
}).setView([DEFAULT_LOCATION.lat, DEFAULT_LOCATION.lng], 15);

L.control.zoom({ position: 'topright' }).addTo(map);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
}).addTo(map);

const markersLayer = L.layerGroup().addTo(map);
let userMarker: L.Marker | null = null;
const markerById = new Map<number, L.Marker>();

function setStatus(message: string, kind: 'info' | 'error' | 'empty' = 'info') {
  statusEl.textContent = message;
  statusEl.dataset.kind = kind;
  statusEl.hidden = !message;
}

function updateApproxBanner() {
  approxBanner.hidden = !locationState.isApproximate;
}

function filteredCafes(): Cafe[] {
  const q = filterQuery.trim().toLowerCase();
  if (!q) return cafes;
  return cafes.filter(
    (c) =>
      c.name.toLowerCase().includes(q) ||
      (c.address?.toLowerCase().includes(q) ?? false),
  );
}

function selectCafe(id: number | null, fromList = false) {
  selectedId = id;

  for (const [cafeId, marker] of markerById) {
    marker.setIcon(cafeId === id ? cafeIconSelected : cafeIcon);
  }

  listEl.querySelectorAll<HTMLElement>('.cafe-item').forEach((el) => {
    const match = Number(el.dataset.id) === id;
    el.classList.toggle('is-selected', match);
    if (match && fromList) {
      el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  });

  if (id != null) {
    const cafe = cafes.find((c) => c.id === id);
    const marker = markerById.get(id);
    if (cafe && marker) {
      map.panTo([cafe.lat, cafe.lng], { animate: true });
      if (fromList) marker.openPopup();
    }
  }
}

function renderList() {
  const items = filteredCafes();
  listEl.innerHTML = '';

  if (cafes.length === 0) {
    return;
  }

  if (items.length === 0) {
    setStatus('No cafés match your search.', 'empty');
    return;
  }

  setStatus(
    `${items.length} café${items.length === 1 ? '' : 's'} nearby`,
    'info',
  );

  const frag = document.createDocumentFragment();
  for (const cafe of items) {
    const li = document.createElement('li');
    li.className = 'cafe-item' + (cafe.id === selectedId ? ' is-selected' : '');
    li.dataset.id = String(cafe.id);
    li.tabIndex = 0;
    li.setAttribute('role', 'button');
    li.innerHTML = `
      <div class="cafe-item-top">
        <span class="cafe-name">${escapeHtml(cafe.name)}</span>
        <span class="cafe-dist">${formatDistance(cafe.distanceM)}</span>
      </div>
      ${
        cafe.address
          ? `<p class="cafe-addr">${escapeHtml(cafe.address)}</p>`
          : `<p class="cafe-addr cafe-addr--muted">Address unavailable</p>`
      }
    `;
    li.addEventListener('click', () => selectCafe(cafe.id, true));
    li.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        selectCafe(cafe.id, true);
      }
    });
    frag.appendChild(li);
  }
  listEl.appendChild(frag);
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderMarkers() {
  markersLayer.clearLayers();
  markerById.clear();

  for (const cafe of cafes) {
    const marker = L.marker([cafe.lat, cafe.lng], {
      icon: cafe.id === selectedId ? cafeIconSelected : cafeIcon,
      title: cafe.name,
    });
    marker.bindPopup(
      `<strong>${escapeHtml(cafe.name)}</strong><br/>
       <span>${formatDistance(cafe.distanceM)}</span>
       ${cafe.address ? `<br/><span class="popup-addr">${escapeHtml(cafe.address)}</span>` : ''}`,
    );
    marker.on('click', () => {
      selectCafe(cafe.id, false);
      const el = listEl.querySelector<HTMLElement>(`[data-id="${cafe.id}"]`);
      el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    });
    marker.addTo(markersLayer);
    markerById.set(cafe.id, marker);
  }
}

function placeUserMarker() {
  const { lat, lng } = locationState.coords;
  if (userMarker) {
    userMarker.setLatLng([lat, lng]);
  } else {
    userMarker = L.marker([lat, lng], {
      icon: userIcon,
      zIndexOffset: 1000,
      title: 'Your location',
    }).addTo(map);
    userMarker.bindPopup(
      locationState.isApproximate
        ? 'Approximate location (Central, Hong Kong)'
        : 'You are here',
    );
  }
}

async function loadCafes() {
  const { lat, lng } = locationState.coords;
  placeUserMarker();
  map.setView([lat, lng], 15);

  setStatus('Looking for cafés…', 'info');
  listEl.innerHTML = '';
  selectedId = null;
  cafes = [];
  markersLayer.clearLayers();
  markerById.clear();
  locateBtn.disabled = true;

  try {
    cafes = await fetchNearbyCafes(locationState.coords);
    if (cafes.length === 0) {
      setStatus('No cafés found within 1.5 km. Try another location.', 'empty');
    } else {
      renderMarkers();
      renderList();
    }
  } catch {
    setStatus('', 'info');
    listEl.innerHTML = `
      <li class="error-card">
        <p>Couldn’t load cafés from OpenStreetMap right now.</p>
        <button type="button" class="btn btn-secondary" id="retry-btn">Try again</button>
      </li>
    `;
    document.querySelector('#retry-btn')?.addEventListener('click', () => {
      void loadCafes();
    });
  } finally {
    locateBtn.disabled = false;
  }
}

async function locateAndLoad(preferGeo: boolean) {
  setStatus(
    preferGeo ? 'Requesting your location…' : 'Finding your location…',
    'info',
  );
  locationState = await getCurrentLocation();
  updateApproxBanner();
  await loadCafes();
}

searchEl.addEventListener('input', () => {
  filterQuery = searchEl.value;
  renderList();
});

locateBtn.addEventListener('click', () => {
  void locateAndLoad(true);
});

// Initial load — uses geolocation when available, else Central HK
void locateAndLoad(false);

// Leaflet needs a resize after layout settles (esp. mobile flex)
requestAnimationFrame(() => {
  map.invalidateSize();
});
window.addEventListener('resize', () => map.invalidateSize());
