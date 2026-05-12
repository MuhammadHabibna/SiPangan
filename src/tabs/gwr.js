import { store, fmt, clusterColor, createYearSelector, getYearData, makeTooltipHTML } from '../main.js';

const GWR_FEATURES = ['Penduduk_Miskin', 'Akses_Air_Layak', 'Luas_Panen_Padi', 'PDRB_per_Kapita'];
const FEAT_LABELS = { Penduduk_Miskin:'Kemiskinan', Akses_Air_Layak:'Akses Air', Luas_Panen_Padi:'Luas Panen', PDRB_per_Kapita:'PDRB/Kapita' };
const FEAT_COLORS = ['#ef4444', '#6366f1', '#06b6d4', '#10b981'];

export function renderGWR(panel) {
  panel.innerHTML = `
    <div class="flex-between mb-md">
      <h2 class="section-title">🗺️ GWR Explorer — Geographically Weighted Regression</h2>
      <div style="font-weight:600; font-size:14px; background:var(--primary-50); color:var(--primary); padding:6px 16px; border-radius:20px;">Tahun 2025</div>
    </div>
    <div class="stats-grid mb-md">
      <div class="stat-card" style="--stat-color:#3b82f6"><div class="stat-label">Global R²</div><div class="stat-value" id="gwr-r2">0</div><div class="stat-sub">GWR vs OLS</div></div>
      <div class="stat-card" style="--stat-color:#10b981"><div class="stat-label">Variabel Independen</div><div class="stat-value">${GWR_FEATURES.length}</div><div class="stat-sub">Fitur prediktor IKP</div></div>
      <div class="stat-card" style="--stat-color:#f59e0b"><div class="stat-label">Observasi</div><div class="stat-value" id="gwr-n">0</div><div class="stat-sub">Tahun terpilih</div></div>
    </div>
    <div class="grid-main-side mb-lg">
      <div class="card">
        <div class="card-header flex-between">
          <span>Peta Koefisien Lokal</span>
          <select id="gwr-feat-sel" style="padding:4px 8px;border:1px solid var(--border);border-radius:6px;font-size:12px;font-family:inherit"></select>
        </div>
        <div class="card-body" style="padding:0"><div id="gwr-map" class="map-container" style="height:460px"></div></div>
      </div>
      <div>
        <div class="card mb-md">
          <div class="card-header">Peta R² Lokal</div>
          <div class="card-body" style="padding:0"><div id="gwr-r2map" class="map-container" style="height:220px"></div></div>
        </div>
        <div class="card">
          <div class="card-header flex-between">
            <span>Faktor Dominan per Provinsi</span>
            <select id="gwr-rank-sel" style="padding:4px 8px;border:1px solid var(--border);border-radius:6px;font-size:12px;font-family:inherit">
              <option value="Faktor_Dominan">Faktor Utama (Ke-1)</option>
              <option value="Faktor_Kedua">Faktor Kedua (Ke-2)</option>
            </select>
          </div>
          <div class="card-body"><div id="gwr-bar" style="height:220px"></div></div>
        </div>
      </div>
    </div>
  `;

  const sel = document.getElementById('gwr-feat-sel');
  GWR_FEATURES.forEach(f => { const o = document.createElement('option'); o.value = f; o.textContent = FEAT_LABELS[f]; sel.appendChild(o); });
  const rankSel = document.getElementById('gwr-rank-sel');
  
  sel.onchange = () => buildGWRMap(2025, sel.value, rankSel.value);
  rankSel.onchange = () => {
    buildDominantBar(2025, rankSel.value);
    buildGWRMap(2025, sel.value, rankSel.value);
  };

  buildGWRMap(2025, GWR_FEATURES[0], 'Faktor_Dominan');
  buildR2Map(2025);
  buildDominantBar(2025, 'Faktor_Dominan');

  const yd = getYearData(store.data.gwr_result, 2025);
  document.getElementById('gwr-n').textContent = yd.length;
  const avgR2 = yd.reduce((s,d) => s+d.R2_Lokal,0)/yd.length;
  document.getElementById('gwr-r2').textContent = fmt(avgR2, 3);
}

function buildGWRMap(year, feature, rankKey = 'Faktor_Dominan') {
  if (store.maps.gwr) { store.maps.gwr.remove(); }
  const map = L.map('gwr-map', { scrollWheelZoom: true }).setView([-2.5, 118], 5);
  store.maps.gwr = map;
  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', { maxZoom: 18 }).addTo(map);

  const yd = getYearData(store.data.gwr_result, year);
  const key = `koef_${feature}`;
  const vals = yd.map(d => d[key]).filter(v => v != null);
  const absMax = Math.max(...vals.map(Math.abs), 0.01);

  function getColor(v) {
    if (v == null) return '#d9d9d9';
    const t = v / absMax;
    if (t > 0) return `rgba(26,152,80,${Math.abs(t)*0.8+0.2})`;
    return `rgba(215,48,39,${Math.abs(t)*0.8+0.2})`;
  }

  L.geoJSON(store.data.geojson_38, {
    style: feat => {
      const d = yd.find(x => x.Provinsi === feat.properties.DATASET_NAME);
      return { fillColor: d ? getColor(d[key]) : '#d9d9d9', weight: 1, color: '#fff', fillOpacity: 0.85 };
    },
    onEachFeature: (feat, layer) => {
      const d = yd.find(x => x.Provinsi === feat.properties.DATASET_NAME);
      const rankLabel = rankKey === 'Faktor_Dominan' ? 'Faktor Utama' : 'Faktor Kedua';
      if (d) layer.bindTooltip(`<div class="prov-tooltip"><div class="tip-name">${d.Provinsi}</div><hr class="tip-divider"><div class="tip-row"><span class="label">Koef. ${FEAT_LABELS[feature]}</span><span class="value">${fmt(d[key],4)}</span></div><div class="tip-row"><span class="label">R² Lokal</span><span class="value">${fmt(d.R2_Lokal,3)}</span></div><div class="tip-row"><span class="label">${rankLabel}</span><span class="value">${FEAT_LABELS[d[rankKey]] || d[rankKey]}</span></div></div>`, { sticky: true });
      layer.on({ mouseover: e => { e.target.setStyle({ weight: 3, color: '#1e40af' }); e.target.bringToFront(); }, mouseout: e => { layer.setStyle({ weight: 1, color: '#fff' }); } });
    }
  }).addTo(map);
}

function buildR2Map(year) {
  if (store.maps.gwrR2) { store.maps.gwrR2.remove(); }
  const map = L.map('gwr-r2map', { scrollWheelZoom: false, zoomControl: false }).setView([-2.5, 118], 4);
  store.maps.gwrR2 = map;
  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png', { maxZoom: 18 }).addTo(map);

  const yd = getYearData(store.data.gwr_result, year);
  L.geoJSON(store.data.geojson_38, {
    style: feat => {
      const d = yd.find(x => x.Provinsi === feat.properties.DATASET_NAME);
      const r2 = d?.R2_Lokal || 0;
      const g = Math.round(100 + r2 * 155);
      return { fillColor: `rgb(50,${g},100)`, weight: 0.5, color: '#fff', fillOpacity: 0.8 };
    }
  }).addTo(map);
}

function buildDominantBar(year, rankKey = 'Faktor_Dominan') {
  const yd = getYearData(store.data.gwr_result, year);
  const counts = {};
  GWR_FEATURES.forEach(f => counts[f] = 0);
  yd.forEach(d => { if (counts[d[rankKey]] !== undefined) counts[d[rankKey]]++; });

  const el = document.getElementById('gwr-bar');
  store.charts.gwrBar = el;
  Plotly.newPlot(el, [{
    x: Object.keys(counts).map(k => FEAT_LABELS[k]),
    y: Object.values(counts),
    type: 'bar', marker: { color: FEAT_COLORS }
  }], {
    xaxis: { title: '' }, yaxis: { title: 'Jumlah Provinsi' },
    plot_bgcolor: '#fafafa', paper_bgcolor: 'transparent',
    font: { family: 'Inter', size: 11 }, margin: { l: 40, r: 10, t: 10, b: 60 }
  }, { responsive: true, displayModeBar: false });
}
