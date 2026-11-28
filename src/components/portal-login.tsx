"use client";

import { FormEvent, useState } from "react";
import { PawPrint, ShieldCheck } from "lucide-react";

export default function PortalLogin({ role }: { role: "walker" | "customer" }) {
  const [phone, setPhone] = useState("");
  const [fullName, setFullName] = useState("");
  const [address, setAddress] = useState("");
  const [area, setArea] = useState("");
  const [registering, setRegistering] = useState(false);
  const [code, setCode] = useState("");
  const [challengeId, setChallengeId] = useState("");
  const [demoCode, setDemoCode] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const title = role === "walker" ? "Walker Login" : "Customer Login";
  const destination = role === "walker" ? "/walker/dashboard" : "/customer/dashboard";

  async function requestOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    setBusy(true);
    try {
      const response = await fetch("/api/portal-auth/request-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, phone, ...(role === "customer" && registering ? { full_name: fullName, address, area } : {}) })
      });
      const data = await response.json();
      if (data.newCustomer === true && role === "customer") {
        setRegistering(true);
        setNotice("Yeh naya customer number hai. OTP se pehle apna naam aur poora address bharein.");
        return;
      }
      if (!response.ok) { setError(data.error || "OTP request nahi ho payi."); return; }
      setChallengeId(data.challengeId);
      setDemoCode(typeof data.demoCode === "string" ? data.demoCode : "");
      setNotice(data.demoMode ? "Demo Testing Mode: SMS nahi bheja gaya. Neeche diya gaya test OTP 5 minute tak valid hai." : "OTP SMS bhej diya gaya hai. SMS milne par 5 minute ke andar verify karein.");
    } catch {
      setError("Connection problem. Dobara try karein.");
    } finally {
      setBusy(false);
    }
  }

  async function verifyOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const response = await fetch("/api/portal-auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, phone, code, challengeId })
      });
      const data = await response.json();
      if (!response.ok) { setError(data.error || "OTP verify nahi hua."); return; }
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
      <p className="login-copy">Mobile number enter karein. Purana account hai to Dashboard khulega; naya number hai to pehli baar naam aur address poocha jayega.</p>
      {!challengeId ? <form onSubmit={requestOtp} className="login-form">
        <label htmlFor="portal-phone">Mobile number</label>
        <input id="portal-phone" type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} autoComplete="tel" required minLength={10} maxLength={16} placeholder="Registered mobile number"/>
        {role === "customer" && registering && <>
          <label htmlFor="portal-full-name">Full name</label>
          <input id="portal-full-name" type="text" value={fullName} onChange={(event) => setFullName(event.target.value)} autoComplete="name" required minLength={2} maxLength={100} placeholder="Your full name"/>
          <label htmlFor="portal-address">Full address</label>
          <textarea id="portal-address" value={address} onChange={(event) => setAddress(event.target.value)} autoComplete="street-address" required minLength={5} maxLength={500} placeholder="Flat, society, street, city"/>
          <label htmlFor="portal-area">Area (optional)</label>
          <input id="portal-area" type="text" value={area} onChange={(event) => setArea(event.target.value)} maxLength={100} placeholder="Area / locality"/>
        </>}
        {notice && <p className="login-copy" role="status">{notice}</p>}
        {error && <p className="login-error" role="alert">{error}</p>}
        <button type="submit" disabled={busy || !phone.trim() || (role === "customer" && registering && (fullName.trim().length < 2 || address.trim().length < 5))}>{busy ? "Please wait…" : "Send OTP"}</button>
        {role === "customer" && registering && <p className="login-copy">Naya customer: naam aur address bhar kar OTP verify karein.</p>}
      </form> : <form onSubmit={verifyOtp} className="login-form">
        <label htmlFor="portal-phone-verified">Mobile number</label>
        <input id="portal-phone-verified" type="tel" value={phone} readOnly/>
        <label htmlFor="portal-otp">6-digit OTP</label>
        <input id="portal-otp" type="text" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} required minLength={6} maxLength={6} placeholder="Enter OTP"/>
        {error && <p className="login-error" role="alert">{error}</p>}
        {notice && <p className="login-copy" role="status">{notice}</p>}
        {demoCode && <div className="login-copy" role="note" style={{ border: "1px dashed var(--brand, #f97316)", borderRadius: 10, padding: 12 }}><strong>TEST OTP: {demoCode}</strong><br/>Sirf testing ke liye. Real SMS nahi bheja gaya.</div>}
        <button type="submit" disabled={busy || code.length !== 6}>{busy ? "Verifying…" : "Verify OTP & Sign in"}</button>
        <button type="button" className="portal-other-link" disabled={busy} onClick={() => { setChallengeId(""); setCode(""); setDemoCode(""); setNotice(""); setError(""); }}>Change mobile number</button>
      </form>}
      <div className="login-security"><ShieldCheck size={15}/> OTP verified · Secure account access</div>
    </section>
  </main>;
}
