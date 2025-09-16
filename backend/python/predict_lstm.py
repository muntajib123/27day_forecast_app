# backend/python/predict_lstm.py
import os
import sys
import json
import numpy as np
import pandas as pd
import requests
from datetime import timedelta
from pymongo import MongoClient
from sklearn.preprocessing import MinMaxScaler
from tensorflow.keras.models import Sequential, load_model
from tensorflow.keras.layers import LSTM, Dense, Dropout
import joblib

# === Config ===
MONGO_URL = "mongodb://localhost:27018/"
DB_NAME = "noaa_database"
COLLECTION_NAME = "forecast_lstm_27day"
NOAA_URL = "https://services.swpc.noaa.gov/text/27-day-outlook.txt"
PRED_DAYS = 27
MODEL_FILE = os.path.join(os.path.dirname(__file__), "trained_lstm.h5")
SCALER_FILE = os.path.join(os.path.dirname(__file__), "scaler.save")

# ======================== Data Utils ========================
def fetch_noaa():
    """Download NOAA 27-day forecast text"""
    try:
        r = requests.get(NOAA_URL, timeout=10)
        r.raise_for_status()
        return r.text
    except Exception as e:
        print("❌ fetch_noaa error:", e, file=sys.stderr)
        return ""

def parse_noaa(txt):
    """Parse NOAA forecast text file"""
    data = []
    for line in txt.splitlines():
        if line.strip() == "" or line.startswith(":") or line.startswith("#"):
            continue
        parts = line.split()
        if len(parts) >= 6:
            try:
                date = pd.to_datetime(f"{parts[0]} {parts[1]} {parts[2]}")
                rf = int(parts[3]); ai = int(parts[4]); kp = int(parts[5])
                data.append([date, rf, ai, kp])
            except:
                continue
    df = pd.DataFrame(data, columns=["date", "radio_flux", "a_index", "kp_index"])
    df = df.sort_values("date").reset_index(drop=True)
    return df

def get_historical():
    """Get historical data from MongoDB"""
    client = MongoClient(MONGO_URL)
    db = client[DB_NAME]
    coll = db[COLLECTION_NAME]
    docs = list(coll.find({}, {"_id": 0}))
    client.close()
    if not docs:
        return pd.DataFrame(columns=["date","radio_flux","a_index","kp_index"])
    df = pd.DataFrame(docs)
    df['date'] = pd.to_datetime(df['date'])
    df = df.sort_values("date").reset_index(drop=True)
    return df

def merge_data(historical, latest_noaa):
    """Merge NOAA + historical, remove overlaps, fill gaps"""
    if not historical.empty and not latest_noaa.empty:
        earliest_noaa = latest_noaa['date'].min()
        historical = historical[historical['date'] < earliest_noaa]
    df = pd.concat([historical, latest_noaa], ignore_index=True)
    df = df.drop_duplicates(subset="date").sort_values("date").reset_index(drop=True)
    df[['radio_flux','a_index','kp_index']] = df[['radio_flux','a_index','kp_index']].interpolate(method='linear').bfill().ffill()
    return df

def create_sequences(values, window):
    """Create X,y sequences"""
    X, y = [], []
    for i in range(len(values) - window):
        X.append(values[i:i+window])
        y.append(values[i+window])
    return np.array(X), np.array(y)

# ======================== Model Utils ========================
def build_model(window, n_features):
    """Build simple LSTM model"""
    model = Sequential([
        LSTM(64, input_shape=(window, n_features)),
        Dropout(0.25),
        Dense(32, activation="relu"),
        Dense(n_features)
    ])
    model.compile(optimizer="adam", loss="mse")
    return model

def train_and_save_model(values_scaled, window, n_features):
    """Train model once and save it with scaler"""
    X, y = create_sequences(values_scaled, window)
    model = build_model(window, n_features)
    epochs = 50 if X.shape[0] > 10 else 100
    batch = max(1, min(16, X.shape[0]//2))
    model.fit(X, y, epochs=epochs, batch_size=batch, verbose=0)
    model.save(MODEL_FILE)
    print(f"✅ Model trained and saved to {MODEL_FILE}", file=sys.stderr)

# ======================== Forecasting ========================
def recursive_forecast(model, last_window_scaled, days):
    """Multi-step recursive forecast"""
    seq = last_window_scaled.copy()
    preds_scaled = []
    for _ in range(days):
        pred_scaled = model.predict(seq[np.newaxis, :, :], verbose=0)[0]
        preds_scaled.append(pred_scaled)
        seq = np.vstack([seq[1:], pred_scaled])
    return np.array(preds_scaled)

# ======================== Main ========================
latest_txt = fetch_noaa()
latest_noaa = parse_noaa(latest_txt)

if latest_noaa.empty:
    print("[]")
    sys.exit(0)

historical = get_historical()
all_data = merge_data(historical, latest_noaa)

if all_data.empty or all_data.shape[0] < 40:
    print("[]")
    sys.exit(0)

values = all_data[['radio_flux','a_index','kp_index']].values.astype('float32')
window = 27
n_features = values.shape[1]

# Fit scaler
scaler = MinMaxScaler()
values_scaled = scaler.fit_transform(values)

# Save scaler if not exists
if not os.path.exists(SCALER_FILE):
    joblib.dump(scaler, SCALER_FILE)
else:
    scaler = joblib.load(SCALER_FILE)

# Load or train model
if os.path.exists(MODEL_FILE):
    model = load_model(MODEL_FILE)
else:
    train_and_save_model(values_scaled, window, n_features)
    model = load_model(MODEL_FILE)

# Forecast
last_window_scaled = values_scaled[-window:]
preds_scaled = recursive_forecast(model, last_window_scaled, PRED_DAYS)
preds = scaler.inverse_transform(preds_scaled)

# Start date = after last NOAA date
start_date = latest_noaa['date'].max() + timedelta(days=1)

results = []
for i in range(PRED_DAYS):
    fdate = (start_date + timedelta(days=i)).date().isoformat()
    rf, ai, kp = preds[i]
    results.append({
        "date": fdate,
        "radio_flux": int(round(rf)),
        "a_index": int(round(ai)),
        "kp_index": int(round(kp))
    })

print(json.dumps(results))
