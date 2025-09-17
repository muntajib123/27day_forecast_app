// backend/noaa27.js
// Fetch NOAA 27-day outlook and store into MongoDB collection "forecast_27day"
// Assumes server.js sets global.mongoose = require('mongoose')

const axios = require('axios');

const NOAA_URL = 'https://services.swpc.noaa.gov/text/27-day-outlook.txt';
const COLLECTION = process.env.NOAA_COLLECTION || 'forecast_27day';

/**
 * Convert a Date-like value to a Date at UTC midnight (00:00:00.000Z).
 * Returns a Date instance or null if invalid.
 */
function toUTCDateOnly(value) {
  const dt = value instanceof Date ? value : new Date(value);
  if (isNaN(dt)) return null;
  return new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate()));
}

/**
 * Parse NOAA 27-day text into rows.
 * Each row: { date: Date (UTC-midnight), f107: Number, a_index: Number, kp_max: Number }
 */
function parse27DayText(txt) {
  const lines = txt.split(/\r?\n/).map((l) => l.replace(/\u00A0/g, ' ').trim());
  const dataLines = lines.filter((l) => /^\d{4}\s+[A-Za-z]{3}\s+\d{1,2}\s+/.test(l));
  const rows = [];

  for (const line of dataLines) {
    // split on whitespace (handles variable spacing)
    const parts = line.split(/\s+/);
    if (parts.length < 4) continue;

    const [yearStr, monStr, dayStr, ...rest] = parts;
    const year = parseInt(yearStr, 10);
    const day = parseInt(dayStr, 10);
    if (isNaN(year) || isNaN(day)) continue;

    // find numeric tokens in the remainder (f107, a_index, kp_max)
    const numericTokens = rest.filter((t) => /^-?\d+(\.\d+)?$/.test(t));
    if (numericTokens.length < 3) continue;

    const f107 = Number(numericTokens[0]);
    const a_index = Number(numericTokens[1]);
    const kp_max = Number(numericTokens[2]);

    // Build a date from "YYYY MON DD" in UTC
    const cand = new Date(`${year} ${monStr} ${day} UTC`);
    const dateUTC = toUTCDateOnly(cand);
    if (!dateUTC) continue;

    rows.push({
      date: dateUTC,
      f107,
      a_index,
      kp_max,
    });
  }

  // Deduplicate (last wins) and sort ascending
  const map = new Map();
  for (const r of rows) map.set(r.date.getTime(), r);
  const out = Array.from(map.values()).sort((a, b) => a.date - b.date);
  return out;
}

/**
 * Fetch NOAA 27-day outlook text and parse
 */
async function fetchNOAA27() {
  const res = await axios.get(NOAA_URL, { timeout: 15000, responseType: 'text' });
  return parse27DayText(res.data);
}

/**
 * Ensure unique index on date (Date type).
 */
async function ensureDateIndex(col) {
  try {
    await col.createIndex({ date: 1 }, { unique: true, background: true });
  } catch (err) {
    // don't crash the whole process just for index creation problems,
    // but surface a warning so you can inspect later
    console.warn('noaa27.js: createIndex(date) warning:', err && err.message ? err.message : err);
  }
}

/**
 * Main updater: fetch -> parse -> bulk upsert -> remove stale NOAA rows
 */
async function updateNOAA27Day() {
  if (!global.mongoose || !global.mongoose.connection || !global.mongoose.connection.db) {
    throw new Error('Mongoose connection not ready. Call update after mongoose.connect()');
  }

  const rows = await fetchNOAA27();
  if (!rows || rows.length === 0) {
    throw new Error('No rows parsed from NOAA 27-day file');
  }

  const db = global.mongoose.connection.db;
  const col = db.collection(COLLECTION);

  // Ensure index
  await ensureDateIndex(col);

  // Build bulk upsert ops. Store both original names (f107, a_index, kp_max)
  // and normalized names (radio_flux, ap_index, kp_index) for compatibility.
  const bulkOps = [];
  const newDates = []; // list of Date objects

  for (const r of rows) {
    const dateObj = toUTCDateOnly(r.date);
    if (!dateObj) continue;

    newDates.push(dateObj);

    const doc = {
      date: dateObj,
      // original field names retained
      f107: (r.f107 !== undefined && r.f107 !== null) ? Number(r.f107) : null,
      a_index: (r.a_index !== undefined && r.a_index !== null) ? Number(r.a_index) : null,
      kp_max: (r.kp_max !== undefined && r.kp_max !== null) ? Number(r.kp_max) : null,
      // normalized field names for future-proofing
      radio_flux: (r.f107 !== undefined && r.f107 !== null) ? Number(r.f107) : null,
      ap_index: (r.a_index !== undefined && r.a_index !== null) ? Number(r.a_index) : null,
      kp_index: (r.kp_max !== undefined && r.kp_max !== null) ? Number(r.kp_max) : null,
      source: 'noaa',
      fetched_at: new Date(),
    };

    // Ensure no NaNs
    if (Number.isNaN(doc.f107)) doc.f107 = null;
    if (Number.isNaN(doc.a_index)) doc.a_index = null;
    if (Number.isNaN(doc.kp_max)) doc.kp_max = null;
    if (Number.isNaN(doc.radio_flux)) doc.radio_flux = null;
    if (Number.isNaN(doc.ap_index)) doc.ap_index = null;
    if (Number.isNaN(doc.kp_index)) doc.kp_index = null;

    bulkOps.push({
      updateOne: {
        filter: { date: dateObj, source: 'noaa' }, // use date+source as filter to be explicit
        update: { $set: doc, $currentDate: { updatedAt: true } },
        upsert: true,
      },
    });
  }

  if (bulkOps.length) {
    await col.bulkWrite(bulkOps, { ordered: false });
  }

  // Remove old NOAA rows not in the new set.
  // We compare by Date objects: newDates is an array of Date instances.
  await col.deleteMany({
    source: 'noaa',
    date: { $nin: newDates },
  });

  console.log(`✅ NOAA 27-day: upserted ${rows.length} rows into "${COLLECTION}" (${newDates[0].toISOString().slice(0,10)} → ${newDates[newDates.length - 1].toISOString().slice(0,10)})`);
  return rows.length;
}

module.exports = {
  fetchNOAA27,
  parse27DayText,
  updateNOAA27Day,
  toUTCDateOnly,
};
