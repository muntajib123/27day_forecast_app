# backend/python/eval_model.py
import os
from pathlib import Path
import joblib
import numpy as np
from sklearn.metrics import mean_squared_error
from tensorflow.keras.models import load_model

BASE_DIR = Path(__file__).resolve().parent
MODEL_FILE = BASE_DIR / "trained_lstm.h5"
SCALER_FILE = BASE_DIR / "scaler.save"
PRED_DAYS = 27

# Import helper functions from predict_lstm.py (same folder)
import importlib.util
spec = importlib.util.spec_from_file_location("predict_lstm", str(BASE_DIR / "predict_lstm.py"))
pl = importlib.util.module_from_spec(spec)
spec.loader.exec_module(pl)

# Load scaler
if not SCALER_FILE.exists():
    raise FileNotFoundError(f"Scaler not found at {SCALER_FILE}")
scaler = joblib.load(str(SCALER_FILE))

# Load model without compiling (avoid metric/loss deserialization issues)
if MODEL_FILE.exists():
    try:
        model = load_model(str(MODEL_FILE), compile=False)
        print(f"Loaded model: {MODEL_FILE}")
    except Exception as e:
        # try .keras if .h5 fails
        alt = str(MODEL_FILE) + ".keras"
        if os.path.exists(alt):
            model = load_model(alt, compile=False)
            print(f"Loaded model: {alt}")
        else:
            raise RuntimeError("Failed to load model (.h5) and no .keras available.") from e
else:
    raise FileNotFoundError(f"Model file not found: {MODEL_FILE}")

# Re-create dataset pairs (same preprocessing as predict_lstm.py)
history_df = pl.load_history_from_mongo()
noaa_text = pl.fetch_noaa_text()
noaa_df = pl.parse_noaa_text(noaa_text)
all_df = pl.merge_history_and_noaa(history_df, noaa_df)

window = PRED_DAYS
values = all_df[['f107','a_index','kp_max']].values.astype('float32')
n_features = values.shape[1]

# build baseline-target pairs
baselines = []
targets = []
for i in range(0, len(values) - 2*window + 1):
    baselines.append(values[i:i+window])
    targets.append(values[i+window:i+2*window])
baselines = np.array(baselines)
targets = np.array(targets)

# scale
bas_s = scaler.transform(baselines.reshape(-1, n_features)).reshape(baselines.shape)
tar_s = scaler.transform(targets.reshape(-1, n_features)).reshape(targets.shape)

# construct X and Y (residuals)
day_idx = (np.arange(window) / float(window - 1)).reshape(1, window, 1)
day_idx = np.repeat(day_idx, bas_s.shape[0], axis=0)
X = np.concatenate([bas_s, day_idx], axis=2)
Y = tar_s - bas_s

# train/val split (same as training)
split = int(0.8 * X.shape[0])
X_val = X[split:]
Y_val = Y[split:]

# Predict on validation and compute MSE on scaled residuals
pred_res_s = model.predict(X_val)
mse_scaled = mean_squared_error(Y_val.reshape(-1, Y_val.shape[-1]), pred_res_s.reshape(-1, pred_res_s.shape[-1]))
rmse_scaled = mse_scaled ** 0.5

# Print compact result
summary = {
    "val_mse_scaled": float(mse_scaled),
    "val_rmse_scaled": float(rmse_scaled),
    "val_samples": int(X_val.shape[0])
}
print(summary)
