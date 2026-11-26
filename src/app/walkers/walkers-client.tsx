"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Plus, Search, UserRound, MapPin, Phone, Pencil, X, CheckCircle2 } from "lucide-react";
import Link from "next/link";

type Walker = {
  id: string; walker_code: string; full_name: string; mobile_number: string;
  local_address: string; permanent_address: string; aadhaar_received: number;
  pan_received: number; status: "active" | "inactive"; created_at: string;
};
type FormState = {
  full_name: string; mobile_number: string; local_address: string; permanent_address: string;
  aadhaar_received: boolean; pan_received: boolean;
};
const blankForm: FormState = { full_name: "", mobile_number: "", local_address: "", permanent_address: "", aadhaar_received: false, pan_received: false };

export default function WalkersClient() {
  const [walkers, setWalkers] = useState<Walker[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Walker | null>(null);
  const [form, setForm] = useState<FormState>(blankForm);
  const [saving, setSaving] = useState(false);

  async function loadWalkers() {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/walkers");
      if (response.status === 401) { window.location.assign("/login"); return; }
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Walker records could not be loaded.");
      setWalkers(data.walkers || []);
    } catch (e) { setError(e instanceof Error ? e.message : "Walker records could not be loaded."); }
    finally { setLoading(false); }
  }
  useEffect(() => { void loadWalkers(); }, []);

  const filtered = useMemo(() => walkers.filter(w => (w.full_name + " " + w.mobile_number + " " + w.walker_code + " " + w.local_address).toLowerCase().includes(query.toLowerCase())), [walkers, query]);
  const activeCount = walkers.filter(w => w.status === "active").length;
  const collectedCount = walkers.filter(w => w.aadhaar_received && w.pan_received).length;

  function openNew() { setEditing(null); setForm(blankForm); setShowForm(true); }
  function openEdit(w: Walker) {
    setEditing(w);
    setForm({ full_name: w.full_name, mobile_number: w.mobile_number, local_address: w.local_address, permanent_address: w.permanent_address, aadhaar_received: !!w.aadhaar_received, pan_received: !!w.pan_received });
    setShowForm(true);
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError("");
    try {
      const response = await fetch("/api/walkers", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editing ? { ...form, id: editing.id } : form)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Walker could not be saved.");
      setShowForm(false); setEditing(null); setForm(blankForm); await loadWalkers();
    } catch (e) { setError(e instanceof Error ? e.message : "Walker could not be saved."); }
    finally { setSaving(false); }
  }
  async function toggleStatus(w: Walker) {
    const status = w.status === "active" ? "inactive" : "active";
    try {
      const response = await fetch("/api/walkers", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: w.id, action: "status", status }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Status could not be updated.");
      await loadWalkers();
    } catch (e) { setError(e instanceof Error ? e.message : "Status could not be updated."); }
  }

  return <main className="main walker-main">
    <div className="topbar">
      <div><Link href="/" className="back-link"><ArrowLeft size={15}/> Dashboard</Link><div className="eyebrow">Team management</div><h1 className="page-title">Walker Management</h1><p className="subtle">Register walkers and maintain their document collection checklist.</p></div>
      <button className="action" onClick={openNew}><Plus size={15}/> Register walker</button>
    </div>
    {error && <div className="error-box">{error}</div>}
    <div className="walker-stats">
      <div className="walker-stat"><span>Total walkers</span><strong>{walkers.length}</strong></div>
      <div className="walker-stat"><span>Active walkers</span><strong>{activeCount}</strong></div>
      <div className="walker-stat"><span>Aadhaar + PAN collected</span><strong>{collectedCount}</strong></div>
    </div>
    {showForm && <form className="panel walker-form" onSubmit={submit}>
      <div className="panel-head"><div><div className="panel-title">{editing ? "Edit walker details" : "New walker registration"}</div><div className="panel-note">Only admin can add or update walker records.</div></div><button type="button" className="plain-button" onClick={() => setShowForm(false)}><X size={15}/> Close</button></div>
      <div className="form-grid">
        <label>Full name *<input required minLength={2} maxLength={100} value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} placeholder="Walker full name"/></label>
        <label>Mobile number *<input required type="tel" inputMode="tel" maxLength={20} value={form.mobile_number} onChange={e => setForm({ ...form, mobile_number: e.target.value })} placeholder="+91 98XXXXXXXX"/></label>
        <label className="full-field">Local address *<textarea required rows={2} maxLength={500} value={form.local_address} onChange={e => setForm({ ...form, local_address: e.target.value })} placeholder="Current address, flat / society / landmark"/></label>
        <label className="full-field">Permanent address *<textarea required rows={2} maxLength={500} value={form.permanent_address} onChange={e => setForm({ ...form, permanent_address: e.target.value })} placeholder="Permanent home address"/></label>
      </div>
      <div className="walker-documents">
        <div><div className="panel-title">Document collection</div><div className="panel-note">Tick only after the physical document is received. No file upload.</div></div>
        <label className="walker-check"><input type="checkbox" checked={form.aadhaar_received} onChange={e => setForm({ ...form, aadhaar_received: e.target.checked })}/><span>Aadhaar Card received</span></label>
        <label className="walker-check"><input type="checkbox" checked={form.pan_received} onChange={e => setForm({ ...form, pan_received: e.target.checked })}/><span>PAN Card received</span></label>
      </div>
      <div className="form-actions"><button className="action" disabled={saving}>{saving ? "Saving…" : editing ? "Save changes" : "Register walker"}</button></div>
    </form>}
    <section className="panel walker-list-panel">
      <div className="list-toolbar"><div><div className="panel-title">{filtered.length} walker{filtered.length === 1 ? "" : "s"}</div><div className="panel-note">Admin-only records</div></div><div className="search-box"><Search size={15}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search name, mobile or ID"/></div></div>
      {loading ? <div className="empty">Loading walker records…</div> : filtered.length === 0 ? <div className="empty"><UserRound size={24}/><strong>{walkers.length ? "No matching walkers" : "No walkers registered yet"}</strong>{walkers.length ? "Try another search." : "Register the first walker to start the team record."}</div> :
        <div className="record-list">{filtered.map(w => <article className="walker-card" key={w.id}>
          <div className="walker-card-top"><div className="walker-identity"><div className="walker-avatar"><UserRound size={18}/></div><div><div className="record-heading"><strong>{w.full_name}</strong><span className={`record-status ${w.status === "active" ? "status-active" : "status-inactive"}`}>{w.status}</span></div><div className="record-subtitle">{w.walker_code} · {w.mobile_number}</div></div></div><button className="walker-edit" onClick={() => openEdit(w)}><Pencil size={14}/> Edit</button></div>
          <div className="walker-addresses"><div><MapPin size={13}/><span><b>Local:</b> {w.local_address}</span></div><div><MapPin size={13}/><span><b>Permanent:</b> {w.permanent_address}</span></div></div>
          <div className="walker-card-bottom"><div className="walker-doc-status"><span className={w.aadhaar_received ? "collected" : "pending"}>{w.aadhaar_received ? <CheckCircle2 size={13}/> : <span className="empty-check"/>} Aadhaar</span><span className={w.pan_received ? "collected" : "pending"}>{w.pan_received ? <CheckCircle2 size={13}/> : <span className="empty-check"/>} PAN</span></div><button className="plain-button walker-status-toggle" onClick={() => void toggleStatus(w)}>{w.status === "active" ? "Deactivate walker" : "Activate walker"}</button></div>
        </article>)}</div>}
    </section>
  </main>;
}
