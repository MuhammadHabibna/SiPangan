import { store, fmt, clusterColor, makeTooltipHTML, createYearSelector, getYearData, CLUSTER_COLORS } from '../main.js';

export function renderClustering(panel) {
  panel.innerHTML = `
    <div class="flex-between mb-md">
      <h2 class="section-title">🔬 Clustering — UMAP + GMM (k=6)</h2>
      <div id="cl-year-sel"></div>
    </div>
    <div class="grid-2 mb-lg">
      <div class="card">
        <div class="card-header">Peta Cluster Ketahanan Pangan</div>
        <div class="card-body" style="padding:0"><div id="cl-map" class="map-container" style="height:420px"></div></div>
      </div>
      <div class="card">
        <div class="card-header">UMAP Embedding</div>
        <div class="card-body" style="padding:4px"><div id="cl-umap" style="height:420px"></div></div>
      </div>
    </div>
    <h3 class="section-title mb-md">📋 Profil Cluster</h3>
    <div class="cluster-grid mb-lg" id="cl-profiles"></div>
    <div class="grid-2 mb-lg">
      <div class="card">
        <div class="card-header">Distribusi Cluster per Tahun</div>
        <div class="card-body"><div id="cl-dist-chart" style="height:340px"></div></div>
      </div>
      <div class="card">
        <div class="card-header">Evaluasi Pemilihan k</div>
        <div class="card-body"><div id="cl-eval-chart" style="height:340px"></div></div>
      </div>
    </div>
    
    <div class="card mb-lg">
      <div class="card-header">Analisis Transisi Klaster (2021-2025)</div>
      <div class="card-body" style="padding:0">
        <div style="max-height: 400px; overflow-y: auto;">
          <table style="width:100%; border-collapse:collapse; font-size:12px; text-align:left;">
            <thead style="position:sticky; top:0; background:#f8fafc; box-shadow:0 1px 2px rgba(0,0,0,0.05); z-index:10;">
              <tr>
                <th style="padding:10px 16px; border-bottom:1px solid #e2e8f0; font-weight:600; color:#475569;">Provinsi</th>
                <th style="padding:10px 16px; border-bottom:1px solid #e2e8f0; font-weight:600; color:#475569;">2021</th>
                <th style="padding:10px 16px; border-bottom:1px solid #e2e8f0; font-weight:600; color:#475569;">2022</th>
                <th style="padding:10px 16px; border-bottom:1px solid #e2e8f0; font-weight:600; color:#475569;">2023</th>
                <th style="padding:10px 16px; border-bottom:1px solid #e2e8f0; font-weight:600; color:#475569;">2024</th>
                <th style="padding:10px 16px; border-bottom:1px solid #e2e8f0; font-weight:600; color:#475569;">2025</th>
                <th style="padding:10px 16px; border-bottom:1px solid #e2e8f0; font-weight:600; color:#475569;">Pola Transisi</th>
              </tr>
            </thead>
            <tbody id="cl-trans-table"></tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  createYearSelector(document.getElementById('cl-year-sel'), () => renderClustering(panel));
  buildClusterMap(store.year);
  buildUMAP();
  buildProfileCards();
  buildDistChart();
  buildEvalChart();
  buildTransitionTable();
}

function buildTransitionTable() {
  const { cluster_transitions } = store.data;
  const tbody = document.getElementById('cl-trans-table');
  
  if (!cluster_transitions || cluster_transitions.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:20px; color:#64748b;">Data transisi tidak tersedia</td></tr>';
    return;
  }
  
  const sortedData = [...cluster_transitions].sort((a, b) => {
    if (a.Pola_Transisi !== b.Pola_Transisi) return a.Pola_Transisi.localeCompare(b.Pola_Transisi);
    return a.Provinsi.localeCompare(b.Provinsi);
  });
  
  const renderCell = (val) => {
    if (!val) return '<td style="padding:8px 16px; border-bottom:1px solid #f1f5f9; color:#aaa">-</td>';
    const color = clusterColor(val);
    return `<td style="padding:8px 16px; border-bottom:1px solid #f1f5f9;"><span style="display:inline-block; padding:2px 8px; border-radius:12px; background:${color}20; border:1px solid ${color}60; color:${color}; font-size:10px; white-space:nowrap; font-weight:600;">${val}</span></td>`;
  };
  
  const renderPola = (val) => {
    let bg = '#f3f4f6', text = '#374151', border = '#e5e7eb';
    if (val.includes('Aman') || val.includes('Membaik')) { bg = '#dcfce7'; text = '#166534'; border = '#bbf7d0'; }
    if (val.includes('Rawan') || val.includes('Memburuk')) { bg = '#fee2e2'; text = '#991b1b'; border = '#fecaca'; }
    if (val.includes('Moderat')) { bg = '#fef9c3'; text = '#854d0e'; border = '#fef08a'; }
    return `<td style="padding:8px 16px; border-bottom:1px solid #f1f5f9;"><span style="padding:4px 8px; border-radius:6px; font-size:11px; font-weight:700; background:${bg}; color:${text}; border:1px solid ${border}; white-space:nowrap;">${val}</span></td>`;
  };

  tbody.innerHTML = sortedData.map((d, i) => `
    <tr style="background:${i % 2 === 0 ? '#fff' : '#fafafa'}; transition:background 0.2s;" onmouseover="this.style.background='#f0fdf4'" onmouseout="this.style.background='${i % 2 === 0 ? '#fff' : '#fafafa'}'">
      <td style="padding:8px 16px; border-bottom:1px solid #f1f5f9; font-weight:600; color:#1e293b;">${d.Provinsi}</td>
      ${renderCell(d.Name_2021)}
      ${renderCell(d.Name_2022)}
      ${renderCell(d.Name_2023)}
      ${renderCell(d.Name_2024)}
      ${renderCell(d.Name_2025)}
      ${renderPola(d.Pola_Transisi)}
    </tr>
  `).join('');
}

function buildClusterMap(year) {
  const { df_labeled, cluster_result, geojson_38 } = store.data;
  const map = L.map('cl-map', { scrollWheelZoom: true }).setView([-2.5, 118], 5);
  store.maps.cluster = map;

  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '© CARTO', maxZoom: 18
  }).addTo(map);

  const yearData = getYearData(df_labeled, year);
  const yearCluster = getYearData(cluster_result, year);

  function style(feature) {
    const dname = feature.properties.DATASET_NAME;
    const c = yearCluster.find(x => x.Provinsi === dname);
    return { fillColor: c ? clusterColor(c.Cluster_Name) : '#d9d9d9', weight: 1.5, color: '#fff', fillOpacity: 0.8 };
  }

  function onEach(feature, layer) {
    const dname = feature.properties.DATASET_NAME;
    const d = yearData.find(x => x.Provinsi === dname);
    const c = yearCluster.find(x => x.Provinsi === dname);
    layer.bindTooltip(makeTooltipHTML(dname, d, c), { sticky: true });
    layer.on({
      mouseover: e => { e.target.setStyle({ weight: 3, color: '#1e40af', fillOpacity: 1 }); e.target.bringToFront(); },
      mouseout: e => { geoLayer.resetStyle(e.target); }
    });
  }

  const geoLayer = L.geoJSON(geojson_38, { style, onEachFeature: onEach }).addTo(map);

  // Legend
  const legend = L.control({ position: 'bottomleft' });
  legend.onAdd = () => {
    const div = L.DomUtil.create('div', 'map-legend');
    div.innerHTML = '<h4>Cluster Ketahanan Pangan</h4>' +
      Object.entries(CLUSTER_COLORS).map(([name, color]) =>
        `<div class="legend-item"><div class="legend-dot" style="background:${color}"></div><span style="font-size:11px">${name}</span></div>`
      ).join('');
    return div;
  };
  legend.addTo(map);
}

function buildUMAP() {
  const { umap_coords } = store.data;
  const clusters = [...new Set(umap_coords.map(d => d.Cluster_Name))];
  const traces = clusters.map(name => {
    const pts = umap_coords.filter(d => d.Cluster_Name === name);
    return {
      x: pts.map(d => d.UMAP1), y: pts.map(d => d.UMAP2),
      text: pts.map(d => `${d.Provinsi} (${d.Tahun})`),
      mode: 'markers', type: 'scatter', name: name,
      marker: { color: clusterColor(name), size: 8, opacity: 0.75, line: { color: '#fff', width: 1 } },
      hovertemplate: '<b>%{text}</b><br>UMAP1: %{x:.2f}<br>UMAP2: %{y:.2f}<extra></extra>'
    };
  });

  const el = document.getElementById('cl-umap');
  store.charts.umap = el;
  Plotly.newPlot(el, traces, {
    xaxis: { title: 'UMAP 1', gridcolor: '#f0f0f0' },
    yaxis: { title: 'UMAP 2', gridcolor: '#f0f0f0' },
    plot_bgcolor: '#fafafa', paper_bgcolor: 'transparent',
    font: { family: 'Inter', size: 11 },
    legend: { orientation: 'h', y: -0.15, font: { size: 10 } },
    margin: { l: 50, r: 20, t: 10, b: 60 },
    hovermode: 'closest'
  }, { responsive: true, displayModeBar: false });
}

function buildProfileCards() {
  const { cluster_profiles, cluster_result, df_labeled } = store.data;
  const yearCluster = getYearData(cluster_result, store.year);
  const container = document.getElementById('cl-profiles');

  const descriptions = {
    "Kerawanan Tinggi": "Provinsi dengan kemiskinan tinggi, IPM rendah, dan ketahanan pangan kritis. Didominasi wilayah Papua, NTT, dan beberapa provinsi Sumatera.",
    "Transisi": "Provinsi dalam zona transisi — indikator menengah dengan potensi perbaikan atau penurunan. Perlu monitoring intensif.",
    "Ketergantungan Pangan": "Provinsi urban/industrial dengan PDRB tinggi tetapi minim lahan pertanian. Bergantung pada pasokan pangan dari luar daerah.",
    "Ketahanan Moderat": "Provinsi dengan ketahanan pangan moderat. Indikator sosial-ekonomi cukup baik namun belum optimal.",
    "Ketahanan Tinggi": "Provinsi dengan ketahanan pangan baik. SDM berkualitas, kemiskinan rendah, infrastruktur memadai.",
    "Lumbung Pangan Nasional": "Sentra produksi padi nasional dengan luas panen sangat tinggi. Pilar utama ketahanan pangan Indonesia."
  };

  // Key features to display with labels, formatting, and direction (↑ = higher is better)
  const features = [
    { key: 'IKP', label: 'IKP', dec: 1, good: 'high' },
    { key: 'IPM', label: 'IPM', dec: 1, good: 'high' },
    { key: 'Penduduk_Miskin', label: 'Kemiskinan (%)', dec: 1, good: 'low' },
    { key: 'PDRB_per_Kapita', label: 'PDRB/Kapita', dec: 0, good: 'high' },
    { key: 'Luas_Panen_Padi', label: 'Luas Panen (ha)', dec: 0, good: 'high' },
    { key: 'Akses_Air_Layak', label: 'Akses Air (%)', dec: 1, good: 'high' },
    { key: 'Akses_Listrik', label: 'Akses Listrik (%)', dec: 1, good: 'high' },
    { key: 'Produktivitas_Padi', label: 'Produktivitas Padi', dec: 1, good: 'high' },
  ];

  // Compute global min/max per feature for bar scaling
  const ranges = {};
  features.forEach(f => {
    const vals = cluster_profiles.map(p => p[f.key]).filter(v => v != null);
    ranges[f.key] = { min: Math.min(...vals), max: Math.max(...vals) };
  });

  const order = Object.keys(CLUSTER_COLORS);
  container.innerHTML = order.map(name => {
    const prof = cluster_profiles.find(p => p.Cluster_Name === name);
    if (!prof) return '';
    const members = yearCluster.filter(d => d.Cluster_Name === name);
    const color = clusterColor(name);

    const barsHTML = features.map(f => {
      const val = prof[f.key];
      const r = ranges[f.key];
      const pct = r.max > r.min ? ((val - r.min) / (r.max - r.min)) * 100 : 50;
      // Color: green if good direction matches high value, red if bad
      const isGood = f.good === 'high' ? pct > 60 : pct < 40;
      const isBad = f.good === 'high' ? pct < 35 : pct > 65;
      const barColor = isGood ? '#10b981' : isBad ? '#ef4444' : '#f59e0b';
      return `
        <div style="margin-bottom:6px">
          <div style="display:flex;justify-content:space-between;font-size:10px;margin-bottom:2px">
            <span style="color:var(--text-secondary)">${f.label}</span>
            <span style="font-weight:600">${fmt(val, f.dec)}</span>
          </div>
          <div style="height:6px;background:#f1f5f9;border-radius:3px;overflow:hidden">
            <div style="height:100%;width:${Math.max(pct, 4)}%;background:${barColor};border-radius:3px;transition:width .5s ease"></div>
          </div>
        </div>`;
    }).join('');

    const memberNames = members.map(d => d.Provinsi).sort().join(', ');

    return `
      <div class="cluster-card" data-cluster="${name}">
        <div class="cluster-card-header">
          <div class="cluster-color-dot" style="background:${color}"></div>
          <div>
            <div class="cluster-card-title">${name}</div>
            <div style="font-size:11px;color:var(--text-muted)">${members.length} provinsi (${store.year})</div>
          </div>
        </div>
        <div class="cluster-card-desc">${descriptions[name] || ''}</div>
        <div style="margin-bottom:10px">${barsHTML}</div>
        <div style="font-size:10px;color:var(--text-secondary);line-height:1.5;padding-top:8px;border-top:1px solid var(--border-light)">
          <strong style="color:var(--text)">Anggota:</strong> ${memberNames}
        </div>
      </div>`;
  }).join('');
}

function buildDistChart() {
  const { cluster_result } = store.data;
  const years = [2021, 2022, 2023, 2024, 2025];
  const names = Object.keys(CLUSTER_COLORS);
  const traces = names.map(name => ({
    x: years, y: years.map(y => cluster_result.filter(d => d.Tahun === y && d.Cluster_Name === name).length),
    name, type: 'bar', marker: { color: clusterColor(name) }
  }));

  const el = document.getElementById('cl-dist-chart');
  store.charts.dist = el;
  Plotly.newPlot(el, traces, {
    barmode: 'stack', xaxis: { title: 'Tahun', dtick: 1 },
    yaxis: { title: 'Jumlah Provinsi' },
    plot_bgcolor: '#fafafa', paper_bgcolor: 'transparent',
    font: { family: 'Inter', size: 11 },
    legend: { orientation: 'h', y: -0.2, font: { size: 9 } },
    margin: { l: 40, r: 10, t: 10, b: 80 }
  }, { responsive: true, displayModeBar: false });
}

function buildEvalChart() {
  const { cluster_evaluation } = store.data;
  const el = document.getElementById('cl-eval-chart');
  store.charts.eval = el;
  Plotly.newPlot(el, [
    { x: cluster_evaluation.map(d => d.k), y: cluster_evaluation.map(d => d.BIC),
      name: 'BIC', type: 'scatter', mode: 'lines+markers', marker: { color: '#3b82f6', size: 10 },
      yaxis: 'y' },
    { x: cluster_evaluation.map(d => d.k), y: cluster_evaluation.map(d => d.Silhouette),
      name: 'Silhouette', type: 'scatter', mode: 'lines+markers', marker: { color: '#ef4444', size: 10 },
      yaxis: 'y2' }
  ], {
    xaxis: { title: 'k (jumlah cluster)', dtick: 1 },
    yaxis: { title: 'BIC', side: 'left', titlefont: { color: '#3b82f6' } },
    yaxis2: { title: 'Silhouette', side: 'right', overlaying: 'y', titlefont: { color: '#ef4444' } },
    plot_bgcolor: '#fafafa', paper_bgcolor: 'transparent',
    font: { family: 'Inter', size: 11 },
    legend: { orientation: 'h', y: -0.2 },
    margin: { l: 60, r: 60, t: 10, b: 60 }
  }, { responsive: true, displayModeBar: false });
}
