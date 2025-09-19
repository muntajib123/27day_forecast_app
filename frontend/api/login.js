// api/login.js
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, message: "Method not allowed" });
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const password = body.password;

    const SITE_PASSWORD = process.env.SITE_PASSWORD || "coralcomp7081567123";

    if (!password) return res.status(400).json({ ok: false, message: "Password required" });
    if (password !== SITE_PASSWORD) return res.status(401).json({ ok: false, message: "Invalid password" });

    const COOKIE_NAME = "coral_auth";
    const MAX_AGE = 24 * 60 * 60; // 1 day
    const cookie = `${COOKIE_NAME}=1; Path=/; Max-Age=${MAX_AGE}; SameSite=Lax; Secure`;
    res.setHeader("Set-Cookie", cookie);

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("login error:", err);
    return res.status(500).json({ ok: false, message: "Server error" });
  }
}
