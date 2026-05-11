import { store, fmt, clusterColor, createYearSelector, getYearData, makeTooltipHTML } from '../main.js';

const GWR_FEATURES = ['TPT','Penduduk_Miskin','PDRB_per_Kapita','Luas_Panen_Padi','Akses_Air_Layak'];
const FEAT_LABELS = { TPT:'Pengangguran', Penduduk_Miskin:'Kemiskinan', PDRB_per_Kapita:'PDRB/Kapita', Luas_Panen_Padi:'Luas Panen', Akses_Air_Layak:'Akses Air' };
const FEAT_COLORS = ['#3b82f6','#ef4444','#f59e0b','#10b981','#8b5cf6'];

export function renderGWR(panel) {
  panel.innerHTML = `
    <div class="flex-between mb-md">
      <h2 class="section-title">🗺️ GWR Explorer — Geographically Weighted Regression</h2>
      <div id="gwr-year-sel"></div>
    </div>
    <div class="placeholder-banner">⚠️ Data GWR menggunakan <strong>placeholder</strong> — akan diperbarui setelah Layer 2 selesai diproses oleh Noel.</div>
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
          <div class="card-header">Faktor Dominan per Provinsi</div>
          <div class="card-body"><div id="gwr-bar" style="height:220px"></div></div>
        </div>
      </div>
    </div>
  `;

  createYearSelector(document.getElementById('gwr-year-sel'), () => renderGWR(panel));
  const sel = document.getElementById('gwr-feat-sel');
  GWR_FEATURES.forEach(f => { const o = document.createElement('option'); o.value = f; o.textContent = FEAT_LABELS[f]; sel.appendChild(o); });
  sel.onchange = () => buildGWRMap(store.year, sel.value);

  buildGWRMap(store.year, GWR_FEATURES[0]);
  buildR2Map(store.year);
  buildDominantBar(store.year);

  const yd = getYearData(store.data.gwr_result, store.year);
  document.getElementById('gwr-n').textContent = yd.length;
  const avgR2 = yd.reduce((s,d) => s+d.R2_Lokal,0)/yd.length;
  document.getElementById('gwr-r2').textContent = fmt(avgR2, 3);
}

function buildGWRMap(year, feature) {
  if (store.maps.gwr) { store.maps.gwr.remove(); }
  const map = L.map('gwr-map', { scrollWheelZoom: true }).setView([-2.5, 118], 5);
  store.maps.gwr = map;
  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', { maxZoom: 18 }).addTo(map);

  const yd = getYearData(store.data.gwr_result, year);
  const key = `coef_${feature}`;
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
      if (d) layer.bindTooltip(`<div class="prov-tooltip"><div class="tip-name">${d.Provinsi}</div><hr class="tip-divider"><div class="tip-row"><span class="label">Koef. ${FEAT_LABELS[feature]}</span><span class="value">${fmt(d[key],4)}</span></div><div class="tip-row"><span class="label">R² Lokal</span><span class="value">${fmt(d.R2_Lokal,3)}</span></div><div class="tip-row"><span class="label">Faktor Dominan</span><span class="value">${d.Faktor_Dominan}</span></div></div>`, { sticky: true });
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

function buildDominantBar(year) {
  const yd = getYearData(store.data.gwr_result, year);
  const counts = {};
  GWR_FEATURES.forEach(f => counts[f] = 0);
  yd.forEach(d => { if (counts[d.Faktor_Dominan] !== undefined) counts[d.Faktor_Dominan]++; });

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
