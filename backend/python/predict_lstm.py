# backend/python/predict_lstm.py  -- residual-learning with residual scaler (MSE in [0,1])
import os
import sys
import json
import numpy as np
import pandas as pd
import requests
from datetime import timedelta
from pymongo import MongoClient
from sklearn.preprocessing import MinMaxScaler
from tensorflow.keras.models import Model, load_model
from tensorflow.keras.layers import Input, LSTM, RepeatVector, TimeDistributed, Dense, Dropout
from tensorflow.keras.callbacks import EarlyStopping, ReduceLROnPlateau, ModelCheckpoint
import joblib

# Config
MONGO_URL = "mongodb://localhost:27018/"
DB_NAME = "noaa_database"
HIST_COLLECTION = "forecast_lstm_27day"
NOAA_URL = "https://services.swpc.noaa.gov/text/27-day-outlook.txt"
PRED_DAYS = 27
BASE_DIR = os.path.dirname(__file__)
MODEL_FILE = os.path.join(BASE_DIR, "trained_lstm.keras")   # ✅ only native keras
SCALER_FILE = os.path.join(BASE_DIR, "scaler.save")
RES_SCALER_FILE = os.path.join(BASE_DIR, "residual_scaler.save")

# Helpers
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
                date = pd.to_datetime(f"{parts[0]} {parts[1]} {parts[2]}", dayfirst=False)
                rows.append({
                    "date": pd.Timestamp(date).to_pydatetime(),
                    "f107": float(parts[3]),
                    "a_index": float(parts[4]),
                    "kp_max": float(parts[5]),
                })
            except Exception:
                continue
    df = pd.DataFrame(rows)
    return df.sort_values("date").reset_index(drop=True) if not df.empty else df

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
    if not history_df.empty and not noaa_df.empty:
        earliest_noaa = noaa_df['date'].min()
        history_df = history_df[history_df['date'] < earliest_noaa]
    df = pd.concat([history_df, noaa_df], ignore_index=True)
    df = df.drop_duplicates(subset="date").sort_values("date").reset_index(drop=True)
    if not df.empty:
        df[['f107','a_index','kp_max']] = df[['f107','a_index','kp_max']].interpolate(method='linear').bfill().ffill()
    return df

def build_encoder_decoder(window, n_features, n_targets, latent=128):
    inp = Input(shape=(window, n_features))
    enc = LSTM(latent, return_state=True)(inp)
    _, state_h, state_c = enc
    dec_in = RepeatVector(window)(state_h)
    dec_lstm = LSTM(latent, return_sequences=True)(dec_in, initial_state=[state_h, state_c])
    dec_out = Dropout(0.2)(dec_lstm)
    out = TimeDistributed(Dense(n_targets, activation="sigmoid"))(dec_out)  # ensures [0,1]
    model = Model(inp, out)
    model.compile(optimizer="adam", loss="mse", metrics=["mae"])
    return model

# Main
def main():
    noaa_text = fetch_noaa_text()
    noaa_df = parse_noaa_text(noaa_text)
    if noaa_df.empty:
        print("[]")
        print("❌ No NOAA 27-day data found; exiting.", file=sys.stderr)
        sys.exit(0)

    history_df = load_history_from_mongo()
    print(f"ℹ️ history rows: {len(history_df)}", file=sys.stderr)
    print(f"ℹ️ noaa rows: {len(noaa_df)}", file=sys.stderr)

    all_df = merge_history_and_noaa(history_df, noaa_df)
    print(f"ℹ️ merged rows: {len(all_df)} (history + noaa)", file=sys.stderr)

    window = 27
    if all_df.empty or len(all_df) < window * 2:
        print("[]")
        print(f"❗ Need at least {window*2} rows. Found {len(all_df)}. Exiting.", file=sys.stderr)
        sys.exit(0)

    values = all_df[['f107','a_index','kp_max']].values.astype('float32')
    n_features = values.shape[1]

    baselines, targets = [], []
    for i in range(0, len(values) - 2*window + 1):
        baselines.append(values[i:i+window])
        targets.append(values[i+window:i+2*window])
    baselines, targets = np.array(baselines), np.array(targets)
    print(f"ℹ️ baseline/target pairs: {baselines.shape}", file=sys.stderr)

    if os.path.exists(SCALER_FILE):
        scaler = joblib.load(SCALER_FILE)
        print("ℹ️ loaded existing scaler", file=sys.stderr)
    else:
        scaler = MinMaxScaler()
        combined = np.vstack([baselines.reshape(-1, n_features), targets.reshape(-1, n_features)])
        scaler.fit(combined)
        joblib.dump(scaler, SCALER_FILE)
        print("ℹ️ new scaler fitted and saved", file=sys.stderr)

    bas_s = scaler.transform(baselines.reshape(-1, n_features)).reshape(baselines.shape)
    tar_s = scaler.transform(targets.reshape(-1, n_features)).reshape(targets.shape)

    Y_raw = tar_s - bas_s
    if os.path.exists(RES_SCALER_FILE):
        res_scaler = joblib.load(RES_SCALER_FILE)
        print("ℹ️ loaded existing residual scaler", file=sys.stderr)
    else:
        res_scaler = MinMaxScaler(feature_range=(0,1))
        res_scaler.fit(Y_raw.reshape(-1, Y_raw.shape[-1]))
        joblib.dump(res_scaler, RES_SCALER_FILE)
        print("ℹ️ new residual scaler fitted and saved", file=sys.stderr)

    Y = res_scaler.transform(Y_raw.reshape(-1, Y_raw.shape[-1])).reshape(Y_raw.shape)
    print("Y (scaled residuals) min/max:", float(Y.min()), float(Y.max()), file=sys.stderr)

    day_idx = (np.arange(window) / float(window - 1)).reshape(1, window, 1)
    day_idx = np.repeat(day_idx, bas_s.shape[0], axis=0)
    X = np.concatenate([bas_s, day_idx], axis=2)

    split = int(0.8 * X.shape[0])
    X_train, X_val, Y_train, Y_val = X[:split], X[split:], Y[:split], Y[split:]
    print(f"ℹ️ Train samples: {X_train.shape[0]}, Val samples: {X_val.shape[0]}", file=sys.stderr)

    # --- load or train ---
    model = None
    if os.path.exists(MODEL_FILE):
        try:
            model = load_model(MODEL_FILE, compile=False)  # ✅ prevents deserialization errors
            print("ℹ️ loaded existing model", file=sys.stderr)
        except Exception as e:
            print("⚠️ failed loading model:", e, file=sys.stderr)
            model = None

    if model is None:
        n_targets = Y_train.shape[2]
        model = build_encoder_decoder(window, X.shape[2], n_targets, latent=128)
        model.summary(print_fn=lambda x: print(x, file=sys.stderr))
        callbacks = [
            EarlyStopping(monitor='val_loss', patience=15, restore_best_weights=True, verbose=1),
            ReduceLROnPlateau(monitor='val_loss', factor=0.5, patience=6, min_lr=1e-6, verbose=1),
            ModelCheckpoint(MODEL_FILE, monitor='val_loss', save_best_only=True, verbose=1),
        ]
        model.fit(X_train, Y_train, validation_data=(X_val, Y_val),
                  epochs=200, batch_size=32, callbacks=callbacks, verbose=2)
        model.save(MODEL_FILE)   # ✅ only .keras
        print("✅ Residual model trained and saved", file=sys.stderr)

    # === Inference ===
    last_baseline = values[-window:]
    last_baseline_s = scaler.transform(last_baseline)

    day_idx_inf = (np.arange(window) / float(window - 1)).reshape(window,1)
    input_seq = np.concatenate([last_baseline_s, day_idx_inf], axis=1).reshape(1, window, X.shape[2])

    pred_res_scaled = model.predict(input_seq)[0]
    pred_res_s = res_scaler.inverse_transform(pred_res_scaled)
    pred_actual_s = last_baseline_s + pred_res_s
    pred_actual = scaler.inverse_transform(pred_actual_s)

    start_date = noaa_df['date'].max() + timedelta(days=1)
    results = []
    for i in range(PRED_DAYS):
        fdate = (start_date + timedelta(days=i)).date().isoformat()
        rf, ai, kp = pred_actual[i]
        results.append({"date": fdate, "f107": float(rf), "a_index": float(ai), "kp_max": float(kp)})

    print(json.dumps(results))

if __name__ == "__main__":
    main()
