// backend/scripts/import_noaa.js
// Usage: node backend/scripts/import_noaa.js
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");

const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/forecast_db";

// adjust if your model path differs
const PredictionModelPath = path.join(__dirname, "..", "models", "Prediction.js");

// load model (requires the file to export a Mongoose model)
require(PredictionModelPath);
const Prediction = mongoose.model("Prediction");

async function parseNoaaFile(txtPath) {
  const raw = fs.readFileSync(txtPath, "utf8");
  const lines = raw.split("\n").map(l => l.trim());
  // lines that start with year (e.g. "2025 Sep 15 ...")
  const dataLines = lines.filter(l => /^\d{4}\s+\w+\s+\d{1,2}/.test(l));
  const monthMap = {
    Jan:"01", Feb:"02", Mar:"03", Apr:"04", May:"05", Jun:"06",
    Jul:"07", Aug:"08", Sep:"09", Oct:"10", Nov:"11", Dec:"12"
  };
  const docs = dataLines.map(line => {
    const parts = line.split(/\s+/);
    if (parts.length < 6) return null;
    const year = parts[0];
    const mon = parts[1];
    const day = parts[2].padStart(2,"0");
    const month = monthMap[mon] || "01";
    const iso = `${year}-${month}-${day}T00:00:00.000Z`;
    const radio_flux = Number(parts[3]);
    const ap_index = Number(parts[4]);
    const kp_index = Number(parts[5]);
    return {
      date: iso,
      f107: radio_flux,
      radio_flux,
      ap_index,
      a_index: ap_index,
      kp_index,
      kp_max: kp_index,
      source: "noaa"
    };
  }).filter(Boolean);
  return docs;
}

(async () => {
  try {
    console.log("Connecting to MongoDB:", MONGO_URI);
    await mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    console.log("Connected.");

    const txtPath = path.join(__dirname, "..", "python", "27 day forecast.txt");
    if (!fs.existsSync(txtPath)) {
      console.error("NOAA text file not found at:", txtPath);
      process.exit(1);
    }

    const docs = await parseNoaaFile(txtPath);
    if (!docs || docs.length === 0) {
      console.error("No valid NOAA lines parsed from file.");
      process.exit(1);
    }

    // Replace Prediction collection with parsed NOAA docs
    console.log("Replacing Prediction collection with", docs.length, "NOAA rows...");
    await Prediction.deleteMany({});
    await Prediction.insertMany(docs);
    console.log("Done. Inserted", docs.length, "documents into Prediction collection.");

    // quick sanity print of first 3
    const sample = await Prediction.find({}).sort({ date: 1 }).limit(6).lean();
    console.log("Sample rows:");
    sample.forEach(r => console.log(r.date, r.radio_flux, r.ap_index, r.kp_index, r.source));
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error("Error:", err);
    process.exit(1);
  }
})();
