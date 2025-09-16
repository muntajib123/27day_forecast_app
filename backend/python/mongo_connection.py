from pymongo import MongoClient

def get_mongo_collection():
    client = MongoClient("mongodb://localhost:27018/")
    db = client["noaa_database"]
    collection = db["forecast_lstm_27day"]
    return collection
