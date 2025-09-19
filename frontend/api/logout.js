// api/logout.js
export default function handler(req, res) {
  res.setHeader("Set-Cookie", `coral_auth=; Path=/; Max-Age=0; SameSite=Lax; Secure`);
  return res.status(200).json({ ok: true });
}
