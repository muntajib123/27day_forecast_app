// api/login.js
import jwt from "jsonwebtoken";

const SITE_PASSWORD = process.env.SITE_PASSWORD || "change-me";
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";
const COOKIE_NAME = "coral_auth";
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60; // 7 days

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, message: "Method not allowed" });
  }

  try {
    const { password } = JSON.parse(req.body || "{}");

    if (!password) {
      return res.status(400).json({ ok: false, message: "Password required" });
    }

    if (password !== SITE_PASSWORD) {
      return res.status(401).json({ ok: false, message: "Invalid password" });
    }

    // create token
    const token = jwt.sign({ app: "coralcomp" }, JWT_SECRET, { expiresIn: `${COOKIE_MAX_AGE}s` });

    // Set cookie (HttpOnly, Secure for HTTPS)
    const cookie = `${COOKIE_NAME}=${token}; HttpOnly; Path=/; Max-Age=${COOKIE_MAX_AGE}; SameSite=Lax; Secure`;
    res.setHeader("Set-Cookie", cookie);

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("login error", err);
    return res.status(500).json({ ok: false, message: "Server error" });
  }
}
