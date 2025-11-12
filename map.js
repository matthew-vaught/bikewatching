document.addEventListener("DOMContentLoaded", async () => {
  // -------------------------------
  // Mapbox setup
  // -------------------------------
  mapboxgl.accessToken =
    "pk.eyJ1IjoibWF2YXVnaHQiLCJhIjoiY21odmRuczBxMDlmdDJzb2lhd28zMmw5biJ9.7wXMZcRbL0fCttvhk_3FyA";

  const map = new mapboxgl.Map({
    container: "map",
    style: "mapbox://styles/mapbox/light-v11",
    center: [-71.0915, 42.357],
    zoom: 12,
  });

  map.on("load", async () => {
    console.log("Map fully loaded.");

    // ---------- Step 1: Load data ----------
    const jsonData = await d3.json(
      "https://dsc106.com/labs/lab07/data/bluebikes-stations.json"
    );

    const trips = await d3.csv(
      "https://dsc106.com/labs/lab07/data/bluebikes-traffic-2024-03.csv",
      (trip) => {
        trip.started_at = new Date(trip.started_at);
        trip.ended_at = new Date(trip.ended_at);
        return trip;
      }
    );

    // ---------- Step 2: Precompute minute buckets ----------
    const departuresByMinute = Array.from({ length: 1440 }, () => []);
    const arrivalsByMinute = Array.from({ length: 1440 }, () => []);

    function minutesSinceMidnight(date) {
      return date.getHours() * 60 + date.getMinutes();
    }

    trips.forEach((trip) => {
      const startMin = minutesSinceMidnight(trip.started_at);
      const endMin = minutesSinceMidnight(trip.ended_at);
      departuresByMinute[startMin].push(trip);
      arrivalsByMinute[endMin].push(trip);
    });

    // ---------- Step 3: Filtering helpers ----------
    function filterByMinute(tripsByMinute, minute) {
      if (minute === -1) return tripsByMinute.flat();
      const minMinute = (minute - 60 + 1440) % 1440;
      const maxMinute = (minute + 60) % 1440;

      if (minMinute > maxMinute) {
        return tripsByMinute.slice(minMinute).concat(tripsByMinute.slice(0, maxMinute)).flat();
      } else {
        return tripsByMinute.slice(minMinute, maxMinute).flat();
      }
    }

    // ---------- Step 4: Compute station traffic ----------
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
        const id = String(station.short_name); // ✅ correct matching field
        station.departures = departures.get(id) ?? 0;
        station.arrivals = arrivals.get(id) ?? 0;
        station.totalTraffic = station.departures + station.arrivals;
        return station;
      });
    }

    // ---------- Step 5: Visualization setup ----------
    const stations = computeStationTraffic(jsonData.data.stations);
    const svg = d3.select("#map").append("svg");
    const radiusScale = d3.scaleSqrt().domain([0, 2000]).range([0, 25]);
    const stationFlow = d3.scaleQuantize().domain([0, 1]).range([0, 0.5, 1]);

    // Draw circles
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
      .style("--departure-ratio", (d) => {
        if (d.totalTraffic === 0) return 0.5;
        const ratio = d.departures / d.totalTraffic;
        return stationFlow(Math.max(0, Math.min(1, ratio)));
      })
      .append("title")
      .text(
        (d) =>
          `${d.name}\n${d.totalTraffic} trips (${d.departures} departures, ${d.arrivals} arrivals)`
      );

    // ---------- Step 6: Slider setup ----------
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
      timeFilter === -1
        ? radiusScale.range([0, 25])
        : radiusScale.range([3, 50]);

      circles
        .data(filteredStations, (d) => d.short_name)
        .join("circle")
        .attr("r", (d) => radiusScale(d.totalTraffic))
        .style("--departure-ratio", (d) => {
          if (d.totalTraffic === 0) return 0.5;
          const ratio = d.departures / d.totalTraffic;
          return stationFlow(Math.max(0, Math.min(1, ratio)));
        })
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

    // ---------- Step 7: Reposition circles ----------
    map.on("move", () => {
      circles
        .attr("cx", (d) => map.project([d.lon, d.lat]).x)
        .attr("cy", (d) => map.project([d.lon, d.lat]).y);
    });
  });
});