import os
import json
import pandas as pd
import numpy as np
import requests
from sklearn.linear_model import LinearRegression
from datetime import timedelta
from pymongo import MongoClient

# === MongoDB Config ===
MONGO_URL = "mongodb://localhost:27018/"
DB_NAME = "noaa_database"
COLLECTION_NAME = "forecast_lstm_27day"

# === NOAA URL ===
NOAA_URL = "https://services.swpc.noaa.gov/text/27-day-outlook.txt"

# --- Step 1: Fetch latest NOAA TXT ---
def fetch_noaa():
    try:
        res = requests.get(NOAA_URL, timeout=10)
        res.raise_for_status()
        return res.text
    except:
        return ""

# --- Step 2: Parse NOAA TXT ---
def parse_noaa(txt):
    data = []
    for line in txt.splitlines():
        if line.strip() == "" or line.startswith(":") or line.startswith("#"):
            continue
        parts = line.split()
        if len(parts) >= 6:
            try:
                date = pd.to_datetime(f"{parts[0]} {parts[1]} {parts[2]}")
                rf = int(parts[3])
                ai = int(parts[4])
                kp = int(parts[5])
                data.append([date, rf, ai, kp])
            except:
                continue
    return pd.DataFrame(data, columns=["date", "radio_flux", "a_index", "kp_index"])

# --- Step 3: Get historical data from MongoDB ---
def get_historical():
    client = MongoClient(MONGO_URL)
    db = client[DB_NAME]
    coll = db[COLLECTION_NAME]
    docs = list(coll.find({}, {"_id": 0}))
    client.close()
    if len(docs) == 0:
        return pd.DataFrame(columns=["date", "radio_flux", "a_index", "kp_index"])
    return pd.DataFrame(docs)

# --- Step 4: Merge historical + latest NOAA ---
def merge_data(historical, latest):
    if not historical.empty:
        historical['date'] = pd.to_datetime(historical['date'])
    latest['date'] = pd.to_datetime(latest['date'])
    df = pd.concat([historical, latest])
    df = df.drop_duplicates(subset="date").sort_values("date").reset_index(drop=True)
    df[['radio_flux', 'a_index', 'kp_index']] = df[['radio_flux', 'a_index', 'kp_index']].interpolate(method='linear').bfill().ffill()
    return df

# --- Step 5: Linear Regression Forecast ---
def forecast_linear(df, latest_noaa, days=27):
    results = []
    X = np.arange(len(df)).reshape(-1,1)

    # Predict each column separately
    preds = {}
    for col in ['radio_flux', 'a_index', 'kp_index']:
        y = df[col].values
        model = LinearRegression()
        model.fit(X, y)
        future_X = np.arange(len(df), len(df)+days).reshape(-1,1)
        preds[col] = model.predict(future_X)

    # Use latest NOAA date as starting point
    last_date = latest_noaa['date'].max()
    for i in range(days):
        fdate = (last_date + timedelta(days=i+1)).date().isoformat()
        results.append({
            "date": fdate,
            "radio_flux": int(round(preds['radio_flux'][i])),
            "a_index": int(round(preds['a_index'][i])),
            "kp_index": int(round(preds['kp_index'][i]))
        })
    return results

# === MAIN ===
latest_txt = fetch_noaa()
latest_noaa = parse_noaa(latest_txt)
historical = get_historical()
all_data = merge_data(historical, latest_noaa)

if all_data.empty or all_data.shape[0] < 10:
    print("[]")
    exit(0)

predictions = forecast_linear(all_data, latest_noaa, days=27)
print(json.dumps(predictions))
