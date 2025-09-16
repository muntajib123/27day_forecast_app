const express = require("express");
const router = express.Router();

const Prediction = require("../models/Prediction");
const LSTMForecast = require("../models/LSTMForecast");

// 🔄 Route 1: Save raw predictions
router.post("/", async (req, res) => {
  try {
    await Prediction.deleteMany({});
    await Prediction.insertMany(req.body.predictions);
    res.json({ message: "Raw predictions saved successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 🔄 Route 2: Save LSTM predictions
router.post("/lstm", async (req, res) => {
  try {
    await LSTMForecast.deleteMany({});
    await LSTMForecast.insertMany(req.body.predictions);
    res.json({ message: "LSTM predictions saved successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ✅ Route 3: Get the latest 27-day LSTM forecast
router.get("/lstm", async (req, res) => {
  try {
    // Fetch all and sort by date ascending
    const all = await LSTMForecast.find({}).sort({ date: 1 });

    if (!all || all.length < 27) {
      return res.status(404).json({ error: "Not enough forecast data (need 27 days)" });
    }

    // Return first 27 days (earliest to latest)
    const sliced = all.slice(0, 27);
    res.json(sliced);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
