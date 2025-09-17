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

# ===== Config =====
MONGO_URL = "mongodb://localhost:27018/"
DB_NAME = "noaa_database"
HIST_COLLECTION = "forecast_lstm_27day"   # historical daily indices you loaded
NOAA_COLLECTION = "forecast_27day"        # NOAA 27-day collection (we keep this)
NOAA_URL = "https://services.swpc.noaa.gov/text/27-day-outlook.txt"
PRED_DAYS = 27
MODEL_FILE = os.path.join(os.path.dirname(__file__), "trained_lstm.h5")
SCALER_FILE = os.path.join(os.path.dirname(__file__), "scaler.save")

# ===== Helpers =====
def fetch_noaa_text():
    try:
        r = requests.get(NOAA_URL, timeout=15)
        r.raise_for_status()
        return r.text
    except Exception as e:
        print("❌ fetch_noaa_text error:", e, file=sys.stderr)
        return ""

def parse_noaa_text(txt):
    rows = []
    for line in txt.splitlines():
        line = line.strip()
        if not line or line.startswith(":") or line.startswith("#"):
            continue
        parts = line.split()
        if len(parts) >= 6:
            try:
                date = pd.to_datetime(f"{parts[0]} {parts[1]} {parts[2]}")
                f107 = int(parts[3])
                a_index = int(parts[4])
                kp_max = int(parts[5])
                rows.append({"date": pd.Timestamp(date).to_pydatetime(), "f107": f107, "a_index": a_index, "kp_max": kp_max})
            except Exception:
                continue
    df = pd.DataFrame(rows)
    if df.empty:
        return df
    return df.sort_values("date").reset_index(drop=True)

def load_history_from_mongo():
    try:
        client = MongoClient(MONGO_URL)
        db = client[DB_NAME]
        coll = db[HIST_COLLECTION]
        docs = list(coll.find({}, {"_id":0}).sort("date", 1))
        client.close()
    except Exception as e:
        print("❌ load_history_from_mongo error:", e, file=sys.stderr)
        return pd.DataFrame(columns=["date","f107","a_index","kp_max"])
    if not docs:
        return pd.DataFrame(columns=["date","f107","a_index","kp_max"])
    df = pd.DataFrame(docs)
    df['date'] = pd.to_datetime(df['date'])
    return df.sort_values("date").reset_index(drop=True)

def merge_history_and_noaa(history_df, noaa_df):
    # keep history that is earlier than earliest NOAA row to avoid overlap
    if not history_df.empty and not noaa_df.empty:
        earliest_noaa = noaa_df['date'].min()
        history_df = history_df[history_df['date'] < earliest_noaa]
    df = pd.concat([history_df, noaa_df], ignore_index=True)
    df = df.drop_duplicates(subset="date").sort_values("date").reset_index(drop=True)
    if not df.empty:
        df[['f107','a_index','kp_max']] = df[['f107','a_index','kp_max']].interpolate(method='linear').bfill().ffill()
    return df

def create_sequences(values, window):
    X,y = [],[]
    for i in range(len(values)-window):
        X.append(values[i:i+window])
        y.append(values[i+window])
    return np.array(X), np.array(y)

def build_lstm(window, n_features):
    model = Sequential([
        LSTM(64, input_shape=(window, n_features)),
        Dropout(0.25),
        Dense(32, activation="relu"),
        Dense(n_features)
    ])
    model.compile(optimizer="adam", loss="mse")
    return model

# ===== Main =====
def main():
    # fetch NOAA text and parse (for start date/merge)
    noaa_text = fetch_noaa_text()
    noaa_df = parse_noaa_text(noaa_text)
    if noaa_df.empty:
        print("[]")
        print("❌ No NOAA 27-day data found; exiting.", file=sys.stderr)
        sys.exit(0)

    # load historical from MongoDB (the 1.8k rows you loaded)
    history_df = load_history_from_mongo()
    print(f"ℹ️ history rows: {len(history_df)}", file=sys.stderr)
    print(f"ℹ️ noaa rows: {len(noaa_df)}", file=sys.stderr)

    all_df = merge_history_and_noaa(history_df, noaa_df)
    print(f"ℹ️ merged rows: {len(all_df)} (history + noaa)", file=sys.stderr)

    # window length
    window = 27
    if all_df.empty or len(all_df) < window + 1:
        # not enough rows to create even one training sequence
        print("[]")
        print(f"❗ Not enough rows to create sequences. rows={len(all_df)}, required={window+1}", file=sys.stderr)
        sys.exit(0)

    values = all_df[['f107','a_index','kp_max']].values.astype('float32')
    n_features = values.shape[1]

    # scaler: fit on history if scaler absent, else load and transform
    scaler = MinMaxScaler()
    if os.path.exists(SCALER_FILE):
        try:
            scaler = joblib.load(SCALER_FILE)
            values_scaled = scaler.transform(values)
            print("ℹ️ loaded existing scaler", file=sys.stderr)
        except Exception:
            values_scaled = scaler.fit_transform(values)
            joblib.dump(scaler, SCALER_FILE)
            print("ℹ️ scaler re-fit and saved", file=sys.stderr)
    else:
        values_scaled = scaler.fit_transform(values)
        joblib.dump(scaler, SCALER_FILE)
        print("ℹ️ new scaler fitted and saved", file=sys.stderr)

    # Prepare training sequences
    X,y = create_sequences(values_scaled, window)
    print(f"ℹ️ sequences available: X.shape={X.shape}, y.shape={y.shape}", file=sys.stderr)

    # load or train model
    model = None
    if os.path.exists(MODEL_FILE):
        try:
            model = load_model(MODEL_FILE)
            print("ℹ️ loaded existing model", file=sys.stderr)
        except Exception as e:
            print("⚠️ failed loading model, will attempt to (re)train:", e, file=sys.stderr)
            model = None

    if model is None:
        # train only if have at least a few sequences
        if X.shape[0] >= 5:
            model = build_lstm(window, n_features)
            epochs = 50 if X.shape[0] > 50 else 100
            batch = max(1, min(32, X.shape[0]//2))
            print(f"ℹ️ training model: epochs={epochs}, batch={batch}", file=sys.stderr)
            model.fit(X, y, epochs=epochs, batch_size=batch, verbose=0)
            model.save(MODEL_FILE)
            print("✅ Model trained and saved", file=sys.stderr)
        else:
            print("❗ Not enough sequences to train a reliable model (need >=5).", file=sys.stderr)
            print("[]")
            sys.exit(0)

    # Forecast: use last window values (from merged df)
    last_window_scaled = values_scaled[-window:]
    preds_scaled = []
    seq = last_window_scaled.copy()
    for _ in range(PRED_DAYS):
        pred_scaled = model.predict(seq[np.newaxis, :, :], verbose=0)[0]
        preds_scaled.append(pred_scaled)
        seq = np.vstack([seq[1:], pred_scaled])
    preds = scaler.inverse_transform(np.array(preds_scaled))

    # start forecast date = day after last NOAA date
    start_date = noaa_df['date'].max() + timedelta(days=1)

    results = []
    for i in range(PRED_DAYS):
        fdate = (start_date + timedelta(days=i)).date().isoformat()
        rf, ai, kp = preds[i]
        results.append({
            "date": fdate,
            "f107": int(round(float(rf))),
            "a_index": int(round(float(ai))),
            "kp_max": int(round(float(kp)))
        })

    # output JSON array (stdout). Node will parse this.
    print(json.dumps(results))

if __name__ == "__main__":
    main()
