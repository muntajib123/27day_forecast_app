// server.js (production-ready, minimal changes)
const express = require("express");
const cors = require("cors");
const cron = require("node-cron");
const { execFile } = require("child_process");
const path = require("path");
const mongoose = require("mongoose");
const LSTMForecast = require("./models/LSTMForecast");
const axios = require("axios");

const app = express();
app.use(cors());
app.use(express.json());

// ===== Configurable via env (safe defaults for local dev) =====
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

// If you prefer Render's Cron job, set USE_NODE_CRON = "false" in env
const USE_NODE_CRON = (process.env.USE_NODE_CRON || "true").toLowerCase() === "true";
// If you don't want an automatic run on startup, set SKIP_STARTUP_RUN=true
const SKIP_STARTUP_RUN = (process.env.SKIP_STARTUP_RUN || "false").toLowerCase() === "true";

// ===== MongoDB connection =====
mongoose
  .connect(mongoURL, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB error:", err.message));

// ===== Utility: fetch last NOAA date =====
async function fetchLastNOAADate() {
  try {
    const url = "https://services.swpc.noaa.gov/text/27-day-outlook.txt";
    const res = await axios.get(url, { timeout: 10000 });
    const lines = res.data
      .split("\n")
      .map((l) => l.trim())
      .filter((line) => /^\d{4}\s+\w{3}\s+\d{2}/.test(line));
    if (!lines.length) return null;
    const lastLine = lines[lines.length - 1];
    const dateStr = lastLine.split(/\s+/).slice(0, 3).join(" ");
    const lastDate = new Date(dateStr);
    return isNaN(lastDate.getTime()) ? null : lastDate;
  } catch (err) {
    console.error("❌ Error fetching NOAA:", err.message);
    return null;
  }
}

// ===== Run Python LSTM (uses execFile) =====
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

        // Try to extract first JSON array/object from stdout (robust if script logs)
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

// ===== Save predictions =====
async function savePredictions(predictions) {
  try {
    const lastNOAADate = await fetchLastNOAADate();
    if (!lastNOAADate) {
      console.log("⚠️ NOAA fetch failed. Skipping DB write.");
      return;
    }

    const futurePredictions = Array.isArray(predictions)
      ? predictions.filter((p) => new Date(p.date) > lastNOAADate)
      : [];

    if (!futurePredictions.length) {
      console.log("⚠️ No new future predictions to save.");
      return;
    }

    const bulkOps = futurePredictions.map((p) => ({
      updateOne: {
        filter: { date: p.date },
        update: { $set: p },
        upsert: true,
      },
    }));

    await LSTMForecast.collection.bulkWrite(bulkOps, { ordered: false });
    console.log(
      `✅ Upserted ${futurePredictions.length} predictions (after ${lastNOAADate
        .toISOString()
        .slice(0, 10)}).`
    );
  } catch (e) {
    console.error("❌ Error saving predictions:", e.message || e);
  }
}

// ===== Generate & Save wrapper with guard =====
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

// ===== Cron: optional (recommended: use external Render Cron job) =====
if (USE_NODE_CRON) {
  // Runs at 06:00 Asia/Kolkata daily (node-cron supports timezone option)
  cron.schedule(
    "0 6 * * *",
    async () => {
      console.log("🔁 In-app cron triggered at 06:00 Asia/Kolkata");
      await generateAndSave();
    },
    { timezone: "Asia/Kolkata" }
  );
  console.log("🕒 In-app cron schedule enabled (06:00 Asia/Kolkata).");
} else {
  console.log("🚫 In-app cron disabled. Use external cron (Render Cron Job).");
}

// ===== Run once on startup (optional) =====
(async () => {
  if (!SKIP_STARTUP_RUN) {
    console.log("⚡ Running initial forecast generation on startup");
    await generateAndSave();
  } else {
    console.log("⚡ Skipping startup run (SKIP_STARTUP_RUN=true)");
  }
})();

// ===== Routes =====
app.get("/api/predictions/lstm", async (req, res) => {
  try {
    const forecasts = await LSTMForecast.find({}).sort({ date: 1 });
    res.json(forecasts);
  } catch (e) {
    res.status(500).json({ error: e.message || "Server error" });
  }
});

app.get("/health", (_req, res) => res.status(200).json({ ok: true }));

app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
