# backend/python/load_historical.py
import os
import sys
import pandas as pd
from pymongo import MongoClient, UpdateOne
from datetime import datetime

# ===== Config =====
MONGO_URL = "mongodb://localhost:27018/"
DB_NAME = "noaa_database"
COLLECTION_NAME = "forecast_lstm_27day"
INPUT_FILE = os.path.join(os.path.dirname(__file__), "27 day forecast.txt")

def parse_noaa_file(file_path):
    data = []
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"Input file not found: {file_path}")

    with open(file_path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line == "" or line.startswith(":") or line.startswith("#"):
                continue
            parts = line.split()
            if len(parts) >= 6:
                try:
                    date = pd.to_datetime(f"{parts[0]} {parts[1]} {parts[2]}")
                    f107 = int(parts[3])
                    a_index = int(parts[4])
                    kp_max = int(parts[5])
                    data.append({
                        "date": pd.Timestamp(date).to_pydatetime(),
                        "f107": int(f107),
                        "a_index": int(a_index),
                        "kp_max": int(kp_max)
                    })
                except Exception:
                    continue
    return data

def main():
    try:
        rows = parse_noaa_file(INPUT_FILE)
    except FileNotFoundError as e:
        print(f"❌ {e}", file=sys.stderr); sys.exit(1)
    except Exception as e:
        print(f"❌ Unexpected parse error: {e}", file=sys.stderr); sys.exit(1)

    if not rows:
        print("❌ No data parsed from file", file=sys.stderr); sys.exit(1)

    print(f"✅ Parsed {len(rows)} rows from {os.path.basename(INPUT_FILE)}")

    # Deduplicate by date (keep the last occurrence)
    dedup = {}
    for r in rows:
        # normalize date to midnight UTC-naive datetime (mongodb stores datetime like this)
        key = r["date"].replace(hour=0, minute=0, second=0, microsecond=0)
        dedup[key] = r
    dedup_rows = sorted(dedup.values(), key=lambda r: r["date"])

    print(f"ℹ️ After dedupe: {len(dedup_rows)} unique dates")

    # Upsert using bulk operations (safe if unique index exists)
    try:
        client = MongoClient(MONGO_URL)
        db = client[DB_NAME]
        coll = db[COLLECTION_NAME]

        ops = []
        for r in dedup_rows:
            ops.append(
                UpdateOne(
                    {"date": r["date"]},
                    {"$set": r},
                    upsert=True
                )
            )

        if ops:
            result = coll.bulk_write(ops, ordered=False)
            n_upsert = (result.upserted_count if hasattr(result, "upserted_count") else 0)
            n_modified = result.modified_count if hasattr(result, "modified_count") else 0
            print(f"✅ Bulk upsert completed. upserted={n_upsert}, modified={n_modified}, total={len(ops)}")
        client.close()

    except Exception as e:
        print(f"❌ MongoDB error during bulk upsert: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
