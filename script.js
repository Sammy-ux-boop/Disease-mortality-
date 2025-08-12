import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

// Initialize the map
let map = L.map('map').setView([-1.3, 36.8], 6);

// Add OpenStreetMap tile layer
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

// Initialize Supabase
const supabase = createClient(
  'https://aqupatrmqukfszrinlbr.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFxdXBhdHJtcXVrZnN6cmlubGJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDUyMTk1MTIsImV4cCI6MjA2MDc5NTUxMn0.yWNjvIoRKpD3E-X1_YlJ7HqfCgMFELIvLyAuX-O7GII'
);

// Ensure DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('queryForm').addEventListener('submit', async function (e) {
    e.preventDefault();

    const disease = document.getElementById('column').value;
    const threshold = document.getElementById('minValue').value;

    const { data, error } = await supabase.rpc('geojson_query_by_disease', {
      disease_name: disease,
      threshold: parseFloat(threshold)
    });

    if (error) {
      console.error('Error fetching data:', error);
      return;
    }

    // Remove previous GeoJSON/Marker layers
    map.eachLayer(layer => {
      if (layer instanceof L.GeoJSON || layer instanceof L.Marker) {
        map.removeLayer(layer);
      }
    });

    
    function calculatePercentiles(data, percentiles = [25, 50, 75]) {
      const values = data.map(row => row.disease_value).filter(v => v != null);
      values.sort((a, b) => a - b);

      return percentiles.map(p => {
        const index = Math.floor((p / 100) * (values.length - 1));
        return values[index];
      });
    }

    const percentiles = calculatePercentiles(data);
    const maxValue = Math.max(...data.map(row => row.disease_value || 0));
    const thresholds = [percentiles[0], percentiles[1], percentiles[2], maxValue];
    const colors = ['yellow', 'orange', 'red'];

    const colorScale = (value) => {
      if (value <= thresholds[0]) return colors[0];
      if (value <= thresholds[1]) return colors[1];
      if (value <= thresholds[2]) return colors[2];
      return colors[3];
    };

    function populateTable(data, disease) {
      document.getElementById("diseaseHeader").innerText = disease;
      const tableBody = document.querySelector("#diseaseTable tbody");
      tableBody.innerHTML = '';

      const sortedData = data.slice().sort((a, b) => {
        const valA = Number(a.disease_value) || 0;
        const valB = Number(b.disease_value) || 0;
        return valB - valA;
      });

      sortedData.forEach(row => {
        const tr = document.createElement("tr");

        const countyTd = document.createElement("td");
        countyTd.textContent = row.county;

        const valueTd = document.createElement("td");
        valueTd.textContent = row.disease_value ?? "No data available";

        tr.appendChild(countyTd);
        tr.appendChild(valueTd);
        tableBody.appendChild(tr);
      });
    }

    
    populateTable(data, disease);

    const legend = L.control({ position: 'bottomleft' });

    legend.onAdd = function () {
      const div = L.DomUtil.create('div', 'info legend');
      const labels = ['Low', 'Moderate', 'High',];

      // Update to show 4 ranges instead of 3
      for (let i = 0; i < thresholds.length - 1; i++) {
        const from = thresholds[i].toFixed(0);
        const to = thresholds[i + 1].toFixed(0);
        const color = colors[i];

        div.innerHTML += `
          <div style="display: flex; align-items: center; margin-bottom: 4px;">
            <i style="width: 18px; height: 18px; background:${color}; display: inline-block; border: 1px solid #999; margin-right: 8px;"></i>
            <strong>${labels[i]}</strong>: ${from} &ndash; ${to}
          </div>
        `;
      }

      return div;
    };

    legend.addTo(map);

    data.forEach(row => {
      const geom = row.geometry;
      const diseaseValue = row.disease_value;

      if (!geom) return;

      const popupText = diseaseValue !== undefined
        ? `<strong>${row.county}</strong><br>${disease}: ${diseaseValue}`
        : `<strong>${row.county}</strong><br>${disease}: <em>No data available</em>`;

      const color = diseaseValue !== undefined ? colorScale(diseaseValue) : 'gray';

      if (geom.type === 'Point') {
        const [lng, lat] = geom.coordinates;
        L.marker([lat, lng])
          .addTo(map)
          .bindPopup(popupText)
          .setIcon(L.divIcon({
            className: 'custom-icon',
            iconSize: [10, 10],
            iconAnchor: [5, 5],
            popupAnchor: [0, -10],
            html: `<div style="background-color:${color}; width: 10px; height: 10px; border-radius: 50%;"></div>`
          }));
      } else if (geom.type === 'Polygon' || geom.type === 'MultiPolygon') {
        L.geoJSON(geom, {
          style: function () {
            return {
              color: color,
              weight: 1,
              fillOpacity: 0.7
            };
          }
        })
          .addTo(map)
          .bindPopup(popupText);
      }
    });

  });
});



