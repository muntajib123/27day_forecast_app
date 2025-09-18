// src/utils/api.js
// Use Render backend when deployed, localhost for dev
const API_BASE =
  process.env.REACT_APP_API_BASE ||
  "https://two7day-forecast-app.onrender.com";

export async function fetchJSON(path, opts = {}) {
  const url = path.startsWith("http") ? path : `${API_BASE}${path}`;
  const res = await fetch(url, opts);
  if (!res.ok) {
    let body = null;
    try { body = await res.json(); } catch (e) { body = await res.text().catch(() => null); }
    const msg = body && body.error ? body.error : `HTTP ${res.status}`;
    const err = new Error(msg);
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return res.json();
}
