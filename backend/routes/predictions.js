// backend/routes/predictions.js
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

/**
 * Helper: build shifted 27-day forecast starting from tomorrow (UTC)
 * Returns an array of plain objects (max 27) with "date" as ISO Z string.
 */
async function buildShifted27() {
  const all = await LSTMForecast.find({}).sort({ date: 1 });
  if (!all || all.length < 27) return null;

  function toDate(d) {
    if (!d) return null;
    if (d instanceof Date) return new Date(d);
    return new Date(d);
  }

  const currentFirstRaw = toDate(all[0].date);
  const currentFirstUtcMidnight = new Date(Date.UTC(
    currentFirstRaw.getUTCFullYear(),
    currentFirstRaw.getUTCMonth(),
    currentFirstRaw.getUTCDate(),
    0,0,0,0
  ));

  // Desired start = tomorrow (UTC midnight)
  const now = new Date();
  const todayUtcMidnight = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    0,0,0,0
  ));
  const desiredStart = new Date(todayUtcMidnight.getTime() + 24 * 60 * 60 * 1000);

  const msPerDay = 24 * 60 * 60 * 1000;
  const shiftDays = Math.round((desiredStart - currentFirstUtcMidnight) / msPerDay);

  // Shift first 27 docs
  return all.slice(0, 27).map(doc => {
    const obj = doc.toObject ? doc.toObject() : { ...doc };
    const origDate = toDate(obj.date);
    const newDate = new Date(origDate.getTime() + shiftDays * msPerDay);
    obj.date = newDate.toISOString(); // force ISO Z string
    if (obj.__v !== undefined) delete obj.__v;
    return obj;
  });
}

// ✅ Route 3a: Get the shifted 27-day LSTM forecast (at /lstm)
router.get("/lstm", async (req, res) => {
  try {
    const shifted = await buildShifted27();
    if (!shifted) return res.status(404).json({ error: "Not enough forecast data (need 27 days)" });
    return res.json(shifted);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// ✅ Route 3b: Same payload also at /27day
router.get("/27day", async (req, res) => {
  try {
    const shifted = await buildShifted27();
    if (!shifted) return res.status(404).json({ error: "Not enough forecast data (need 27 days)" });
    return res.json(shifted);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

module.exports = router;
