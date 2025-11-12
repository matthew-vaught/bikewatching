// -------------------------------
// Imports
// -------------------------------
import mapboxgl from 'https://cdn.jsdelivr.net/npm/mapbox-gl@2.15.0/+esm';
import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';  // ✅ new D3 import

// -------------------------------
// Map setup
// -------------------------------
mapboxgl.accessToken = 'pk.eyJ1IjoibWF2YXVnaHQiLCJhIjoiY21odmRuczBxMDlmdDJzb2lhd28zMmw5biJ9.7wXMZcRbL0fCttvhk_3FyA';

const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/streets-v12',
  center: [-71.09415, 42.36027], // Boston
  zoom: 12,
  minZoom: 5,
  maxZoom: 18,
});

// -------------------------------
// Helper function to convert lon/lat → pixel coordinates
// -------------------------------
function getCoords(station) {
  const point = new mapboxgl.LngLat(+station.Long, +station.Lat);
  const { x, y } = map.project(point);
  return { cx: x, cy: y };
}

// -------------------------------
// Map load event
// -------------------------------
map.on('load', async () => {
  console.log('Map is fully loaded.');

  // Boston bike lanes
  map.addSource('boston_route', {
    type: 'geojson',
    data: 'https://bostonopendata-boston.opendata.arcgis.com/datasets/boston::existing-bike-network-2022.geojson',
  });

  map.addLayer({
    id: 'boston-bike-lanes',
    type: 'line',
    source: 'boston_route',
    paint: {
      'line-color': '#32D400',
      'line-width': 5,
      'line-opacity': 0.6,
    },
  });

  // Cambridge bike lanes
  map.addSource('cambridge_route', {
    type: 'geojson',
    data: 'https://cambridgegisdata-openhubcambridgegis.hub.arcgis.com/datasets/CambridgeGIS::bike-lanes.geojson',
  });

  map.addLayer({
    id: 'cambridge-bike-lanes',
    type: 'line',
    source: 'cambridge_route',
    paint: {
      'line-color': '#32D400',
      'line-width': 5,
      'line-opacity': 0.6,
    },
  });

  // -------------------------------
  // Step 3: Bluebikes stations
  // -------------------------------
  const svg = d3.select('#map').select('svg');

  // Load JSON data
  const jsonUrl = 'https://dsc106.com/labs/lab07/data/bluebikes-stations.json';
  let jsonData;

  try {
    jsonData = await d3.json(jsonUrl);
    console.log('Loaded JSON Data:', jsonData);
  } catch (error) {
    console.error('Error loading JSON:', error);
    return;
  }

  // Access the array of stations
  const stations = jsonData.data.stations;
  console.log('Stations Array:', stations);

  // Append circles for each station
  const circles = svg
    .selectAll('circle')
    .data(stations)
    .enter()
    .append('circle')
    .attr('r', 5)
    .attr('fill', 'steelblue')
    .attr('stroke', 'white')
    .attr('stroke-width', 1)
    .attr('opacity', 0.8);

  // Function to update circle positions
  function updatePositions() {
    circles
      .attr('cx', (d) => getCoords(d).cx)
      .attr('cy', (d) => getCoords(d).cy);
  }

  // Set initial positions
  updatePositions();

  // Keep markers aligned when map moves/zooms/resizes
  map.on('move', updatePositions);
  map.on('zoom', updatePositions);
  map.on('resize', updatePositions);
  map.on('moveend', updatePositions);
});