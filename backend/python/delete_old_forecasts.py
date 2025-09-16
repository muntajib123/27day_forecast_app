from pymongo import MongoClient
from datetime import datetime

# MongoDB connection
client = MongoClient("mongodb://localhost:27018/")
db = client["noaa_database"]
collection = db["forecast_lstm_27day"]

# Define cutoff date (inclusive of July 27)
cutoff_date = datetime(2025, 7, 27)

# Delete all documents with date < July 27, 2025
result = collection.delete_many({"date": {"$lt": cutoff_date}})

print(f"✅ Deleted {result.deleted_count} old records.")
