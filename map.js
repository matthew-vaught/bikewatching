mapboxgl.accessToken = "pk.eyJ1IjoibWF2YXVnaHQiLCJhIjoiY21odmRuczBxMDlmdDJzb2lhd28zMmw5biJ9.7wXMZcRbL0fCttvhk_3FyA";

const map = new mapboxgl.Map({
  container: "map",
  style: "mapbox://styles/mapbox/light-v11",
  center: [-71.0915, 42.357],
  zoom: 12,
});

map.on("load", async () => {
  console.log("Map fully loaded.");

  // ---------- Step 1: Load data ----------
  let jsonData = await d3.json(
    "https://dsc106.com/labs/lab07/data/bluebikes-stations-2024-03.json"
  );

  let trips = await d3.csv(
    "https://dsc106.com/labs/lab07/data/bluebikes-traffic-2024-03.csv",
    (trip) => {
      trip.started_at = new Date(trip.started_at);
      trip.ended_at = new Date(trip.ended_at);
      return trip;
    }
  );

  // ---------- Step 2: Precompute minute buckets ----------
  let departuresByMinute = Array.from({ length: 1440 }, () => []);
  let arrivalsByMinute = Array.from({ length: 1440 }, () => []);

  function minutesSinceMidnight(date) {
    return date.getHours() * 60 + date.getMinutes();
  }

  trips.forEach((trip) => {
    let startMin = minutesSinceMidnight(trip.started_at);
    let endMin = minutesSinceMidnight(trip.ended_at);
    departuresByMinute[startMin].push(trip);
    arrivalsByMinute[endMin].push(trip);
  });

  console.log("Sample bucket check:", departuresByMinute[177].length);

  // ---------- Step 3: Filtering helpers ----------
  function filterByMinute(tripsByMinute, minute) {
    if (minute === -1) return tripsByMinute.flat(); // all trips
    let minMinute = (minute - 60 + 1440) % 1440;
    let maxMinute = (minute + 60) % 1440;

    if (minMinute > maxMinute) {
      let beforeMidnight = tripsByMinute.slice(minMinute);
      let afterMidnight = tripsByMinute.slice(0, maxMinute);
      return beforeMidnight.concat(afterMidnight).flat();
    } else {
      return tripsByMinute.slice(minMinute, maxMinute).flat();
    }
  }

  // ---------- Step 4: Compute station traffic ----------
  function computeStationTraffic(stations, timeFilter = -1) {
    // Efficiently retrieve trips within ±60 min of timeFilter
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
      const id = String(station.short_name);
      station.departures = departures.get(id) ?? 0;
      station.arrivals = arrivals.get(id) ?? 0;
      station.totalTraffic = station.departures + station.arrivals;
      return station;
    });
  }

  // ---------- Step 5: Initialize visualization ----------
  const stations = computeStationTraffic(jsonData.data.stations);
  const svg = d3.select("#map").append("svg");
  const radiusScale = d3.scaleSqrt().domain([0, 2000]).range([0, 25]);

  // Step 6.1 – Traffic flow color scale
  const stationFlow = d3
    .scaleQuantize()
    .domain([0, 1])
    .range([0, 0.5, 1]); // 3 discrete color steps

  // Add circles for stations (keyed by short_name)
  const circles = svg
    .selectAll("circle")
    .data(stations, (d) => d.short_name)
    .enter()
    .append("circle")
    .attr("r", (d) => radiusScale(d.totalTraffic))
    .attr("cx", (d) => map.project([d.lon, d.lat]).x)
    .attr("cy", (d) => map.project([d.lon, d.lat]).y)
    .attr("stroke", "white")
    .attr("fill-opacity", 0.7)
    .style("--departure-ratio", (d) =>
      stationFlow(d.departures / d.totalTraffic)
    )
    .append("title")
    .text(
      (d) =>
        `${d.name}\n${d.totalTraffic} trips (${d.departures} departures, ${d.arrivals} arrivals)`
    );

  // ---------- Step 5: Slider setup ----------
  const timeSlider = document.getElementById("time-slider");
  const selectedTime = document.getElementById("selected-time");
  const anyTimeLabel = document.getElementById("any-time");
  let timeFilter = -1;

  function formatTime(minutes) {
    const date = new Date(0, 0, 0, 0, minutes);
    return date.toLocaleString("en-US", { timeStyle: "short" });
  }

  function updateScatterPlot(timeFilter) {
    const filteredStations = computeStationTraffic(stations, timeFilter);
    // Adjust circle size range dynamically
    timeFilter === -1
      ? radiusScale.range([0, 25])
      : radiusScale.range([3, 50]);

    circles
      .data(filteredStations, (d) => d.short_name)
      .join("circle")
      .attr("r", (d) => radiusScale(d.totalTraffic))
      .style("--departure-ratio", (d) =>
        stationFlow(d.departures / d.totalTraffic)
      )
      .select("title")
      .text(
        (d) =>
          `${d.name}\n${d.totalTraffic} trips (${d.departures} departures, ${d.arrivals} arrivals)`
      );
  }

  function updateTimeDisplay() {
    timeFilter = Number(timeSlider.value);

    if (timeFilter === -1) {
      selectedTime.textContent = "";
      anyTimeLabel.style.display = "block";
    } else {
      selectedTime.textContent = formatTime(timeFilter);
      anyTimeLabel.style.display = "none";
    }

    updateScatterPlot(timeFilter);
  }

  timeSlider.addEventListener("input", updateTimeDisplay);
  updateTimeDisplay();

  // ---------- Reposition circles on map move ----------
  map.on("move", () => {
    circles
      .attr("cx", (d) => map.project([d.lon, d.lat]).x)
      .attr("cy", (d) => map.project([d.lon, d.lat]).y);
  });
});