# Coffee Nearby

A simple map app that finds cafés near you using OpenStreetMap data (Overpass API) and Leaflet — no API keys required.

## Features

- Detects your location (falls back to Central, Hong Kong)
- Lists cafés within ~1.5 km from OpenStreetMap
- Interactive map with markers synced to the list
- Search filter and “Use my location”

## Local development

```bash
npm install
npm run dev
```

Dev server defaults to http://127.0.0.1:5180

```bash
npm run build
npm run preview
```

## Hosting

GitHub Actions builds and deploys to GitHub Pages on every push to `main`.
