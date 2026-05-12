import { store } from '../main.js';

const SYSTEM_PROMPT = `Anda adalah SIPANGAN AI, asisten analis ketahanan pangan profesional dari Tim UNITY UNESA.
Tugas Anda adalah memberikan insight, analisis naratif, dan menjawab pertanyaan terkait status ketahanan pangan provinsi di Indonesia berdasarkan data analitik yang diberikan.

Gaya bahasa:
- Formal, analitis, dan profesional.
- Gunakan bahasa Indonesia yang baik dan benar.
- Jika ditanya tentang prediksi, berikan peringatan bahwa ini adalah model ensemble (XGBoost + Random Forest + Elastic Net).
- JANGAN mengarang data. Gunakan HANYA data yang disediakan di bawah ini. Jika data tidak ada, katakan Anda tidak memiliki data tersebut.

=== DATA KETAHANAN PANGAN INDONESIA (SIPANGAN 2025 & PREDIKSI) ===
[DATA_TABLE_PLACEHOLDER]
`;

/**
 * Builds a highly condensed markdown table from the global store
 * to be injected into the system prompt.
 */
function buildContextData() {
  if (!store || !store.data || !store.data.df_labeled) return "Data belum tersedia.";

  // Get 2025 data as baseline
  const df25 = store.data.df_labeled.filter(d => d.Tahun === 2025);
  const cluster25 = store.data.cluster_result.filter(d => d.Tahun === 2025);
  const gwr25 = store.data.gwr_result.filter(d => d.Tahun === 2025);
  const lisa25 = store.data.lisa_result.filter(d => d.Tahun === 2025);
  const forecast = store.data.forecast_result.filter(d => d.Tahun_Pred === 2027);

  let table = "Provinsi | IKP_2025 | Klaster_2025 | Faktor_GWR_Dominan | LISA_2025 | Prediksi_IKP_2027 | Tren\n";
  table += "---|---|---|---|---|---|---\n";

  df25.forEach(d => {
    const p = d.Provinsi;
    const c = cluster25.find(x => x.Provinsi === p)?.Cluster || "-";
    const g = gwr25.find(x => x.Provinsi === p)?.Faktor_Dominan || "-";
    const l = lisa25.find(x => x.Provinsi === p)?.LISA_Quadrant || "-";
    const f = forecast.find(x => x.Provinsi === p);
    
    const predIKP = f ? f.IKP_Pred.toFixed(2) : "-";
    const tren = f ? f.Tren : "-";

    table += `${p} | ${d.IKP.toFixed(2)} | ${c} | ${g} | ${l} | ${predIKP} | ${tren}\n`;
  });

  return table;
}

/**
 * Streams response from AkashML Kimi K2.6
 */
export async function askKimi(messages, onChunk, onComplete, onError) {
  const apiKey = import.meta.env.VITE_AKASH_API_KEY;
  if (!apiKey) {
    onError("API Key tidak ditemukan. Pastikan file .env sudah diatur.");
    return;
  }

  try {
    // Inject context only into the first system message
    const finalMessages = messages.map(m => {
      if (m.role === 'system') {
        return {
          role: 'system',
          content: m.content.replace('[DATA_TABLE_PLACEHOLDER]', buildContextData())
        };
      }
      return m;
    });

    const response = await fetch('https://api.akashml.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'moonshotai/Kimi-K2.6',
        messages: finalMessages,
        stream: true,
        temperature: 0.3 // low temp for analytical accuracy
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let fullText = "";
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop(); // Keep incomplete line in buffer
      
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed === "") continue;
        if (trimmed === "data: [DONE]") continue;

        if (trimmed.startsWith("data: ")) {
          try {
            const parsed = JSON.parse(trimmed.slice(6));
            if (parsed.choices && parsed.choices[0].delta && parsed.choices[0].delta.content) {
              const text = parsed.choices[0].delta.content;
              fullText += text;
              onChunk(text);
            }
          } catch (e) {
            console.warn("Stream parse error:", e, trimmed);
          }
        }
      }
    }
    
    if (onComplete) onComplete(fullText);

  } catch (error) {
    console.error("Kimi API Error:", error);
    if (onError) onError(error.message);
  }
}

export function getInitialMessages() {
  return [
    { role: 'system', content: SYSTEM_PROMPT }
  ];
}
