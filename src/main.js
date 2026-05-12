/* ============================================================
   SIPANGAN — Main Entry Point
   ============================================================ */
import './styles.css';
import { renderOverview } from './tabs/overview.js';
import { renderClustering } from './tabs/clustering.js';
import { renderGWR } from './tabs/gwr.js';
import { renderLISA } from './tabs/lisa.js';
import { renderForecast } from './tabs/forecast.js';
import { renderAbout } from './tabs/about.js';
import { askKimi, getInitialMessages } from './ai/kimi.js';

// ── Data Store ──
export const store = { data: {}, maps: {}, charts: {}, year: 2025 };

// ── Color Config ──
export const CLUSTER_COLORS = {
  "Kerawanan Tinggi": "#d73027",
  "Transisi": "#fee08b",
  "Ketergantungan Pangan": "#4575b4",
  "Ketahanan Moderat": "#a6d96a",
  "Ketahanan Tinggi": "#66bd63",
  "Lumbung Pangan Nasional": "#1a9850",
};

export const LISA_COLORS = {
  "HH": "#d73027", "LL": "#4575b4", "HL": "#fc8d59",
  "LH": "#91bfdb", "NS": "#e0e0e0"
};

// ── Data Loader ──
const cache = {};
export async function loadJSON(name) {
  if (cache[name]) return cache[name];
  const res = await fetch(`/data/${name}`);
  cache[name] = await res.json();
  return cache[name];
}

async function loadAllData() {
  const files = [
    'cluster_result.json', 'cluster_profiles.json', 'cluster_transitions.json',
    'umap_coords.json', 'df_labeled.json', 'geojson_38.json', 'name_map.json',
    'gwr_result.json', 'lisa_result.json', 'forecast_result.json', 'priority_score.json',
    'cluster_evaluation.json'
  ];
  const results = await Promise.all(files.map(f => loadJSON(f)));
  const keys = files.map(f => f.replace('.json', ''));
  keys.forEach((k, i) => store.data[k] = results[i]);
}

// ── Utilities ──
export function fmt(n, dec = 1) {
  if (n == null || isNaN(n)) return '—';
  return Number(n).toLocaleString('id-ID', { maximumFractionDigits: dec });
}

export function animateValue(el, end, duration = 800, dec = 1) {
  const start = 0;
  const startTime = performance.now();
  function update(now) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    el.textContent = fmt(start + (end - start) * eased, dec);
    if (progress < 1) requestAnimationFrame(update);
    else el.textContent = fmt(end, dec);
  }
  requestAnimationFrame(update);
}

export function getYearData(dataset, year) {
  return dataset.filter(d => d.Tahun === year);
}

export function getProvData(dataset, prov, year) {
  return dataset.find(d => d.Provinsi === prov && d.Tahun === year);
}

export function clusterColor(name) {
  return CLUSTER_COLORS[name] || '#999';
}

export function makeTooltipHTML(prov, data, clusterData) {
  const color = clusterData ? clusterColor(clusterData.Cluster_Name) : '#999';
  const clusterName = clusterData?.Cluster_Name || '—';
  return `
    <div class="prov-tooltip">
      <div class="tip-name">${prov}</div>
      <div class="tip-cluster"><span class="dot" style="background:${color}"></span>${clusterName}</div>
      <hr class="tip-divider">
      <div class="tip-row"><span class="label">IKP</span><span class="value">${fmt(data?.IKP)}</span></div>
      <div class="tip-row"><span class="label">Penduduk Miskin</span><span class="value">${fmt(data?.Penduduk_Miskin)}%</span></div>
      <div class="tip-row"><span class="label">IPM</span><span class="value">${fmt(data?.IPM)}</span></div>
      <div class="tip-row"><span class="label">PDRB/Kapita</span><span class="value">${fmt(data?.PDRB_per_Kapita, 0)}</span></div>
      <div class="tip-row"><span class="label">Akses Air Layak</span><span class="value">${fmt(data?.Akses_Air_Layak)}%</span></div>
    </div>`;
}

export function createYearSelector(container, onChange) {
  const years = [2021, 2022, 2023, 2024, 2025];
  const div = document.createElement('div');
  div.className = 'year-selector';
  years.forEach(y => {
    const btn = document.createElement('button');
    btn.className = `year-pill${y === store.year ? ' active' : ''}`;
    btn.textContent = y;
    btn.onclick = () => {
      div.querySelectorAll('.year-pill').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      store.year = y;
      onChange(y);
    };
    div.appendChild(btn);
  });
  container.appendChild(div);
}

// ── Tab Router ──
const TABS = {
  overview: renderOverview,
  clustering: renderClustering,
  gwr: renderGWR,
  lisa: renderLISA,
  forecast: renderForecast,
  about: renderAbout,
};

let currentTab = 'overview';

function switchTab(tab) {
  if (!TABS[tab]) return;
  currentTab = tab;

  // Destroy any existing leaflet maps and plotly charts
  Object.values(store.maps).forEach(m => { try { m.remove(); } catch(e){} });
  store.maps = {};
  Object.keys(store.charts).forEach(k => {
    try { Plotly.purge(store.charts[k]); } catch(e){}
  });
  store.charts = {};

  // Update nav
  document.querySelectorAll('.tab-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.tab === tab);
  });

  // Render tab
  const content = document.getElementById('tab-content');
  content.innerHTML = '';
  const panel = document.createElement('div');
  panel.className = 'tab-panel';
  content.appendChild(panel);
  TABS[tab](panel);
}

// ── AI Chatbot Logic ──
let chatMessages = [];
let isChatProcessing = false;

function setupAI() {
  const widget = document.getElementById('ai-chat-widget');
  const fab = document.getElementById('ai-fab');
  const closeBtn = document.getElementById('ai-close-btn');
  const sendBtn = document.getElementById('ai-send-btn');
  const input = document.getElementById('ai-input');
  const msgContainer = document.getElementById('ai-messages');
  const suggBtns = document.querySelectorAll('.ai-sugg-btn');

  // Load initial prompt
  chatMessages = getInitialMessages();

  // Toggle chat
  fab.onclick = () => {
    widget.classList.toggle('ai-widget-closed');
    if (!widget.classList.contains('ai-widget-closed')) {
      input.focus();
    }
  };
  closeBtn.onclick = () => widget.classList.add('ai-widget-closed');

  function renderMessage(content, role) {
    const div = document.createElement('div');
    div.className = `ai-msg ai-msg-${role === 'user' ? 'user' : 'system'}`;
    div.innerHTML = role === 'system' && window.marked ? marked.parse(content) : content;
    msgContainer.appendChild(div);
    msgContainer.scrollTop = msgContainer.scrollHeight;
    return div;
  }

  function addLoadingBubble() {
    const div = document.createElement('div');
    div.className = 'ai-msg-loading';
    div.innerHTML = '<div class="ai-dot"></div><div class="ai-dot"></div><div class="ai-dot"></div>';
    msgContainer.appendChild(div);
    msgContainer.scrollTop = msgContainer.scrollHeight;
    return div;
  }

  async function handleSend(text) {
    if (!text.trim() || isChatProcessing) return;
    
    isChatProcessing = true;
    input.value = '';
    input.disabled = true;
    sendBtn.disabled = true;

    // Add user message
    renderMessage(text, 'user');
    chatMessages.push({ role: 'user', content: text });

    const loadingDiv = addLoadingBubble();
    let assistantMsgDiv = null;
    let fullResponse = "";

    await askKimi(chatMessages, 
      (chunk) => {
        if (loadingDiv.parentNode) loadingDiv.remove();
        if (!assistantMsgDiv) {
          assistantMsgDiv = renderMessage("", "system");
        }
        fullResponse += chunk;
        assistantMsgDiv.innerHTML = window.marked ? marked.parse(fullResponse) : fullResponse;
        msgContainer.scrollTop = msgContainer.scrollHeight;
      },
      (finalText) => {
        if (loadingDiv.parentNode) loadingDiv.remove();
        chatMessages.push({ role: 'assistant', content: finalText });
        isChatProcessing = false;
        input.disabled = false;
        sendBtn.disabled = false;
        input.focus();
      },
      (err) => {
        if (loadingDiv.parentNode) loadingDiv.remove();
        renderMessage(`❌ Maaf, terjadi kesalahan: ${err}`, "system");
        isChatProcessing = false;
        input.disabled = false;
        sendBtn.disabled = false;
      }
    );
  }

  sendBtn.onclick = () => handleSend(input.value);
  input.onkeypress = (e) => { if (e.key === 'Enter') handleSend(input.value); };

  suggBtns.forEach(btn => {
    btn.onclick = () => {
      handleSend(btn.textContent);
    };
  });
}

// ── Init ──
async function init() {
  const bootLines = [
    "> Mengunduh data panel 38 Provinsi... [OK]",
    "> Menjalankan reduksi dimensi PCA + UMAP... [OK]",
    "> Menginisiasi klastering GMM k=6... [OK]",
    "> Memuat model Ensemble Forecasting... [OK]",
    "> Merender visualisasi spasial GWR & LISA... [OK]",
    "> SYSTEM READY."
  ];
  
  const terminal = document.getElementById('boot-terminal');
  const bootBtn = document.getElementById('boot-btn');
  const bootScreen = document.getElementById('boot-sequence');
  const execModal = document.getElementById('exec-modal');
  const execStartBtn = document.getElementById('exec-start-btn');
  
  const typeLines = async () => {
    for (let line of bootLines) {
      const div = document.createElement('div');
      div.className = 'boot-line';
      div.textContent = line;
      terminal.appendChild(div);
      await new Promise(r => setTimeout(r, 450)); // typing delay
    }
  };

  try {
    // Run typing and data loading concurrently
    await Promise.all([
      loadAllData(),
      typeLines()
    ]);

    bootBtn.style.display = 'block';

    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });
    setupAI();
    switchTab('overview');

    // Flow: Boot -> Exec Modal -> Dashboard
    bootBtn.onclick = () => {
      bootScreen.classList.add('hidden');
      setTimeout(() => {
        execModal.classList.remove('hidden');
      }, 800);
    };

    execStartBtn.onclick = () => {
      execModal.classList.add('hidden');
      setTimeout(() => {
        const widget = document.getElementById('ai-chat-widget');
        widget.classList.remove('ai-widget-closed');
      }, 800);
    };

  } catch (err) {
    console.error('Failed to load data:', err);
    terminal.innerHTML += `<div style="color:#ef4444;margin-top:10px;">> FATAL ERROR: ${err.message}</div>`;
    document.getElementById('tab-content').innerHTML = `
      <div class="loading-screen"><p style="color:#d73027">❌ Gagal memuat data: ${err.message}</p></div>`;
  }
}

init();
