// src/utils/api.js
import { API_URL } from "../config";

export async function fetchJSON(path) {
  const fullUrl = path.startsWith("/")
    ? `${API_URL}${path}`
    : `${API_URL}/${path}`;

  const res = await fetch(fullUrl, {
    headers: { Accept: "application/json" },
  });

  const text = await res.text();

  if (!res.ok) {
    console.error("API error", res.status, fullUrl, text);
    throw new Error(`API error ${res.status}: ${text}`);
  }

  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("application/json")) {
    console.error("Expected JSON but got", ct, "from", fullUrl, "response:", text);
    throw new Error(`Expected JSON but got ${ct}`);
  }

  return JSON.parse(text);
}
