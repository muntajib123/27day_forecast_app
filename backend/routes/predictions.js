// backend/routes/predictions.js
const express = require("express");
const router = express.Router();
const fs = require("fs");
const path = require("path");

const Prediction = require("../models/Prediction");
const LSTMForecast = require("../models/LSTMForecast");

/* --- helper: build shifted 27 from stored LSTM (unchanged) --- */
async function buildShifted27() {
  const all = await LSTMForecast.find({}).sort({ date: 1 });
  if (!all || all.length < 27) return null;

  function toDate(d) {
    if (!d) return null;
    return d instanceof Date ? new Date(d) : new Date(d);
  }

  const currentFirstRaw = toDate(all[0].date);
  const currentFirstUtcMidnight = new Date(Date.UTC(
    currentFirstRaw.getUTCFullYear(),
    currentFirstRaw.getUTCMonth(),
    currentFirstRaw.getUTCDate(),
    0,0,0,0
  ));

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

  return all.slice(0, 27).map(doc => {
    const obj = doc.toObject ? doc.toObject() : { ...doc };
    const origDate = toDate(obj.date);
    const newDate = new Date(origDate.getTime() + shiftDays * msPerDay);
    obj.date = newDate.toISOString();
    if (obj.__v !== undefined) delete obj.__v;
    return obj;
  });
}

/* --- POST: save raw predictions collection (NOAA/raw) --- */
router.post("/", async (req, res) => {
  try {
    // replace existing raw Prediction documents with provided ones
    await Prediction.deleteMany({});
    if (Array.isArray(req.body.predictions) && req.body.predictions.length) {
      await Prediction.insertMany(req.body.predictions);
    }
    res.json({ message: "Raw predictions saved successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/* --- POST: save LSTM predictions --- */
router.post("/lstm", async (req, res) => {
  try {
    await LSTMForecast.deleteMany({});
    if (Array.isArray(req.body.predictions) && req.body.predictions.length) {
      await LSTMForecast.insertMany(req.body.predictions);
    }
    res.json({ message: "LSTM predictions saved successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/* --- GET: LSTM (shifted) remains the same --- */
router.get("/lstm", async (req, res) => {
  try {
    const shifted = await buildShifted27();
    if (!shifted) return res.status(404).json({ error: "Not enough LSTM forecast data (need 27 days)" });
    return res.json(shifted);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

/*
  GET /27day
  Priority (to return exact NOAA raw values):
    1) Try DB: return only docs with source: "noaa" (preference for true NOAA rows).
    2) Else try local NOAA file "27 day forecast.txt".
    3) Else fallback to shifted LSTM (as before).
*/
router.get("/27day", async (req, res) => {
  try {
    // 1) Try DB raw NOAA predictions (only docs explicitly labelled as NOAA)
    const rawNoaaDocs = await Prediction.find({ source: "noaa" }).sort({ date: 1 });
    if (Array.isArray(rawNoaaDocs) && rawNoaaDocs.length > 0) {
      const out = rawNoaaDocs.map(r => {
        const obj = r.toObject ? r.toObject() : { ...r };
        if (obj.date) obj.date = (new Date(obj.date)).toISOString();
        if (obj.__v !== undefined) delete obj.__v;
        return obj;
      });
      return res.json(out);
    }

    // 1b) If no docs labelled source:'noaa', try any docs that look like NOAA (defensive)
    const anyDocs = await Prediction.find({}).sort({ date: 1 }).limit(50);
    if (Array.isArray(anyDocs) && anyDocs.length >= 27) {
      // Heuristic: check if the values look like NOAA (ap_index small ints, kp small)
      const candidate = anyDocs.slice(0, 27).map(r => r.toObject ? r.toObject() : { ...r });
      const looksLikeNoaa = candidate.every(d =>
        typeof d.radio_flux === "number" &&
        typeof d.ap_index === "number" &&
        typeof d.kp_index === "number" &&
        d.ap_index < 50 // simple guard to avoid weird huge ap values
      );
      if (looksLikeNoaa) {
        const out = candidate.map(d => {
          if (d.date) d.date = (new Date(d.date)).toISOString();
          if (d.__v !== undefined) delete d.__v;
          return d;
        });
        return res.json(out);
      }
    }

    // 2) Try local NOAA text file (fallback)
    const txtPath = path.join(__dirname, "..", "python", "27 day forecast.txt");
    if (fs.existsSync(txtPath)) {
      const raw = fs.readFileSync(txtPath, "utf8");
      // parse lines that start with a year (e.g. 2025 Sep 15 ...)
      const lines = raw.split("\n").map(l => l.trim()).filter(l => /^\d{4}\s+\w+\s+\d{1,2}/.test(l));
      const mappingMonth = {
        Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06",
        Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12"
      };
      const parsed = lines.map(line => {
        // expected format: YYYY Mon DD <radio_flux> <Aindex> <Kp>
        const parts = line.split(/\s+/);
        // defensive length check
        if (parts.length < 6) return null;
        const year = parts[0];
        const mon = parts[1];
        const day = parts[2].padStart(2,"0");
        const monthNum = mappingMonth[mon] || "01";
        const iso = `${year}-${monthNum}-${day}T00:00:00.000Z`;
        return {
          date: iso,
          radio_flux: Number(parts[3]),
          ap_index: Number(parts[4]),
          kp_index: Number(parts[5]),
          source: "noaa"
        };
      }).filter(Boolean);
      if (parsed.length) return res.json(parsed);
    }

    // 3) Fallback: shifted LSTM (what you had before)
    const shifted = await buildShifted27();
    if (!shifted) return res.status(404).json({ error: "No 27-day data available" });
    return res.json(shifted);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

module.exports = router;
