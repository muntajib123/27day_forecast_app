// api/check.js
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";
const COOKIE_NAME = "coral_auth";

export default function handler(req, res) {
  const cookieHeader = req.headers.cookie || "";
  const cookie = cookieHeader.split(";").map(s => s.trim()).find(s => s.startsWith(`${COOKIE_NAME}=`));

  if (!cookie) {
    return res.status(200).json({ auth: false });
  }

  const token = cookie.split("=")[1];
  try {
    jwt.verify(token, JWT_SECRET);
    return res.status(200).json({ auth: true });
  } catch (err) {
    return res.status(200).json({ auth: false });
  }
}
