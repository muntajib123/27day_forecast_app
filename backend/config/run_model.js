const connectDB = require("./db"); // Correct path, db.js is in same folder as run_model.js
const { runLSTMModel } = require("../models/LSTMModelRunner"); // models is probably sibling to config

async function main() {
  await connectDB(); // Connect to MongoDB first
  const result = await runLSTMModel(); // Run the LSTM model
  console.log("✅ Forecast saved to database.");
  console.log(result);
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Error:", err);
  process.exit(1);
});
