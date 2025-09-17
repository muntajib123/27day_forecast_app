// backend/server.js (with shifted forecast responses)
const express = require("express");
const cors = require("cors");
const cron = require("node-cron");
const { execFile } = require("child_process");
const path = require("path");
const mongoose = require("mongoose");
const axios = require("axios");

// Expose mongoose global for noaa27.js
global.mongoose = mongoose;

const app = express();
app.use(cors());
app.use(express.json());

// ===== Config =====
const PORT = process.env.PORT || 5000;
const mongoURL =
  process.env.MONGODB_URI || "mongodb://localhost:27018/noaa_database";
const pythonScript =
  process.env.PYTHON_SCRIPT_PATH ||
  path.join(__dirname, "python", "predict_lstm.py");
const pythonExe =
  process.env.PYTHON_EXE ||
  (process.platform === "win32"
    ? path.join(__dirname, "venv", "Scripts", "python.exe")
    : "python3");

const USE_NODE_CRON = (process.env.USE_NODE_CRON || "true").toLowerCase() === "true";
const SKIP_STARTUP_RUN = (process.env.SKIP_STARTUP_RUN || "false").toLowerCase() === "true";

// ===== Connect MongoDB =====
mongoose
  .connect(mongoURL)
  .then(() => {
    console.log("✅ MongoDB connected");
    (async () => {
      try {
        const { updateNOAA27Day } = require("./noaa27");
        await updateNOAA27Day();
      } catch (e) {
        console.error("NOAA updater (startup) error:", e.message || e);
      }
    })();
  })
  .catch((err) => console.error("❌ MongoDB error:", err.message));

// ===== Get last NOAA date =====
async function fetchLastNOAADate() {
  try {
    const url = "https://services.swpc.noaa.gov/text/27-day-outlook.txt";
    const res = await axios.get(url, { timeout: 10000 });
    const lines = res.data
      .split("\n")
      .map((l) => l.trim())
      .filter((line) => /^\d{4}\s+[A-Za-z]{3}\s+\d{1,2}/.test(line));
    if (!lines.length) return null;
    const lastLine = lines[lines.length - 1];
    const parts = lastLine.split(/\s+/).slice(0, 3);
    const dateStr = parts.join(" ") + " UTC";
    const lastDate = new Date(dateStr);
    return isNaN(lastDate.getTime()) ? null : lastDate;
  } catch (err) {
    console.error("❌ Error fetching NOAA:", err.message);
    return null;
  }
}

// ===== Run Python LSTM =====
async function runLSTM() {
  console.log("⏰ Running Python LSTM:", pythonExe, pythonScript);
  return new Promise((resolve, reject) => {
    execFile(
      pythonExe,
      [pythonScript],
      { maxBuffer: 1024 * 1024 * 20, cwd: process.cwd() },
      (err, stdout, stderr) => {
        if (stderr && stderr.trim()) {
          console.error("=== Python stderr ===\n", stderr);
        }
        if (err) {
          return reject(
            new Error(`Python execution failed: ${err.message}\n${stderr || ""}`)
          );
        }
        const match = stdout.match(/(\[|\{)[\s\S]*(\]|\})/);
        const jsonText = match ? match[0] : stdout.trim();

        try {
          const predictions = jsonText ? JSON.parse(jsonText) : [];
          return resolve(predictions);
        } catch (e) {
          console.error("❌ Python output parse error. stdout was:\n", stdout);
          return reject(e);
        }
      }
    );
  });
}

// ===== Save LSTM predictions =====
async function savePredictions(predictions) {
  try {
    const lastNOAADate = await fetchLastNOAADate();
    if (!lastNOAADate) {
      console.log("⚠️ NOAA fetch failed. Skipping DB write for LSTM predictions.");
      return;
    }

    const lastNoaaDay = new Date(Date.UTC(
      lastNOAADate.getUTCFullYear(),
      lastNOAADate.getUTCMonth(),
      lastNOAADate.getUTCDate()
    ));

    // filter strictly > lastNOAADate
    const futurePredictions = Array.isArray(predictions)
      ? predictions.filter((p) => {
          const pd = new Date(p.date);
          const pdDay = new Date(Date.UTC(pd.getUTCFullYear(), pd.getUTCMonth(), pd.getUTCDate()));
          return pdDay.getTime() > lastNoaaDay.getTime();
        })
      : [];

    if (!futurePredictions.length) {
      console.log("⚠️ No new future predictions to save.");
      return;
    }

    const coll = mongoose.connection.db.collection("forecast_lstm_27day");

    // cleanup: remove overlapping docs
    const deleteRes = await coll.deleteMany({ date: { $lte: lastNoaaDay } });
    if (deleteRes.deletedCount > 0) {
      console.log(`🧹 Removed ${deleteRes.deletedCount} overlapping LSTM docs up to ${lastNoaaDay.toISOString().slice(0,10)}`);
    }

    const bulkOps = futurePredictions.map((p) => {
      const dt = new Date(p.date);
      const dtUTC = new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate()));
      return {
        updateOne: {
          filter: { date: dtUTC },
          update: {
            $set: {
              date: dtUTC,
              f107: p.f107,
              a_index: p.a_index,
              kp_max: p.kp_max,
              // normalized
              radio_flux: p.f107,
              ap_index: p.a_index,
              kp_index: p.kp_max,
              source: "lstm"
            }
          },
          upsert: true
        }
      };
    });

    const result = await coll.bulkWrite(bulkOps, { ordered: false });
    console.log(`✅ Upserted ${result.upsertedCount + result.modifiedCount} predictions (after ${lastNoaaDay.toISOString().slice(0,10)}).`);
  } catch (e) {
    console.error("❌ Error saving predictions:", e.message || e);
  }
}

// ===== Generate & Save wrapper =====
let isRunning = false;
async function generateAndSave() {
  if (isRunning) {
    console.log("⏳ Prediction run already in progress — skipping.");
    return;
  }
  isRunning = true;
  try {
    const predictions = await runLSTM();
    await savePredictions(predictions);
  } catch (e) {
    console.error("Forecast generation error:", e.message || e);
  } finally {
    isRunning = false;
  }
}

// ===== Cron jobs =====
if (USE_NODE_CRON) {
  cron.schedule(
    "0 6 * * *",
    async () => {
      console.log("🔁 In-app cron triggered at 06:00 Asia/Kolkata (LSTM)");
      await generateAndSave();
    },
    { timezone: "Asia/Kolkata" }
  );
  console.log("🕒 In-app LSTM cron enabled (06:00 Asia/Kolkata).");

  cron.schedule(
    "10 16 * * *",
    async () => {
      console.log("🔁 In-app cron triggered: NOAA 27-day refresh (16:10 UTC)");
      try {
        const { updateNOAA27Day } = require("./noaa27");
        await updateNOAA27Day();
      } catch (e) {
        console.error("NOAA cron update failed:", e.message || e);
      }
    },
    { timezone: "UTC" }
  );
  console.log("🕒 In-app NOAA cron enabled (16:10 UTC daily).");
} else {
  console.log("🚫 In-app cron disabled. Use external cron (Render Cron Job).");
}

// ===== Run once on startup =====
(async () => {
  if (!SKIP_STARTUP_RUN) {
    console.log("⚡ Running initial forecast generation on startup");
    await generateAndSave();
  } else {
    console.log("⚡ Skipping startup run (SKIP_STARTUP_RUN=true)");
  }
})();

// ===== Routes =====
function mapDoc(d) {
  return {
    date: d.date ? new Date(d.date).toISOString() : null,
    f107: d.f107,
    a_index: d.a_index,
    kp_max: d.kp_max,
    // normalized
    radio_flux: d.radio_flux ?? d.f107,
    ap_index: d.ap_index ?? d.a_index,
    kp_index: d.kp_index ?? d.kp_max,
    source: d.source || "unknown"
  };
}

// helper: shift docs so forecast starts from tomorrow (UTC)
function shiftToTomorrow(docs) {
  if (!docs.length) return [];

  const msPerDay = 24 * 60 * 60 * 1000;

  const firstDate = new Date(docs[0].date);
  const now = new Date();
  const todayUtc = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(), 0,0,0,0
  ));
  const desiredStart = new Date(todayUtc.getTime() + msPerDay);

  const shiftDays = Math.round((desiredStart - firstDate) / msPerDay);

  return docs.slice(0, 27).map(d => {
    const shifted = { ...mapDoc(d) };
    const origDate = new Date(d.date);
    shifted.date = new Date(origDate.getTime() + shiftDays * msPerDay).toISOString();
    return shifted;
  });
}

// Shifted LSTM forecasts
app.get("/api/predictions/lstm", async (_req, res) => {
  try {
    const coll = mongoose.connection.db.collection("forecast_lstm_27day");
    const docs = await coll.find({}).sort({ date: 1 }).toArray();
    if (!docs.length) return res.status(404).json({ error: "No forecast data found" });
    res.json(shiftToTomorrow(docs));
  } catch (e) {
    res.status(500).json({ error: e.message || "Server error" });
  }
});

// Shifted 27-day NOAA forecasts
app.get("/api/predictions/27day", async (_req, res) => {
  try {
    const col = mongoose.connection.db.collection("forecast_27day");
    const docs = await col.find({}).sort({ date: 1 }).toArray();
    if (!docs.length) return res.status(404).json({ error: "No forecast data found" });
    res.json(shiftToTomorrow(docs));
  } catch (e) {
    console.error("Error /api/predictions/27day:", e);
    res.status(500).json({ error: "Failed to fetch 27-day forecast" });
  }
});

// Combined forecasts (no shifting applied here)
app.get("/api/predictions/combined", async (_req, res) => {
  try {
    const noaaCol = mongoose.connection.db.collection("forecast_27day");
    const lstmCol = mongoose.connection.db.collection("forecast_lstm_27day");
    const noaaDocs = await noaaCol.find({}).sort({ date: 1 }).toArray();
    const lstmDocs = await lstmCol.find({}).sort({ date: 1 }).toArray();
    const all = [...noaaDocs, ...lstmDocs].sort((a, b) => new Date(a.date) - new Date(b.date));
    res.json(all.map(mapDoc));
  } catch (e) {
    res.status(500).json({ error: e.message || "Failed to fetch combined forecast" });
  }
});

app.get("/health", (_req, res) => res.status(200).json({ ok: true }));

app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
