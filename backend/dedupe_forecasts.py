# backend/dedupe_forecasts.py
from pymongo import MongoClient

MONGO_URL = "mongodb://localhost:27018/"
DB = "noaa_database"
COL = "forecast_lstm_27day"

client = MongoClient(MONGO_URL)
coll = client[DB][COL]

# We'll keep the document with the smallest _id (oldest) for each date and delete others.
pipeline = [
    {"$group": {
        "_id": "$date",
        "ids": {"$push": "$_id"},
        "count": {"$sum": 1}
    }},
    {"$match": {"count": {"$gt": 1}}}
]

dupes = list(coll.aggregate(pipeline))
total_deleted = 0

for doc in dupes:
    ids = doc["ids"]
    # Keep the first id and delete others
    keep = ids[0]
    remove = ids[1:]
    if remove:
        res = coll.delete_many({"_id": {"$in": remove}})
        total_deleted += res.deleted_count
        print(f"Date {doc['_id']}: deleted {res.deleted_count} duplicate(s)")

print("Total duplicates deleted:", total_deleted)
client.close()
