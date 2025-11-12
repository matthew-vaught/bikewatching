// -------------------------------
// Imports
// -------------------------------
import mapboxgl from 'https://cdn.jsdelivr.net/npm/mapbox-gl@2.15.0/+esm';
import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';

// -------------------------------
// Map setup
// -------------------------------
mapboxgl.accessToken =
  'pk.eyJ1IjoibWF2YXVnaHQiLCJhIjoiY21odmRuczBxMDlmdDJzb2lhd28zMmw5biJ9.7wXMZcRbL0fCttvhk_3FyA';

const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/streets-v12',
  center: [-71.09415, 42.36027], // Boston
  zoom: 12,
  minZoom: 5,
  maxZoom: 18,
});

// -------------------------------
// Helpers
// -------------------------------
function formatTime(minutes) {
  const date = new Date(0, 0, 0, 0, minutes);
  return date.toLocaleString('en-US', { timeStyle: 'short' });
}

function minutesSinceMidnight(date) {
  return date.getHours() * 60 + date.getMinutes();
}

// -------------------------------
// Pre-bucketed trip arrays (1 per minute of day)
// -------------------------------
let departuresByMinute = Array.from({ length: 1440 }, () => []);
let arrivalsByMinute = Array.from({ length: 1440 }, () => []);

// -------------------------------
// Efficient filtering
// -------------------------------
function filterByMinute(tripsByMinute, minute) {
  if (minute === -1) return tripsByMinute.flat();

  let minMinute = (minute - 60 + 1440) % 1440;
  let maxMinute = (minute + 60) % 1440;

  if (minMinute > maxMinute) {
    const beforeMidnight = tripsByMinute.slice(minMinute);
    const afterMidnight = tripsByMinute.slice(0, maxMinute);
    return beforeMidnight.concat(afterMidnight).flat();
  } else {
    return tripsByMinute.slice(minMinute, maxMinute).flat();
  }
}

// -------------------------------
// Compute per-station traffic
// -------------------------------
function computeStationTraffic(stations, timeFilter = -1) {
  const departures = d3.rollup(
    filterByMinute(departuresByMinute, timeFilter),
    (v) => v.length,
    (d) => String(d.start_station_id)
  );

  const arrivals = d3.rollup(
    filterByMinute(arrivalsByMinute, timeFilter),
    (v) => v.length,
    (d) => String(d.end_station_id)
  );

  return stations.map((station) => {
    const id = String(station.legacy_id);
    station.departures = departures.get(id) ?? 0;
    station.arrivals = arrivals.get(id) ?? 0;
    station.totalTraffic = station.departures + station.arrivals;
    return station;
  });
}

// -------------------------------
// Map projection helper
// -------------------------------
function getCoords(station) {
  const point = new mapboxgl.LngLat(+station.lon, +station.lat);
  const { x, y } = map.project(point);
  return { cx: x, cy: y };
}

// -------------------------------
// Map load event
// -------------------------------
map.on('load', async () => {
  console.log('Map fully loaded.');

  // --- Bike lanes ---
  map.addSource('boston_route', {
    type: 'geojson',
    data:
      'https://bostonopendata-boston.opendata.arcgis.com/datasets/boston::existing-bike-network-2022.geojson',
  });
  map.addLayer({
    id: 'boston-bike-lanes',
    type: 'line',
    source: 'boston_route',
    paint: { 'line-color': '#32D400', 'line-width': 5, 'line-opacity': 0.6 },
  });

  map.addSource('cambridge_route', {
    type: 'geojson',
    data:
      'https://cambridgegisdata-openhubcambridgegis.hub.arcgis.com/datasets/CambridgeGIS::bike-lanes.geojson',
  });
  map.addLayer({
    id: 'cambridge-bike-lanes',
    type: 'line',
    source: 'cambridge_route',
    paint: { 'line-color': '#32D400', 'line-width': 5, 'line-opacity': 0.6 },
  });

  // --- SVG overlay ---
  const svg = d3.select('#map').select('svg');
  const mapCanvas = document.querySelector('.mapboxgl-canvas');
  const svgElement = document.querySelector('#map svg');
  mapCanvas.insertAdjacentElement('afterend', svgElement);

  // --- Load station data ---
  const stationUrl =
    'https://dsc106.com/labs/lab07/data/bluebikes-stations.json';
  const jsonData = await d3.json(stationUrl);
  let stations = jsonData.data.stations;

  // --- Load trip data + bucket by minute ---
  const trips = await d3.csv(
    'https://dsc106.com/labs/lab07/data/bluebikes-traffic-2024-03.csv',
    (trip) => {
      trip.started_at = new Date(trip.started_at);
      trip.ended_at = new Date(trip.ended_at);

      const startMin = minutesSinceMidnight(trip.started_at);
      const endMin = minutesSinceMidnight(trip.ended_at);

      departuresByMinute[startMin].push(trip);
      arrivalsByMinute[endMin].push(trip);
      return trip;
    }
  );

  console.log('Trip sample:', trips[0]);
  console.log('Station sample:', stations[0]);

  console.log('Sample bucket check:', departuresByMinute[600].length);

  // --- Compute initial traffic ---
  stations = computeStationTraffic(stations);

  // --- Radius scale ---
  const radiusScale = d3
    .scaleSqrt()
    .domain([0, d3.max(stations, (d) => d.totalTraffic)])
    .range([0, 25]);

  // --- Create circles (with key function) ---
  const circles = svg
    .selectAll('circle')
    .data(stations, (d) => d.short_name)
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

  // --- Keep circles aligned to map moves ---
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

  // -------------------------------
  // Time-slider interactivity
  // -------------------------------
  const timeSlider = document.getElementById('time-slider');
  const selectedTime = document.getElementById('selected-time');
  const anyTimeLabel = document.getElementById('any-time');
  let timeFilter = -1;

  // --- Update circles dynamically ---
  function updateScatterPlot(timeFilter) {
    const filteredStations = computeStationTraffic(stations, timeFilter);

    // Adjust circle size range dynamically
    timeFilter === -1
      ? radiusScale.range([0, 25])
      : radiusScale.range([3, 50]);

    circles
      .data(filteredStations, (d) => d.short_name)
      .join('circle')
      .attr('r', (d) => radiusScale(d.totalTraffic))
      .select('title')
      .text(
        (d) =>
          `${d.totalTraffic} trips (${d.departures} departures, ${d.arrivals} arrivals)`
      );
  }

  // --- Slider handler ---
  function updateTimeDisplay() {
    timeFilter = Number(timeSlider.value);
    if (timeFilter === -1) {
      selectedTime.textContent = '';
      anyTimeLabel.style.display = 'block';
    } else {
      selectedTime.textContent = formatTime(timeFilter);
      anyTimeLabel.style.display = 'none';
    }
    updateScatterPlot(timeFilter);
  }

  timeSlider.addEventListener('input', updateTimeDisplay);
  updateTimeDisplay();
});