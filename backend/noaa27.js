// backend/noaa27.js
// Fetch NOAA 27-day outlook and store into MongoDB collection "forecast_27day"

const axios = require("axios");

const NOAA_URL = "https://services.swpc.noaa.gov/text/27-day-outlook.txt";
const COLLECTION = process.env.NOAA_COLLECTION || "forecast_27day";

// Convert to UTC midnight
function toUTCDateOnly(value) {
  const dt = value instanceof Date ? value : new Date(value);
  if (isNaN(dt)) return null;
  return new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate()));
}

// Parse NOAA text
function parse27DayText(txt) {
  const lines = txt.split(/\r?\n/).map((l) => l.replace(/\u00A0/g, " ").trim());
  const dataLines = lines.filter((l) => /^\d{4}\s+[A-Za-z]{3}\s+\d{1,2}\s+/.test(l));
  const rows = [];

  for (const line of dataLines) {
    const parts = line.split(/\s+/);
    if (parts.length < 4) continue;

    const [yearStr, monStr, dayStr, ...rest] = parts;
    const year = parseInt(yearStr, 10);
    const day = parseInt(dayStr, 10);
    if (isNaN(year) || isNaN(day)) continue;

    const numericTokens = rest.filter((t) => /^-?\d+(\.\d+)?$/.test(t));
    if (numericTokens.length < 3) continue;

    const f107 = Number(numericTokens[0]);
    const a_index = Number(numericTokens[1]);
    const kp_max = Number(numericTokens[2]);

    const cand = new Date(`${year} ${monStr} ${day} UTC`);
    const dateUTC = toUTCDateOnly(cand);
    if (!dateUTC) continue;

    rows.push({ date: dateUTC, f107, a_index, kp_max });
  }

  const map = new Map();
  for (const r of rows) map.set(r.date.getTime(), r);
  return Array.from(map.values()).sort((a, b) => a.date - b.date);
}

// Fetch NOAA text
async function fetchNOAA27() {
  const res = await axios.get(NOAA_URL, { timeout: 15000, responseType: "text" });
  return parse27DayText(res.data);
}

// Ensure unique index
async function ensureDateIndex(col) {
  try {
    await col.createIndex({ date: 1 }, { unique: true, background: true });
  } catch (err) {
    console.warn("noaa27.js: createIndex(date) warning:", err.message || err);
  }
}

// Updater
async function updateNOAA27Day() {
  if (!global.mongoose || !global.mongoose.connection || !global.mongoose.connection.db) {
    throw new Error("Mongoose connection not ready. Call update after mongoose.connect()");
  }

  const rows = await fetchNOAA27();
  if (!rows || rows.length === 0) throw new Error("No rows parsed from NOAA 27-day file");

  const db = global.mongoose.connection.db;
  const col = db.collection(COLLECTION);

  await ensureDateIndex(col);

  const bulkOps = [];
  const newDates = [];

  for (const r of rows) {
    const dateObj = toUTCDateOnly(r.date);
    if (!dateObj) continue;

    newDates.push(dateObj);

    const doc = {
      date: dateObj,
      f107: r.f107 ?? null,
      a_index: r.a_index ?? null,
      kp_max: r.kp_max ?? null,
      radio_flux: r.f107 ?? null,
      ap_index: r.a_index ?? null,
      kp_index: r.kp_max ?? null,
      source: "noaa",
      fetched_at: new Date(),
    };

    bulkOps.push({
      updateOne: {
        filter: { date: dateObj }, // ✅ only match on date
        update: { $set: doc, $currentDate: { updatedAt: true } },
        upsert: true,
      },
    });
  }

  if (bulkOps.length) {
    await col.bulkWrite(bulkOps, { ordered: false });
  }

  // Cleanup: remove rows not in the new NOAA file
  await col.deleteMany({ date: { $nin: newDates } });

  console.log(
    `✅ NOAA 27-day: upserted ${rows.length} rows into "${COLLECTION}" (${newDates[0].toISOString().slice(0, 10)} → ${newDates[newDates.length - 1].toISOString().slice(0, 10)})`
  );

  return rows.length;
}

module.exports = {
  fetchNOAA27,
  parse27DayText,
  updateNOAA27Day,
  toUTCDateOnly,
};
