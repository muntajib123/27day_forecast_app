// src/utils/api.js

// Base URL for backend API
// On Vercel, set REACT_APP_API_BASE in project settings -> Environment Variables
// Example: https://two7day-forecast-app.onrender.com
const API_BASE = process.env.REACT_APP_API_BASE || "";

/**
 * fetchJSON
 * A helper to fetch JSON with proper error handling.
 *
 * @param {string} path - API path (e.g. "/api/predictions/lstm") or full URL
 * @param {object} opts - fetch options
 * @returns {Promise<any>} Parsed JSON response
 */
export async function fetchJSON(path, opts = {}) {
  // If path already has "http", don't prepend API_BASE
  const url = path.startsWith("http") ? path : `${API_BASE}${path}`;

  const res = await fetch(url, opts);

  if (!res.ok) {
    // Try to parse error body if possible
    let body = null;
    try {
      body = await res.json();
    } catch (e) {
      try {
        body = await res.text();
      } catch {
        body = null;
      }
    }

    const msg = body && body.error ? body.error : `HTTP ${res.status}`;
    const err = new Error(msg);
    err.status = res.status;
    err.body = body;
    throw err;
  }

  return res.json();
}
