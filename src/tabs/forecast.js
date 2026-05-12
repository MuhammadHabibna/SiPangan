import { store, fmt, clusterColor } from '../main.js';

export function renderForecast(panel) {
  const { forecast_result, df_labeled } = store.data;
  const provs = [...new Set(df_labeled.filter(d => d.Tahun === 2025).map(d => d.Provinsi))].sort();

  panel.innerHTML = `
    <div class="flex-between mb-md">
      <h2 class="section-title">📈 Forecast — Ensemble Prediction</h2>
      <select id="fc-prov-sel" style="padding:6px 12px;border:1px solid var(--border);border-radius:8px;font-size:13px;font-family:inherit;min-width:220px"></select>
    </div>

    <div class="stats-grid mb-md">
      <div class="stat-card" style="--stat-color:#3b82f6"><div class="stat-label">Model</div><div class="stat-value" style="font-size:18px">Ensemble</div><div class="stat-sub">XGBoost + Random Forest (50:50)</div></div>
      <div class="stat-card" style="--stat-color:#10b981"><div class="stat-label">Horizon</div><div class="stat-value">2 Tahun</div><div class="stat-sub">2026 & 2027</div></div>
      <div class="stat-card" style="--stat-color:#f59e0b"><div class="stat-label">Tren Terpilih</div><div class="stat-value" id="fc-trend">—</div><div class="stat-sub" id="fc-trend-sub"></div></div>
    </div>
    <div class="grid-main-side mb-lg">
      <div class="card">
        <div class="card-header">IKP Aktual + Prediksi</div>
        <div class="card-body"><div id="fc-line" style="height:380px"></div></div>
      </div>
      <div>
        <div class="card mb-md">
          <div class="card-header">Bobot Model Ensemble</div>
          <div class="card-body"><div id="fc-pie" style="height:200px"></div></div>
        </div>
        <div class="card">
          <div class="card-header">Detail Prediksi</div>
          <div class="card-body" id="fc-detail"></div>
        </div>
      </div>
    </div>
    <div class="card">
      <div class="card-header">Tabel Prediksi Seluruh Provinsi (2027)</div>
      <div class="card-body table-scroll" style="padding:0;max-height:400px">
        <table class="rank-table" id="fc-table">
          <thead><tr><th>#</th><th>Provinsi</th><th>IKP 2025</th><th>Pred 2027</th><th>Δ</th><th>Tren</th></tr></thead>
          <tbody></tbody>
        </table>
      </div>
    </div>
  `;

  const sel = document.getElementById('fc-prov-sel');
  provs.forEach(p => { const o = document.createElement('option'); o.value = p; o.textContent = p; sel.appendChild(o); });
  sel.value = 'PAPUA PEGUNUNGAN';
  sel.onchange = () => buildForecastCharts(sel.value);
  buildForecastCharts(sel.value);
  buildForecastTable();
}

function buildForecastCharts(prov) {
  const { forecast_result, df_labeled } = store.data;
  const actual = df_labeled.filter(d => d.Provinsi === prov).sort((a,b) => a.Tahun - b.Tahun);
  const preds = forecast_result.filter(d => d.Provinsi === prov).sort((a,b) => a.Tahun_Pred - b.Tahun_Pred);

  const years = actual.map(d => d.Tahun);
  const ikps = actual.map(d => d.IKP);
  const predYears = preds.map(d => d.Tahun_Pred);
  const predVals = preds.map(d => d.IKP_Pred);
  const ciUpper = preds.map(d => d.CI_Upper);
  const ciLower = preds.map(d => d.CI_Lower);

  const lastActual = ikps[ikps.length-1] || 0;
  const allYears = [...years, ...predYears];
  const connY = [...ikps.map(() => null), ...predVals];
  connY[years.length - 1] = lastActual;

  const el = document.getElementById('fc-line');
  store.charts.fcLine = el;

  Plotly.newPlot(el, [
    { x: predYears, y: ciUpper, mode: 'lines', line: { width: 0 }, showlegend: false, hoverinfo: 'skip' },
    { x: predYears, y: ciLower, fill: 'tonexty', fillcolor: 'rgba(59,130,246,0.15)', mode: 'lines', line: { width: 0 }, showlegend: false, hoverinfo: 'skip' },
    { x: years, y: ikps, name: 'IKP Aktual', mode: 'lines+markers', line: { color: '#1e40af', width: 3 }, marker: { size: 8 } },
    { x: [years[years.length-1], ...predYears], y: [lastActual, ...predVals], name: 'Prediksi', mode: 'lines+markers', line: { color: '#3b82f6', width: 2, dash: 'dash' }, marker: { size: 8, symbol: 'diamond' } },
  ], {
    xaxis: { title: 'Tahun', dtick: 1 }, yaxis: { title: 'IKP' },
    plot_bgcolor: '#fafafa', paper_bgcolor: 'transparent',
    font: { family: 'Inter', size: 11 }, legend: { orientation: 'h', y: -0.15 },
    margin: { l: 50, r: 20, t: 10, b: 60 }, hovermode: 'x unified',
    shapes: [{ type: 'line', x0: 2025.5, x1: 2025.5, y0: 0, y1: 1, yref: 'paper', line: { color: '#999', width: 1, dash: 'dot' } }],
    annotations: [{ x: 2025.5, y: 1, yref: 'paper', text: 'Prediksi →', showarrow: false, font: { size: 10, color: '#999' } }]
  }, { responsive: true, displayModeBar: false });

  // Pie chart
  const pred1 = preds[0];
  if (pred1) {
    const pieEl = document.getElementById('fc-pie');
    store.charts.fcPie = pieEl;
    Plotly.newPlot(pieEl, [{ values: [pred1.W_XGB || 0.5, pred1.W_RF || 0.5], labels: ['XGBoost','Random Forest'], type: 'pie', marker: { colors: ['#3b82f6','#10b981'] }, textinfo: 'label+percent', hole: 0.4 }], { font: { family: 'Inter', size: 10 }, margin: { l: 10, r: 10, t: 10, b: 10 }, showlegend: false }, { responsive: true, displayModeBar: false });

    document.getElementById('fc-trend').textContent = pred1.Tren;
    document.getElementById('fc-trend').style.color = pred1.Tren === 'Membaik' ? '#10b981' : pred1.Tren === 'Memburuk' ? '#ef4444' : '#f59e0b';
    document.getElementById('fc-trend-sub').textContent = prov;
  }

  // Detail
  document.getElementById('fc-detail').innerHTML = preds.map(p => `
    <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border-light);font-size:12px">
      <span style="font-weight:600">${p.Tahun_Pred}</span>
      <span>IKP: <strong>${fmt(p.IKP_Pred)}</strong></span>
      <span style="color:var(--text-muted)">[${fmt(p.CI_Lower)}–${fmt(p.CI_Upper)}]</span>
    </div>
  `).join('');
}

function buildForecastTable() {
  const { forecast_result, df_labeled } = store.data;
  const pred2027 = forecast_result.filter(d => d.Tahun_Pred === 2027);
  const tbody = document.querySelector('#fc-table tbody');

  const rows = pred2027.map(p => {
    const actual = df_labeled.find(d => d.Provinsi === p.Provinsi && d.Tahun === 2025);
    const ikp25 = actual?.IKP || 0;
    const delta = p.IKP_Pred - ikp25;
    return { ...p, ikp25, delta };
  }).sort((a, b) => a.IKP_Pred - b.IKP_Pred);

  tbody.innerHTML = rows.map((r, i) => {
    const tcolor = r.Tren === 'Membaik' ? '#10b981' : r.Tren === 'Memburuk' ? '#ef4444' : '#f59e0b';
    const arrow = r.delta > 0 ? '↑' : r.delta < 0 ? '↓' : '→';
    return `<tr>
      <td style="font-weight:600;color:var(--text-muted)">${i+1}</td>
      <td style="font-weight:500">${r.Provinsi}</td>
      <td>${fmt(r.ikp25)}</td>
      <td><strong>${fmt(r.IKP_Pred)}</strong></td>
      <td style="color:${tcolor}">${arrow} ${fmt(Math.abs(r.delta))}</td>
      <td><span class="rank-badge" style="background:${tcolor}20;color:${tcolor}">${r.Tren}</span></td>
    </tr>`;
  }).join('');
}
