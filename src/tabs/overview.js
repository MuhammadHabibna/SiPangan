import { store, fmt, animateValue, clusterColor, makeTooltipHTML, createYearSelector, getYearData, getProvData, CLUSTER_COLORS } from '../main.js';

export function renderOverview(panel) {
  const { df_labeled, cluster_result, geojson_38 } = store.data;
  const year = store.year;
  const yearData = getYearData(df_labeled, year);
  const avgIKP = yearData.reduce((s, d) => s + d.IKP, 0) / yearData.length;
  const worst = yearData.reduce((a, b) => a.IKP < b.IKP ? a : b);
  const best = yearData.reduce((a, b) => a.IKP > b.IKP ? a : b);

  panel.innerHTML = `
    <div class="flex-between mb-md">
      <h2 class="section-title">📊 Overview Ketahanan Pangan</h2>
      <div id="ov-year-sel"></div>
    </div>
    <div class="stats-grid mb-md">
      <div class="stat-card" style="--stat-color:var(--primary)">
        <div class="stat-label">Total Provinsi</div>
        <div class="stat-value" id="ov-total">${yearData.length}</div>
        <div class="stat-sub">Tahun ${year}</div>
      </div>
      <div class="stat-card" style="--stat-color:var(--accent)">
        <div class="stat-label">Rata-rata IKP</div>
        <div class="stat-value" id="ov-avg">0</div>
        <div class="stat-sub">Indeks Ketahanan Pangan</div>
      </div>
      <div class="stat-card" style="--stat-color:#d73027">
        <div class="stat-label">Provinsi Paling Rawan</div>
        <div class="stat-value" style="font-size:18px">${worst.Provinsi}</div>
        <div class="stat-sub">IKP: ${fmt(worst.IKP)}</div>
      </div>
      <div class="stat-card" style="--stat-color:#1a9850">
        <div class="stat-label">Provinsi Paling Aman</div>
        <div class="stat-value" style="font-size:18px">${best.Provinsi}</div>
        <div class="stat-sub">IKP: ${fmt(best.IKP)}</div>
      </div>
    </div>

    <div class="grid-main-side mb-lg">
      <div class="card">
        <div class="card-header">Peta Indeks Ketahanan Pangan — ${year}</div>
        <div class="card-body" style="padding:0">
          <div id="ov-map" class="map-container" style="height:480px"></div>
        </div>
      </div>
      <div>
        <div class="card mb-md">
          <div class="card-header">🔴 Top 5 Paling Rawan</div>
          <div class="card-body" id="ov-top-rawan" style="padding:12px"></div>
        </div>
        <div class="card mb-md">
          <div class="card-header">🟢 Top 5 Paling Aman</div>
          <div class="card-body" id="ov-top-aman" style="padding:12px"></div>
        </div>
        <div class="card">
          <div class="card-header">Ranking Prioritas</div>
          <div class="card-body table-scroll" style="padding:0; max-height:300px">
            <table class="rank-table" id="ov-rank-table">
              <thead><tr><th>#</th><th>Provinsi</th><th>IKP</th><th>Cluster</th></tr></thead>
              <tbody></tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  `;

  animateValue(document.getElementById('ov-avg'), avgIKP);
  createYearSelector(document.getElementById('ov-year-sel'), () => renderOverview(panel));
  buildOverviewMap(year);
  buildHighlights(year);
  buildRankTable(year);
}

function buildOverviewMap(year) {
  const { df_labeled, cluster_result, geojson_38 } = store.data;
  const map = L.map('ov-map', { zoomControl: true, scrollWheelZoom: true }).setView([-2.5, 118], 5);
  store.maps.overview = map;

  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '© CARTO © OSM', maxZoom: 18
  }).addTo(map);

  const yearData = getYearData(store.data.df_labeled, year);
  const yearCluster = getYearData(store.data.cluster_result, year);
  const ikpMin = Math.min(...yearData.map(d => d.IKP));
  const ikpMax = Math.max(...yearData.map(d => d.IKP));

  function getIKPColor(ikp) {
    if (ikp == null) return '#d9d9d9';
    const t = (ikp - ikpMin) / (ikpMax - ikpMin || 1);
    const r = Math.round(215 - t * (215 - 26));
    const g = Math.round(48 + t * (152 - 48));
    const b = Math.round(39 + t * (80 - 39));
    return `rgb(${r},${g},${b})`;
  }

  function style(feature) {
    const dname = feature.properties.DATASET_NAME;
    const d = yearData.find(x => x.Provinsi === dname);
    return {
      fillColor: d ? getIKPColor(d.IKP) : '#d9d9d9',
      weight: 1, color: '#fff', fillOpacity: 0.85
    };
  }

  function onEach(feature, layer) {
    const dname = feature.properties.DATASET_NAME;
    const d = yearData.find(x => x.Provinsi === dname);
    const c = yearCluster.find(x => x.Provinsi === dname);
    layer.bindTooltip(makeTooltipHTML(dname, d, c), { sticky: true, className: '' });
    layer.on({
      mouseover: e => { e.target.setStyle({ weight: 3, color: '#1e40af', fillOpacity: 1 }); e.target.bringToFront(); },
      mouseout: e => { geoLayer.resetStyle(e.target); }
    });
  }

  const geoLayer = L.geoJSON(geojson_38, { style, onEachFeature: onEach }).addTo(map);

  // Gradient legend
  const legend = L.control({ position: 'bottomright' });
  legend.onAdd = () => {
    const div = L.DomUtil.create('div', 'map-legend');
    div.innerHTML = `
      <h4>Indeks Ketahanan Pangan</h4>
      <div style="display:flex;align-items:center;gap:8px">
        <span style="font-size:11px">${fmt(ikpMin,0)}</span>
        <div style="flex:1;height:12px;border-radius:4px;background:linear-gradient(to right,#d73027,#fee08b,#1a9850)"></div>
        <span style="font-size:11px">${fmt(ikpMax,0)}</span>
      </div>`;
    return div;
  };
  legend.addTo(map);
}

function buildHighlights(year) {
  const yearData = getYearData(store.data.df_labeled, year);
  const prevData = year > 2021 ? getYearData(store.data.df_labeled, year - 1) : [];
  const sorted = [...yearData].sort((a, b) => a.IKP - b.IKP);

  function renderList(container, items) {
    container.innerHTML = items.map((d, i) => {
      const prev = prevData.find(p => p.Provinsi === d.Provinsi);
      const delta = prev ? d.IKP - prev.IKP : null;
      const arrow = delta == null ? '' : delta > 0.5 ? '↑' : delta < -0.5 ? '↓' : '→';
      const arrowColor = delta == null ? '' : delta > 0.5 ? '#10b981' : delta < -0.5 ? '#ef4444' : '#94a3b8';
      return `
        <div style="display:flex;align-items:center;gap:10px;padding:6px 0;${i < items.length-1 ? 'border-bottom:1px solid var(--border-light)' : ''}">
          <span style="font-weight:700;color:var(--text-muted);font-size:12px;width:18px">${i+1}</span>
          <span style="flex:1;font-size:12px;font-weight:500">${d.Provinsi}</span>
          <span style="font-weight:700;font-size:13px">${fmt(d.IKP)}</span>
          ${delta != null ? `<span style="font-size:11px;font-weight:600;color:${arrowColor};min-width:40px;text-align:right">${arrow} ${fmt(Math.abs(delta))}</span>` : ''}
        </div>`;
    }).join('');
  }

  renderList(document.getElementById('ov-top-rawan'), sorted.slice(0, 5));
  renderList(document.getElementById('ov-top-aman'), sorted.slice(-5).reverse());
}

function buildRankTable(year) {
  const yearData = getYearData(store.data.df_labeled, year);
  const sorted = [...yearData].sort((a, b) => a.IKP - b.IKP);
  const tbody = document.querySelector('#ov-rank-table tbody');
  tbody.innerHTML = sorted.map((d, i) => {
    const color = clusterColor(d.Cluster_Name);
    return `<tr>
      <td style="font-weight:600;color:var(--text-muted)">${i + 1}</td>
      <td style="font-weight:500">${d.Provinsi}</td>
      <td><strong>${fmt(d.IKP)}</strong></td>
      <td><span class="rank-badge" style="background:${color}20;color:${color}">${d.Cluster_Name}</span></td>
    </tr>`;
  }).join('');
}
