// Import Mapbox as an ESM module
import mapboxgl from 'https://cdn.jsdelivr.net/npm/mapbox-gl@2.15.0/+esm';

// Set your Mapbox access token
mapboxgl.accessToken = 'pk.YOUR_ACTUAL_MAPBOX_ACCESS_TOKEN_HERE';

// Initialize the map
const map = new mapboxgl.Map({
  container: 'map', // ID of the div in index.html
  style: 'mapbox://styles/mapbox/streets-v12', // basemap style
  center: [-71.09415, 42.36027], // [longitude, latitude] — centered on Boston
  zoom: 12,
  minZoom: 5,
  maxZoom: 18,
});

// Wait for the map to fully load before adding data
map.on('load', async () => {
  console.log('Map is fully loaded.');

  // -------------------------------
  // Boston bike lanes
  // -------------------------------
  map.addSource('boston_route', {
    type: 'geojson',
    data: 'https://bostonopendata-boston.opendata.arcgis.com/datasets/boston::existing-bike-network-2022.geojson',
  });

  map.addLayer({
    id: 'boston-bike-lanes',
    type: 'line',
    source: 'boston_route',
    paint: {
      'line-color': '#32D400', // bright green
      'line-width': 5,
      'line-opacity': 0.6,
    },
  });

  // -------------------------------
  // Cambridge bike lanes
  // -------------------------------
  map.addSource('cambridge_route', {
    type: 'geojson',
    data: 'https://cambridgegisdata-openhubcambridgegis.hub.arcgis.com/datasets/CambridgeGIS::bike-lanes.geojson',
  });

  map.addLayer({
    id: 'cambridge-bike-lanes',
    type: 'line',
    source: 'cambridge_route',
    paint: {
      'line-color': '#32D400', // same styling for consistency
      'line-width': 5,
      'line-opacity': 0.6,
    },
  });
});