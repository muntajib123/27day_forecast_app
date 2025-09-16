const mongoose = require("mongoose");

const lstmForecastSchema = new mongoose.Schema(
  {
    date: { type: Date, required: true, unique: true }, // proper Date type
    radio_flux: { type: Number, required: true },
    a_index: { type: Number, required: true },
    kp_index: { type: Number, required: true },
  },
  { collection: "forecast_lstm_27day" }
);

module.exports = mongoose.model("LSTMForecast", lstmForecastSchema);
