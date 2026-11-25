"use client";

import { FormEvent, useState } from "react";
import { PawPrint, ShieldCheck } from "lucide-react";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password })
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error || "Login failed. Please try again.");
        return;
      }
      window.location.assign("/");
    } catch {
      setError("Connection problem. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return <main className="login-wrap">
    <section className="login-card">
      <div className="login-brand"><div className="login-mark"><PawPrint size={23}/></div><div><div className="login-title">Dojo Walk</div><div className="login-sub">ADMIN WORKSPACE</div></div></div>
      <div className="login-heading">Welcome back</div>
      <p className="login-copy">Sign in to manage customers, dogs, bookings and daily walks.</p>
      <form onSubmit={submit} className="login-form">
        <label htmlFor="admin-password">Admin password</label>
        <input id="admin-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required minLength={12} placeholder="Enter your admin password"/>
        {error && <p className="login-error" role="alert">{error}</p>}
        <button type="submit" disabled={busy || password.length < 12}>{busy ? "Signing in…" : "Sign in securely"}</button>
      </form>
      <div className="login-security"><ShieldCheck size={15}/> Admin-only access · Customer data stays private</div>
    </section>
  </main>;
}