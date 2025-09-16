// backend/models/LSTMModelRunner.js
const { exec } = require("child_process");
const path = require("path");
const fs = require("fs");

// ✅ Get last NOAA date from local file
function getLastNOAADate() {
  const txtPath = path.join(__dirname, "../python/27 day forecast.txt");
  if (!fs.existsSync(txtPath)) throw new Error("❌ NOAA forecast file not found at " + txtPath);

  const fileContent = fs.readFileSync(txtPath, "utf-8");
  const lines = fileContent.split("\n").filter(l => /^\d{4} \w{3} \d{2}/.test(l));
  if (!lines.length) throw new Error("❌ No valid forecast dates found in NOAA file.");

  const lastLine = lines[lines.length - 1];
  const dateStr = lastLine.split(/\s+/).slice(0, 3).join(" ");
  const parsedDate = new Date(dateStr);
  if (isNaN(parsedDate)) throw new Error("❌ Failed to parse NOAA date from line: " + lastLine);

  console.log("🌍 Last NOAA date:", parsedDate.toDateString());
  return parsedDate;
}

// ✅ Run Python LSTM script and return predictions
function runLSTMModel() {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(__dirname, "../python/predict_lstm.py");

    exec(`python "${scriptPath}"`, (err, stdout, stderr) => {
      if (err) {
        console.error("❌ Error executing LSTM Python script:", stderr || err.message);
        return reject(err);
      }

      try {
        const predictions = JSON.parse(stdout.trim());
        if (!predictions || !predictions.length) {
          console.warn("⚠️ LSTM script returned no predictions.");
        } else {
          console.log(`✅ LSTM script returned ${predictions.length} predictions.`);
        }
        resolve(predictions);
      } catch (parseErr) {
        console.error("❌ Failed to parse LSTM script output:", parseErr.message);
        reject(parseErr);
      }
    });
  });
}

module.exports = { runLSTMModel, getLastNOAADate };
