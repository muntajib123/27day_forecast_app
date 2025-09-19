// src/components/LoginGate.js
import React, { useEffect, useState } from "react";

export default function LoginGate({ children }) {
  const [loading, setLoading] = useState(true);
  const [authed, setAuthed] = useState(false);
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");

  // Check cookie on load
  useEffect(() => {
    let mounted = true;
    fetch("/api/check", { method: "GET", credentials: "include" })
      .then(r => r.json())
      .then(data => {
        if (!mounted) return;
        setAuthed(Boolean(data?.auth));
        setLoading(false);
      })
      .catch(() => {
        if (!mounted) return;
        setAuthed(false);
        setLoading(false);
      });
    return () => { mounted = false; };
  }, []);

  async function submit(e) {
    e?.preventDefault();
    setErr("");
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setAuthed(true);
        setErr("");
      } else {
        setErr(data?.message || "Login failed");
      }
    } catch (e) {
      setErr("Network error");
    }
  }

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
        <div>Checking access…</div>
      </div>
    );
  }

  if (authed) return <>{children}</>;

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "#032b24",
      color: "#fff",
      padding: 20
    }}>
      <form onSubmit={submit} style={{ width: 420, maxWidth: "95%", padding: 24, borderRadius: 8, background: "rgba(255,255,255,0.05)" }}>
        <h2 style={{ marginTop: 0 }}>CoralComp</h2>
        <p style={{ marginTop: 0 }}>Enter password to continue</p>
        <input
          autoFocus
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          style={{ width: "100%", padding: "10px 12px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.2)", background: "rgba(0,0,0,0.2)", color: "#fff" }}
        />
        <button type="submit" style={{ marginTop: 12, width: "100%", padding: "10px", borderRadius: 6 }}>
          Unlock
        </button>
        {err && <div style={{ marginTop: 8, color: "#ffb4b4" }}>{err}</div>}
      </form>
    </div>
  );
}
