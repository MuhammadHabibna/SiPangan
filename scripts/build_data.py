"""
Build JSON data files for the dashboard from CSV outputs.
Run from dashboard/ dir: python scripts/build_data.py
"""
import pandas as pd, json, os, shutil, numpy as np

ROOT = os.path.join(os.path.dirname(__file__), "..", "..")
OUT = os.path.join(ROOT, "output")
GEO = os.path.join(ROOT, "geojson")
DATA = os.path.join(os.path.dirname(__file__), "..", "public", "data")
os.makedirs(DATA, exist_ok=True)

# === Name mapping: Dataset UPPERCASE → GeoJSON38 Title Case ===
MAP = {
    "ACEH":"Aceh","SUMATERA UTARA":"Sumatera Utara","SUMATERA BARAT":"Sumatera Barat",
    "RIAU":"Riau","JAMBI":"Jambi","SUMATERA SELATAN":"Sumatera Selatan",
    "BENGKULU":"Bengkulu","LAMPUNG":"Lampung",
    "KEP. BANGKA BELITUNG":"Kepulauan Bangka Belitung","KEP. RIAU":"Kepulauan Riau",
    "DKI JAKARTA":"DKI Jakarta","JAWA BARAT":"Jawa Barat","JAWA TENGAH":"Jawa Tengah",
    "DI YOGYAKARTA":"Daerah Istimewa Yogyakarta","JAWA TIMUR":"Jawa Timur",
    "BANTEN":"Banten","BALI":"Bali","NUSA TENGGARA BARAT":"Nusa Tenggara Barat",
    "NUSA TENGGARA TIMUR":"Nusa Tenggara Timur","KALIMANTAN BARAT":"Kalimantan Barat",
    "KALIMANTAN TENGAH":"Kalimantan Tengah","KALIMANTAN SELATAN":"Kalimantan Selatan",
    "KALIMANTAN TIMUR":"Kalimantan Timur","KALIMANTAN UTARA":"Kalimantan Utara",
    "SULAWESI UTARA":"Sulawesi Utara","SULAWESI TENGAH":"Sulawesi Tengah",
    "SULAWESI SELATAN":"Sulawesi Selatan","SULAWESI TENGGARA":"Sulawesi Tenggara",
    "GORONTALO":"Gorontalo","SULAWESI BARAT":"Sulawesi Barat",
    "MALUKU":"Maluku","MALUKU UTARA":"Maluku Utara",
    "PAPUA BARAT":"Papua Barat","PAPUA":"Papua",
    "PAPUA BARAT DAYA":"Papua Barat Daya","PAPUA SELATAN":"Papua Selatan",
    "PAPUA TENGAH":"Papua Tengah","PAPUA PEGUNUNGAN":"Papua Pegunungan",
}
REV = {v:k for k,v in MAP.items()}

def csv_to_json(csv_path, json_name):
    df = pd.read_csv(csv_path)
    df.to_json(os.path.join(DATA, json_name), orient="records", force_ascii=False, indent=2)
    print(f"  {json_name} ({len(df)} rows)")

print("=== Building dashboard data ===\n[1] Converting CSVs...")
csv_to_json(os.path.join(OUT, "layer1", "cluster_result.csv"), "cluster_result.json")
csv_to_json(os.path.join(OUT, "layer1", "cluster_profiles.csv"), "cluster_profiles.json")
csv_to_json(os.path.join(OUT, "layer1", "cluster_transitions.csv"), "cluster_transitions.json")
csv_to_json(os.path.join(OUT, "layer1", "umap_coords.csv"), "umap_coords.json")
csv_to_json(os.path.join(OUT, "layer1", "cluster_evaluation.csv"), "cluster_evaluation.json")
csv_to_json(os.path.join(OUT, "df_clean_labeled.csv"), "df_labeled.json")

print("\n[2] Enriching GeoJSON...")
with open(os.path.join(GEO, "indonesia_38prov.geojson"), "r", encoding="utf-8") as f:
    geo = json.load(f)

df = pd.read_csv(os.path.join(OUT, "df_clean_labeled.csv"))

for feat in geo["features"]:
    gname = feat["properties"].get("PROVINSI","")
    dname = REV.get(gname, gname.upper())
    feat["properties"]["DATASET_NAME"] = dname

with open(os.path.join(DATA, "geojson_38.json"), "w", encoding="utf-8") as f:
    json.dump(geo, f, ensure_ascii=False)
print(f"  geojson_38.json ({len(geo['features'])} features)")

# Save name mapping
with open(os.path.join(DATA, "name_map.json"), "w", encoding="utf-8") as f:
    json.dump({"to_geo": MAP, "to_dataset": REV}, f, ensure_ascii=False, indent=2)

print("\n[3] Generating placeholders...")

# --- GWR placeholder ---
np.random.seed(42)
provs_25 = df[df["Tahun"]==2025]["Provinsi"].tolist()
gwr_features = ["TPT","Penduduk_Miskin","PDRB_per_Kapita","Luas_Panen_Padi","Akses_Air_Layak"]
gwr_rows = []
for yr in [2021,2022,2023,2024,2025]:
    provs = df[df["Tahun"]==yr]["Provinsi"].tolist()
    for p in provs:
        row = {"Provinsi":p, "Tahun":yr, "R2_Lokal": round(np.random.uniform(0.5,0.95),3)}
        dominant_idx = np.random.randint(0, len(gwr_features))
        for i,feat in enumerate(gwr_features):
            coef = round(np.random.normal(0, 0.5), 4)
            if i == dominant_idx: coef = round(np.random.choice([-1,1]) * np.random.uniform(0.5,1.5), 4)
            row[f"coef_{feat}"] = coef
        row["Faktor_Dominan"] = gwr_features[dominant_idx]
        gwr_rows.append(row)

with open(os.path.join(DATA, "gwr_result.json"), "w", encoding="utf-8") as f:
    json.dump(gwr_rows, f, ensure_ascii=False, indent=2)
print(f"  gwr_result.json ({len(gwr_rows)} rows) [PLACEHOLDER]")

# --- LISA placeholder ---
quadrants = ["HH","LL","HL","LH","NS"]
lisa_rows = []
for yr in [2021,2022,2023,2024,2025]:
    provs = df[df["Tahun"]==yr]["Provinsi"].tolist()
    for p in provs:
        sub = df[(df["Provinsi"]==p)&(df["Tahun"]==yr)]
        ikp = sub["IKP"].values[0] if len(sub)>0 else 70
        # Weight quadrant by IKP
        if ikp < 65: weights = [0.1,0.5,0.1,0.1,0.2]
        elif ikp < 73: weights = [0.15,0.25,0.15,0.15,0.3]
        else: weights = [0.4,0.05,0.15,0.15,0.25]
        q = np.random.choice(quadrants, p=weights)
        lisa_rows.append({
            "Provinsi":p,"Tahun":yr,
            "LISA_Quadrant":q,
            "LISA_I": round(np.random.uniform(-0.5,1.5),4),
            "LISA_P_Value": round(np.random.uniform(0.001,0.2),4),
            "Signifikan": q != "NS",
            "Moran_I_Global": round(np.random.uniform(0.2,0.6),4),
            "P_Value_Global": round(np.random.uniform(0.001,0.05),4)
        })

with open(os.path.join(DATA, "lisa_result.json"), "w", encoding="utf-8") as f:
    json.dump(lisa_rows, f, ensure_ascii=False, indent=2)
print(f"  lisa_result.json ({len(lisa_rows)} rows) [PLACEHOLDER]")

# --- Forecast placeholder ---
forecast_rows = []
for p in provs_25:
    sub = df[df["Provinsi"]==p].sort_values("Tahun")
    ikps = sub["IKP"].values
    if len(ikps) >= 2:
        trend = (ikps[-1] - ikps[0]) / max(len(ikps)-1, 1)
    else:
        trend = 0
    last_ikp = ikps[-1] if len(ikps)>0 else 70
    for yr_pred in [2026, 2027]:
        pred = last_ikp + trend * (yr_pred - 2025) + np.random.normal(0, 1)
        ci_w = np.random.uniform(3, 6)
        delta = pred - last_ikp
        tren = "Membaik" if delta > 2 else ("Memburuk" if delta < -2 else "Stagnan")
        forecast_rows.append({
            "Provinsi":p, "Tahun_Pred":yr_pred,
            "IKP_Pred": round(pred,2), "CI_Lower": round(pred-ci_w,2), "CI_Upper": round(pred+ci_w,2),
            "Tren":tren, "W_XGB": round(np.random.uniform(0.2,0.5),3),
            "W_RF": round(np.random.uniform(0.2,0.4),3), "W_EN": round(np.random.uniform(0.1,0.3),3)
        })

with open(os.path.join(DATA, "forecast_result.json"), "w", encoding="utf-8") as f:
    json.dump(forecast_rows, f, ensure_ascii=False, indent=2)
print(f"  forecast_result.json ({len(forecast_rows)} rows) [PLACEHOLDER]")

# --- Priority Score placeholder ---
priority_rows = []
for yr in [2021,2022,2023,2024,2025]:
    provs = df[df["Tahun"]==yr]["Provinsi"].tolist()
    for p in provs:
        sub = df[(df["Provinsi"]==p)&(df["Tahun"]==yr)]
        ikp = sub["IKP"].values[0] if len(sub)>0 else 70
        cluster_risk = round(max(0, min(1, (80 - ikp) / 50)), 3)
        lisa_risk = round(np.random.uniform(0, 1), 3)
        forecast_risk = round(np.random.uniform(0, 1), 3)
        ps = round(0.4*cluster_risk + 0.3*lisa_risk + 0.3*forecast_risk, 3)
        priority_rows.append({
            "Provinsi":p, "Tahun":yr,
            "cluster_risk":cluster_risk, "lisa_risk":lisa_risk, "forecast_risk":forecast_risk,
            "Priority_Score":ps
        })

# Rank per year
for yr in [2021,2022,2023,2024,2025]:
    yr_rows = [r for r in priority_rows if r["Tahun"]==yr]
    yr_rows.sort(key=lambda x: x["Priority_Score"], reverse=True)
    for i,r in enumerate(yr_rows):
        r["Ranking"] = i+1

with open(os.path.join(DATA, "priority_score.json"), "w", encoding="utf-8") as f:
    json.dump(priority_rows, f, ensure_ascii=False, indent=2)
print(f"  priority_score.json ({len(priority_rows)} rows) [PLACEHOLDER]")

print("\n=== Done! All data in public/data/ ===")
