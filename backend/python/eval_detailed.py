# eval_detailed.py (paste into backend/python and run similarly)
import joblib, numpy as np
from pathlib import Path
from sklearn.metrics import mean_squared_error
from tensorflow.keras.models import load_model
import importlib.util
BASE_DIR = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("predict_lstm", str(BASE_DIR / "predict_lstm.py"))
pl = importlib.util.module_from_spec(spec)
spec.loader.exec_module(pl)

scaler = joblib.load(str(BASE_DIR / "scaler.save"))
model = load_model(str(BASE_DIR / "trained_lstm.h5"), compile=False)

# Recreate data
history_df = pl.load_history_from_mongo()
noaa_df = pl.parse_noaa_text(pl.fetch_noaa_text())
all_df = pl.merge_history_and_noaa(history_df, noaa_df)
values = all_df[['f107','a_index','kp_max']].values.astype('float32')
window = 27
baselines, targets = [], []
for i in range(0, len(values) - 2*window + 1):
    baselines.append(values[i:i+window]); targets.append(values[i+window:i+2*window])
baselines = np.array(baselines); targets = np.array(targets)
n = values.shape[1]
bas_s = scaler.transform(baselines.reshape(-1, n)).reshape(baselines.shape)
tar_s = scaler.transform(targets.reshape(-1, n)).reshape(targets.shape)
day_idx = (np.arange(window) / float(window - 1)).reshape(1, window, 1)
day_idx = np.repeat(day_idx, bas_s.shape[0], axis=0)
X = np.concatenate([bas_s, day_idx], axis=2)
Y = tar_s - bas_s
split = int(0.8 * X.shape[0])
X_val, Y_val = X[split:], Y[split:]
pred_res_s = model.predict(X_val)

# per-variable scaled MSE/RMSE (residuals)
mse_per_var = ((Y_val - pred_res_s)**2).mean(axis=(0,1))
rmse_per_var = np.sqrt(mse_per_var)
print("Per-variable RMSE (scaled):", rmse_per_var)  # order: f107, a_index, kp_max

# convert predicted scaled actuals back to real units
pred_actual_s = bas_s[split:] + pred_res_s
pred_actual_flat = pred_actual_s.reshape(-1, pred_actual_s.shape[-1])
pred_actual_real = scaler.inverse_transform(pred_actual_flat).reshape(pred_actual_s.shape)
true_actual_s = tar_s[split:]
true_actual_flat = true_actual_s.reshape(-1, true_actual_s.shape[-1])
true_actual_real = scaler.inverse_transform(true_actual_flat).reshape(true_actual_s.shape)
mse_real_per_var = ((true_actual_real - pred_actual_real)**2).mean(axis=(0,1))
rmse_real_per_var = np.sqrt(mse_real_per_var)
print("Per-variable RMSE (real units):", rmse_real_per_var)
