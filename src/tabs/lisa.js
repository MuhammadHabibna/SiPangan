import { store, fmt, createYearSelector, getYearData, LISA_COLORS } from '../main.js';

const QUAD_NAMES = { HH:'High-High (Zona Aman)', LL:'Low-Low (Kantong Kerawanan)', HL:'High-Low (Outlier Positif)', LH:'Low-High (Outlier Negatif)', NS:'Not Significant' };
const QUAD_DESC = { HH:'Provinsi aman dikelilingi provinsi aman — area ketahanan pangan stabil.', LL:'Provinsi rawan dikelilingi provinsi rawan — hotspot kerawanan pangan.', HL:'Provinsi aman tetapi dikelilingi provinsi rawan — outlier positif.', LH:'Provinsi rawan tetapi dikelilingi provinsi aman — outlier negatif.', NS:'Tidak signifikan secara spasial pada α=0.05.' };

export function renderLISA(panel) {
  const year = store.year;
  const yd = getYearData(store.data.lisa_result, year);
  const sig = yd.filter(d => d.Signifikan);
  const moranI = yd.length > 0 ? yd[0].Moran_I_Global : 0;
  const pval = yd.length > 0 ? yd[0].P_Value_Global : 0;

  panel.innerHTML = `
    <div class="flex-between mb-md">
      <h2 class="section-title">🎯 Hotspot LISA — Local Indicators of Spatial Association</h2>
      <div id="lisa-year-sel"></div>
    </div>

    <div class="stats-grid mb-md">
      <div class="stat-card" style="--stat-color:#3b82f6"><div class="stat-label">Moran's I Global</div><div class="stat-value">${fmt(moranI,4)}</div><div class="stat-sub">Autokorelasi spasial IKP</div></div>
      <div class="stat-card" style="--stat-color:#10b981"><div class="stat-label">P-Value</div><div class="stat-value">${fmt(pval,4)}</div><div class="stat-sub">${pval<0.05?'✅ Signifikan':'⚠️ Tidak signifikan'}</div></div>
      <div class="stat-card" style="--stat-color:#ef4444"><div class="stat-label">Signifikan</div><div class="stat-value">${sig.length}/${yd.length}</div><div class="stat-sub">Provinsi dengan pola spasial</div></div>
    </div>
    <div class="grid-main-side mb-lg">
      <div class="card">
        <div class="card-header">LISA Cluster Map</div>
        <div class="card-body" style="padding:0"><div id="lisa-map" class="map-container" style="height:480px"></div></div>
      </div>
      <div>
        <div class="card mb-md">
          <div class="card-header">Interpretasi Kuadran</div>
          <div class="card-body" id="lisa-legend"></div>
        </div>
        <div class="card">
          <div class="card-header">Moran Scatterplot</div>
          <div class="card-body"><div id="lisa-scatter" style="height:240px"></div></div>
        </div>
      </div>
    </div>
  `;

  createYearSelector(document.getElementById('lisa-year-sel'), () => renderLISA(panel));
  buildLISAMap(year);
  buildQuadrantLegend();
  buildMoranScatter(year);
}

function buildLISAMap(year) {
  const map = L.map('lisa-map', { scrollWheelZoom: true }).setView([-2.5, 118], 5);
  store.maps.lisa = map;
  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', { maxZoom: 18 }).addTo(map);

  const yd = getYearData(store.data.lisa_result, year);

  L.geoJSON(store.data.geojson_38, {
    style: feat => {
      const d = yd.find(x => x.Provinsi === feat.properties.DATASET_NAME);
      const q = d?.LISA_Quadrant || 'NS';
      return { fillColor: LISA_COLORS[q], weight: d?.Signifikan ? 2 : 0.5, color: d?.Signifikan ? '#333' : '#ccc', fillOpacity: 0.75 };
    },
    onEachFeature: (feat, layer) => {
      const d = yd.find(x => x.Provinsi === feat.properties.DATASET_NAME);
      if (d) {
        const qn = QUAD_NAMES[d.LISA_Quadrant] || d.LISA_Quadrant;
        layer.bindTooltip(`<div class="prov-tooltip"><div class="tip-name">${d.Provinsi}</div><div class="tip-cluster"><span class="dot" style="background:${LISA_COLORS[d.LISA_Quadrant]}"></span>${qn}</div><hr class="tip-divider"><div class="tip-row"><span class="label">LISA I</span><span class="value">${fmt(d.LISA_I,4)}</span></div><div class="tip-row"><span class="label">P-Value</span><span class="value">${fmt(d.LISA_P_Value,4)}</span></div><div class="tip-row"><span class="label">Signifikan</span><span class="value">${d.Signifikan?'✅ Ya':'❌ Tidak'}</span></div></div>`, { sticky: true });
        layer.on({ mouseover: e => { e.target.setStyle({ weight: 3, fillOpacity: 1 }); e.target.bringToFront(); }, mouseout: e => { layer.setStyle({ weight: d.Signifikan ? 2 : 0.5, fillOpacity: 0.75 }); } });
      }
    }
  }).addTo(map);

  const legend = L.control({ position: 'bottomleft' });
  legend.onAdd = () => {
    const div = L.DomUtil.create('div', 'map-legend');
    div.innerHTML = '<h4>LISA Cluster</h4>' + Object.entries(LISA_COLORS).map(([q, c]) => `<div class="legend-item"><div class="legend-dot" style="background:${c}"></div><span style="font-size:11px">${QUAD_NAMES[q]}</span></div>`).join('');
    return div;
  };
  legend.addTo(map);
}

function buildQuadrantLegend() {
  const el = document.getElementById('lisa-legend');
  el.innerHTML = Object.entries(QUAD_NAMES).filter(([q]) => q !== 'NS').map(([q, name]) => `
    <div style="margin-bottom:12px">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
        <div style="width:14px;height:14px;border-radius:3px;background:${LISA_COLORS[q]}"></div>
        <strong style="font-size:12px">${name}</strong>
      </div>
      <p style="font-size:11px;color:var(--text-secondary);line-height:1.4;padding-left:22px">${QUAD_DESC[q]}</p>
    </div>
  `).join('');
}

function buildMoranScatter(year) {
  const yd = getYearData(store.data.lisa_result, year);
  const el = document.getElementById('lisa-scatter');
  store.charts.moran = el;

  const traces = Object.keys(LISA_COLORS).map(q => {
    const pts = yd.filter(d => d.LISA_Quadrant === q);
    return {
      x: pts.map(d => d.IKP_ZScore), y: pts.map(d => d.SpatialLag_ZScore),
      text: pts.map(d => d.Provinsi), mode: 'markers', type: 'scatter',
      name: q, marker: { color: LISA_COLORS[q], size: 7, opacity: 0.7 },
      hovertemplate: '<b>%{text}</b><extra></extra>'
    };
  });

  Plotly.newPlot(el, traces, {
    xaxis: { title: 'IKP (z)', zeroline: true, zerolinecolor: '#999' },
    yaxis: { title: 'Spatial Lag IKP (z)', zeroline: true, zerolinecolor: '#999' },
    plot_bgcolor: '#fafafa', paper_bgcolor: 'transparent',
    font: { family: 'Inter', size: 10 }, showlegend: false,
    margin: { l: 45, r: 10, t: 5, b: 40 }
  }, { responsive: true, displayModeBar: false });
}
