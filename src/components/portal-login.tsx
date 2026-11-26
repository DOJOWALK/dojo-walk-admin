"use client";

import { FormEvent, useState } from "react";
import { PawPrint, ShieldCheck } from "lucide-react";

export default function PortalLogin({ role }: { role: "walker" | "customer" }) {
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const title = role === "walker" ? "Walker Login" : "Customer Login";
  const destination = role === "walker" ? "/walker/dashboard" : "/customer/dashboard";
  const other = role === "walker" ? { label: "Customer login", href: "/customer/login" } : { label: "Walker login", href: "/walker/login" };

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const response = await fetch("/api/portal-auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, phone, password })
      });
      const data = await response.json();
      if (!response.ok) { setError(data.error || "Login nahi ho paya."); return; }
      window.location.assign(destination);
    } catch {
      setError("Connection problem. Dobara try karein.");
    } finally {
      setBusy(false);
    }
  }

  return <main className="login-wrap">
    <section className="login-card">
      <div className="login-brand"><div className="login-mark"><PawPrint size={23}/></div><div><div className="login-title">Dojo Walk</div><div className="login-sub">{role.toUpperCase()} PORTAL</div></div></div>
      <div className="login-heading">{title}</div>
      <p className="login-copy">Apne registered mobile number aur password se sign in karein.</p>
      <form onSubmit={submit} className="login-form">
        <label htmlFor="portal-phone">Mobile number</label>
        <input id="portal-phone" type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} autoComplete="username" required minLength={7} maxLength={20} placeholder="Registered mobile number"/>
        <label htmlFor="portal-password">Password</label>
        <input id="portal-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required maxLength={128} placeholder="Enter your password"/>
        {error && <p className="login-error" role="alert">{error}</p>}
        <button type="submit" disabled={busy || !phone.trim() || !password}>{busy ? "Signing in…" : "Sign in securely"}</button>
      </form>
      <div className="login-security"><ShieldCheck size={15}/> Private account · Secure sign in</div>
      <a className="portal-other-link" href={other.href}>{other.label}</a>
    </section>
  </main>;
}
