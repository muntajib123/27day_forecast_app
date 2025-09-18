# backend/python/load_history.py
import os, sys
import pandas as pd
from pymongo import MongoClient

MONGO_URL = "mongodb://localhost:27018/"
DB_NAME = "noaa_database"
COL = "forecast_lstm_27day"

# Candidate filenames (try both with and without space)
CANDIDATE_NAMES = ["27 day forecast.txt", "27day_forecast.txt", "27day_forecast.txt"]

def find_input_file():
    """
    Try possible locations for the forecast file:
      1) same directory as this script (backend/python/)
      2) backend/ (one level up)
      3) project root (two levels up)
      4) current working directory
    and try several candidate filenames (with/without spaces).
    Return the first path that exists, else None.
    """
    script_dir = os.path.dirname(__file__)
    search_dirs = [
        script_dir,
        os.path.abspath(os.path.join(script_dir, "..")),       # backend/
        os.path.abspath(os.path.join(script_dir, "..", "..")), # project root
        os.getcwd()
    ]
    tried = []
    for d in search_dirs:
        for name in CANDIDATE_NAMES:
            p = os.path.join(d, name)
            tried.append(p)
            if os.path.exists(p):
                return p
    # not found
    print("Tried paths:", file=sys.stderr)
    for t in tried:
        print("  -", t, file=sys.stderr)
    return None

def parse_simple(file_path):
    rows = []
    with open(file_path, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith(':') or line.startswith('#'):
                continue
            parts = line.split()
            if len(parts) >= 6:
                try:
                    # expected format: YYYY Mon DD F107 A_index Kp
                    date = pd.to_datetime(f"{parts[0]} {parts[1]} {parts[2]}", dayfirst=False)
                    rows.append({
                        "date": date.to_pydatetime(),
                        "f107": float(parts[3]),
                        "a_index": float(parts[4]),
                        "kp_max": float(parts[5])
                    })
                except Exception:
                    # skip malformed lines silently
                    continue
    return rows

def main():
    input_file = find_input_file()
    if not input_file:
        print("❌ Forecast file not found in expected locations.", file=sys.stderr)
        sys.exit(1)

    print("ℹ️ Using forecast file:", input_file, file=sys.stderr)

    docs = parse_simple(input_file)
    if not docs:
        print("❌ No parsable rows found in", input_file, file=sys.stderr)
        sys.exit(1)

    client = MongoClient(MONGO_URL)
    db = client[DB_NAME]
    coll = db[COL]

    # Upsert each doc (idempotent, safe). Uses date field as unique key.
    upserted = 0
    for doc in docs:
        res = coll.replace_one({"date": doc["date"]}, doc, upsert=True)
        # count a real upsert/replace as upserted for reporting
        if res.upserted_id is not None:
            upserted += 1

    count = coll.count_documents({})
    client.close()
    print(f"✅ Upserted/Ensured {len(docs)} docs. Newly inserted: {upserted}. Collection now has {count} documents.")

if __name__ == "__main__":
    main()
