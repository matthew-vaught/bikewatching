// -------------------------------
// Imports
// -------------------------------
import mapboxgl from 'https://cdn.jsdelivr.net/npm/mapbox-gl@2.15.0/+esm';
import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';

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
// Helper function to project coordinates
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
  console.log('Map fully loaded.');

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
  const stationUrl = 'https://dsc106.com/labs/lab07/data/bluebikes-stations.json';
  let jsonData;

  try {
    jsonData = await d3.json(stationUrl);
    console.log('Loaded JSON Data:', jsonData);
  } catch (error) {
    console.error('Error loading JSON:', error);
    return;
  }

  let stations = jsonData.data.stations;

  // -------------------------------
  // Step 4.1: Import + parse traffic data
  // -------------------------------
  const tripUrl = 'https://dsc106.com/labs/lab07/data/bluebikes-traffic-2024-03.csv';
  let trips;

  try {
    trips = await d3.csv(tripUrl);
    console.log('Loaded trip data:', trips.length);
  } catch (error) {
    console.error('Error loading CSV:', error);
    return;
  }

  // -------------------------------
  // Step 4.2: Calculate arrivals + departures
  // -------------------------------
  const departures = d3.rollup(
    trips,
    (v) => v.length,
    (d) => d.start_station_id
  );

  const arrivals = d3.rollup(
    trips,
    (v) => v.length,
    (d) => d.end_station_id
  );

  // Add totals to each station
  stations = stations.map((station) => {
    const id = station.short_name;
    station.departures = departures.get(id) ?? 0;
    station.arrivals = arrivals.get(id) ?? 0;
    station.totalTraffic = station.departures + station.arrivals;
    return station;
  });

  console.log('Stations with traffic data:', stations);

  // -------------------------------
  // Step 4.3: Size markers according to traffic
  // -------------------------------
  const radiusScale = d3
    .scaleSqrt()
    .domain([0, d3.max(stations, (d) => d.totalTraffic)])
    .range([0, 25]);

  // -------------------------------
  // Step 4.4: Append circles + tooltips
  // -------------------------------
  const circles = svg
    .selectAll('circle')
    .data(stations)
    .enter()
    .append('circle')
    .attr('r', (d) => radiusScale(d.totalTraffic))
    .attr('fill', 'steelblue')
    .attr('stroke', 'white')
    .attr('stroke-width', 1)
    .attr('fill-opacity', 0.6)
    .each(function (d) {
      d3.select(this)
        .append('title')
        .text(
          `${d.totalTraffic} trips (${d.departures} departures, ${d.arrivals} arrivals)`
        );
    });

  // Position + updates
  function updatePositions() {
    circles
      .attr('cx', (d) => getCoords(d).cx)
      .attr('cy', (d) => getCoords(d).cy);
  }

  updatePositions();

  map.on('move', updatePositions);
  map.on('zoom', updatePositions);
  map.on('resize', updatePositions);
  map.on('moveend', updatePositions);
});