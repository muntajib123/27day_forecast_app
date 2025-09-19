// api/check.js
export default function handler(req, res) {
  try {
    const cookieHeader = req.headers.cookie || "";
    const match = cookieHeader.split(";").map(s => s.trim()).find(s => s.startsWith("coral_auth="));
    if (!match) return res.status(200).json({ auth: false });
    const value = match.split("=")[1];
    if (value === "1") return res.status(200).json({ auth: true });
    return res.status(200).json({ auth: false });
  } catch (err) {
    console.error("check error:", err);
    return res.status(500).json({ auth: false });
  }
}
