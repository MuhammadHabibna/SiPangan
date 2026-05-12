export function renderAbout(panel) {
  panel.innerHTML = `
    <div class="flex-between mb-md">
      <h2 class="section-title">ℹ️ Tentang SIPANGAN</h2>
    </div>

    <div class="card mb-lg">
      <div class="card-header">🏗️ Arsitektur Sistem Analitik</div>
      <div class="card-body">
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:16px;text-align:center">
          ${[
            { icon: '🔬', title: 'Layer 1', sub: 'Clustering', desc: 'PCA + UMAP + GMM Hybrid', color: '#3b82f6', status: '✅ Selesai' },
            { icon: '🗺️', title: 'Layer 2', sub: 'GWR', desc: 'Geographically Weighted Regression', color: '#10b981', status: '✅ Selesai' },
            { icon: '📈', title: 'Layer 3', sub: 'Forecasting', desc: 'Ensemble (XGBoost + RF)', color: '#f59e0b', status: '✅ Selesai' },
            { icon: '🎯', title: 'Layer 4', sub: 'LISA', desc: "Moran's I + Local Indicators", color: '#ef4444', status: '✅ Selesai' },
          ].map(l => `
            <div style="background:${l.color}08;border:2px solid ${l.color}30;border-radius:var(--radius);padding:20px;transition:transform var(--transition)" onmouseover="this.style.transform='translateY(-4px)'" onmouseout="this.style.transform='none'">
              <div style="font-size:32px;margin-bottom:8px">${l.icon}</div>
              <div style="font-weight:700;font-size:14px">${l.title}</div>
              <div style="font-weight:600;color:${l.color};font-size:13px;margin-bottom:4px">${l.sub}</div>
              <div style="font-size:11px;color:var(--text-secondary);margin-bottom:8px">${l.desc}</div>
              <div style="font-size:11px;font-weight:600">${l.status}</div>
            </div>
          `).join('')}
        </div>
        <div style="text-align:center;margin-top:20px;padding:16px;background:var(--primary-50);border-radius:var(--radius-sm)">
          <span style="font-size:24px">⬇️</span>
          <div style="font-weight:700;margin-top:4px">Integrasi → Priority Score → Dashboard SIPANGAN</div>
        </div>
      </div>
    </div>

    <div class="grid-3 mb-lg">
      <div class="card">
        <div class="card-body" style="text-align:center;padding:28px">
          <div style="width:72px;height:72px;border-radius:50%;background:linear-gradient(135deg,#3b82f6,#1e40af);margin:0 auto 12px;display:flex;align-items:center;justify-content:center;font-size:28px;color:#fff">H</div>
          <div style="font-weight:700;font-size:16px">Habib</div>
          <div style="font-size:12px;color:var(--primary);font-weight:600;margin-bottom:8px">Data Engineer & Integration</div>
          <div style="font-size:11px;color:var(--text-secondary)">Preprocessing, Clustering, Dashboard, RAG Integration</div>
        </div>
      </div>
      <div class="card">
        <div class="card-body" style="text-align:center;padding:28px">
          <div style="width:72px;height:72px;border-radius:50%;background:linear-gradient(135deg,#10b981,#059669);margin:0 auto 12px;display:flex;align-items:center;justify-content:center;font-size:28px;color:#fff">N</div>
          <div style="font-weight:700;font-size:16px">Nazril</div>
          <div style="font-size:12px;color:#10b981;font-weight:600;margin-bottom:8px">Spatial & Predictive Analytics</div>
          <div style="font-size:11px;color:var(--text-secondary)">LISA (Moran's I), Forecasting Ensemble, Analisis Spasial</div>
        </div>
      </div>
      <div class="card">
        <div class="card-body" style="text-align:center;padding:28px">
          <div style="width:72px;height:72px;border-radius:50%;background:linear-gradient(135deg,#f59e0b,#d97706);margin:0 auto 12px;display:flex;align-items:center;justify-content:center;font-size:28px;color:#fff">N</div>
          <div style="font-weight:700;font-size:16px">Noel</div>
          <div style="font-size:12px;color:#f59e0b;font-weight:600;margin-bottom:8px">Spatial Regression</div>
          <div style="font-size:11px;color:var(--text-secondary)">GWR Implementation, Koefisien Lokal, R² Analysis</div>
        </div>
      </div>
    </div>

    <div class="grid-2">
      <div class="card">
        <div class="card-header">📊 Sumber Data</div>
        <div class="card-body">
          <table class="rank-table">
            <tbody>
              <tr><td style="font-weight:600">Sumber</td><td>Badan Pusat Statistik (BPS) Indonesia</td></tr>
              <tr><td style="font-weight:600">Periode</td><td>2021 — 2025 (5 tahun panel)</td></tr>
              <tr><td style="font-weight:600">Cakupan</td><td>38 Provinsi (termasuk 4 pemekaran Papua 2024)</td></tr>
              <tr><td style="font-weight:600">Fitur</td><td>12 indikator + IKP + 2 indeks komposit</td></tr>
              <tr><td style="font-weight:600">Observasi</td><td>178 baris (34×3 + 38×2)</td></tr>
            </tbody>
          </table>
        </div>
      </div>
      <div class="card">
        <div class="card-header">🛠️ Tech Stack</div>
        <div class="card-body">
          <div style="display:flex;flex-wrap:wrap;gap:8px">
            ${['Python','UMAP','GMM','GWR','PySAL','XGBoost','Random Forest','Elastic Net','Vite','Leaflet.js','Plotly.js','Pandas','Scikit-learn'].map(t =>
              `<span style="padding:4px 12px;background:var(--primary-50);color:var(--primary);border-radius:20px;font-size:11px;font-weight:600">${t}</span>`
            ).join('')}
          </div>
        </div>
      </div>
    </div>

    <div style="text-align:center;margin-top:40px;padding:24px;color:var(--text-muted);font-size:12px">
      <p>🌾 <strong>SIPANGAN</strong> — UNITY #14 • Universitas Negeri Yogyakarta</p>
      <p style="margin-top:4px">Perlombaan Data Mining UNESA 2026</p>
    </div>
  `;
}
