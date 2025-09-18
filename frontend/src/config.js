// src/config.js

// Pick API base URL from environment variable first.
// Fallback to your deployed Render backend if not defined.
export const API_URL =
  process.env.REACT_APP_API_URL || "https://two7day-forecast-app.onrender.com";
