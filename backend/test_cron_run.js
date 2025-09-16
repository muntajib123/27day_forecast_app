const { runLSTMModel } = require("./models/LSTMModelRunner");
const axios = require("axios");
const { MongoClient } = require("mongodb");

(async () => {
  console.log("🧪 Testing 27-day forecast condition...");

  const client = new MongoClient("mongodb://localhost:27018/");
  const dbName = "noaa_database";
  const collectionName = "forecast_lstm_27day";

  try {
    await client.connect();
    const db = client.db(dbName);
    const collection = db.collection(collectionName);

    const latest = await collection.findOne({}, { sort: { date: -1 } });

    if (!latest || new Date() > new Date(latest.date).setDate(new Date(latest.date).getDate() + 27)) {
      console.log("✅ 27 days passed or no data. Running forecast...");

      const predictions = await runLSTMModel();

      await axios.post("http://localhost:5000/api/predictions/lstm", {
        predictions: predictions
      });

      console.log("✅ Forecast saved successfully.");
    } else {
      console.log("🕒 Only", Math.ceil((new Date(latest.date).setDate(new Date(latest.date).getDate() + 27) - Date.now()) / (1000 * 60 * 60 * 24)), "days left. Skipping forecast.");
    }
  } catch (err) {
    console.error("❌ Error during manual test:", err.message);
  } finally {
    await client.close();
  }
})();
