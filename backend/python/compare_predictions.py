# backend/python/compare_predictions.py
# Compare your predictions.json (model) vs NOAA 27-day outlook.
# Usage (from backend folder):
#   python .\python\compare_predictions.py

import json
import requests
import pandas as pd
import numpy as np
from pathlib import Path
from sklearn.metrics import mean_absolute_error, mean_squared_error

BASE = Path(__file__).resolve().parent
PRED_FILE = BASE / "predictions.json"
NOAA_URL = "https://services.swpc.noaa.gov/text/27-day-outlook.txt"

def load_preds(path: Path) -> pd.DataFrame:
    if not path.exists():
        raise FileNotFoundError(f"Predictions file not found: {path}")
    with open(path, "r") as f:
        data = json.load(f)
    df = pd.DataFrame(data)
    if df.empty:
        raise RuntimeError("Predictions file is empty.")
    df['date'] = pd.to_datetime(df['date'])
    return df.sort_values('date').reset_index(drop=True)

def fetch_noaa_df() -> pd.DataFrame:
    r = requests.get(NOAA_URL, timeout=20)
    r.raise_for_status()
    text = r.text
    rows = []
    for line in text.splitlines():
        line = line.strip()
        if not line or line.startswith(":") or line.startswith("#"):
            continue
        parts = line.split()
        if len(parts) >= 6:
            try:
                dt = pd.to_datetime(f"{parts[0]} {parts[1]} {parts[2]}", dayfirst=False)
                f107 = float(parts[3])
                a_index = float(parts[4])
                kp_max = float(parts[5])
                rows.append({"date": dt.date().isoformat(), "f107": f107, "a_index": a_index, "kp_max": kp_max})
            except Exception:
                continue
    df = pd.DataFrame(rows)
    if df.empty:
        raise RuntimeError("No NOAA rows parsed.")
    df['date'] = pd.to_datetime(df['date'])
    return df.sort_values('date').reset_index(drop=True)

def compute_metrics(y_true: np.ndarray, y_pred: np.ndarray):
    mae = mean_absolute_error(y_true, y_pred)
    rmse = mean_squared_error(y_true, y_pred) ** 0.5
    return float(mae), float(rmse)

def compare(merged: pd.DataFrame):
    """
    Expects merged to contain columns:
      f107_pred, f107_noaa, a_index_pred, a_index_noaa, kp_max_pred, kp_max_noaa
    """
    metrics = {}
    for col in ['f107', 'a_index', 'kp_max']:
        pred_col = f"{col}_pred"
        noaa_col = f"{col}_noaa"
        if pred_col not in merged.columns or noaa_col not in merged.columns:
            raise KeyError(f"Expected columns missing in merged: {pred_col} or {noaa_col}")
        y_pred = merged[pred_col].values
        y_true = merged[noaa_col].values
        mae, rmse = compute_metrics(y_true, y_pred)
        metrics[col] = {"mae": mae, "rmse": rmse}
    # overall across all variables/timepoints
    y_pred_all = merged[['f107_pred','a_index_pred','kp_max_pred']].values.reshape(-1)
    y_true_all = merged[['f107_noaa','a_index_noaa','kp_max_noaa']].values.reshape(-1)
    metrics['overall'] = {"mae": float(mean_absolute_error(y_true_all, y_pred_all)),
                          "rmse": float(mean_squared_error(y_true_all, y_pred_all)**0.5)}
    return metrics

def shifted_compare(pred_df: pd.DataFrame, noaa_df: pd.DataFrame):
    """
    Align pred_df first date to noaa_df first date (shift), then compare
    for the min length available. Save comparison_shifted.csv
    """
    pred_df = pred_df.sort_values('date').reset_index(drop=True)
    noaa_df = noaa_df.sort_values('date').reset_index(drop=True)
    n = min(len(pred_df), len(noaa_df))
    if n == 0:
        return None, None

    pred_slice = pred_df.iloc[:n].copy().reset_index(drop=True)
    noaa_slice = noaa_df.iloc[:n].copy().reset_index(drop=True)

    # Align the prediction dates to NOAA dates (so they occupy the same calendar days)
    pred_slice['date'] = noaa_slice['date']

    # Explicitly rename columns so compare() sees *_pred and *_noaa columns
    pred_slice = pred_slice.rename(columns={
        "f107": "f107_pred",
        "a_index": "a_index_pred",
        "kp_max": "kp_max_pred"
    })
    noaa_slice = noaa_slice.rename(columns={
        "f107": "f107_noaa",
        "a_index": "a_index_noaa",
        "kp_max": "kp_max_noaa"
    })

    # Merge on date (now both frames have distinct column names)
    merged = pd.merge(pred_slice, noaa_slice, on="date", how="inner")
    metrics = compare(merged)
    return merged, metrics

def main():
    print("Loading predictions:", PRED_FILE)
    try:
        pred_df = load_preds(PRED_FILE)
    except Exception as e:
        print("Error loading predictions.json:", e)
        return

    print("Fetching NOAA 27-day outlook from:", NOAA_URL)
    try:
        noaa_df = fetch_noaa_df()
    except Exception as e:
        print("Error fetching NOAA data:", e)
        return

    # try direct date overlap
    merged = pd.merge(pred_df, noaa_df, on="date", how="inner", suffixes=("_pred", "_noaa"))
    if merged.empty:
        print("⚠️ No overlapping dates found between predictions and NOAA.")
        # Save both for inspection
        pred_out = BASE / "predictions_only.csv"
        noaa_out = BASE / "noaa_only.csv"
        pred_df.to_csv(pred_out, index=False)
        noaa_df.to_csv(noaa_out, index=False)
        print(f"Saved your predictions to: {pred_out}")
        print(f"Saved NOAA outlook to:    {noaa_out}")

        # Also perform a shifted comparison (align starts) to assess relative skill
        print("\nAttempting a SHIFTED comparison (align prediction start -> NOAA start)...")
        shifted_merged, shifted_metrics = shifted_compare(pred_df, noaa_df)
        if shifted_merged is None or shifted_merged.empty:
            print("Shifted comparison not possible (no data). Exiting.")
            return

        # Print shifted results
        print("\nShifted comparison results (prediction start aligned to NOAA start):")
        cols = ['date','f107_pred','f107_noaa','a_index_pred','a_index_noaa','kp_max_pred','kp_max_noaa']
        print(shifted_merged[cols].to_string(index=False))

        print("\nShifted Metrics:")
        for k,v in shifted_metrics.items():
            print(f" {k}: MAE={v['mae']:.4f}, RMSE={v['rmse']:.4f}")
        out_shift = BASE / "comparison_shifted.csv"
        shifted_merged.to_csv(out_shift, index=False)
        print(f"\nSaved shifted comparison to: {out_shift}")
        return

    # If we do have overlaps, compute metrics and save
    metrics = compare(merged)
    print("\nComparison results (dates matched):")
    cols = ['date','f107_pred','f107_noaa','a_index_pred','a_index_noaa','kp_max_pred','kp_max_noaa']
    print(merged[cols].to_string(index=False))

    print("\nMetrics:")
    for k,v in metrics.items():
        print(f" {k}: MAE={v['mae']:.4f}, RMSE={v['rmse']:.4f}")

    out = BASE / "comparison.csv"
    merged.to_csv(out, index=False)
    print(f"\nSaved comparison table to: {out}")

if __name__ == "__main__":
    main()
