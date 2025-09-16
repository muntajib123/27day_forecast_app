const express = require("express");
const router = express.Router();
const LSTMForecast = require("../models/LSTMForecast");

// Save LSTM predictions
router.post("/lstm", async (req, res) => {
  try {
    await LSTMForecast.deleteMany({});
    await LSTMForecast.insertMany(req.body.predictions);
    res.json({ message: "LSTM predictions saved successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get latest 27-day LSTM forecast
router.get("/lstm", async (req, res) => {
  try {
    const forecasts = (await LSTMForecast.find({})
      .sort({ date: -1 })
      .limit(27))
      .reverse(); // earliest first

    if (!forecasts.length) {
      return res.status(404).json({ error: "No forecast data found" });
    }

    res.json(forecasts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
