const mongoose = require("mongoose");

const PredictionSchema = new mongoose.Schema({
  date: {
    type: Date,
    required: true,
  },
  f107: {
    type: Number,
    required: true,
  },
  a_index: {
    type: Number,
    required: false, // NOAA sometimes gives a_index
  },
  ap_index: {
    type: Number,
    required: false, // LSTM version often has ap_index
  },
  kp_index: {
    type: Number,
    required: false,
  },
  kp_max: {
    type: Number,
    required: false,
  },
  radio_flux: {
    type: Number,
    required: false,
  },
  source: {
    type: String,
    enum: ["noaa", "lstm", "custom"],
    default: "noaa",
  },
});

module.exports = mongoose.model("Prediction", PredictionSchema);
