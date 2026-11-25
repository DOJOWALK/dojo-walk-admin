"use client";

import { FormEvent, useEffect, useState } from "react";
import { ArrowLeft, Plus, Search, Users } from "lucide-react";
import Link from "next/link";

type Customer = {
  id: string; full_name: string; phone: string; whatsapp_phone?: string;
  area?: string; booking_source: string; dog_count: number; status: string;
};

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ full_name: "", phone: "", whatsapp_phone: "", area: "", address: "", booking_source: "whatsapp", notes: "" });

  async function loadCustomers() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/customers");
      if (response.status === 401) { window.location.assign("/login"); return; }
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load customers.");
      setCustomers(data.customers || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load customers.");
    } finally { setLoading(false); }
  }

  useEffect(() => { void loadCustomers(); }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true); setError("");
    try {
      const response = await fetch("/api/customers", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Customer could not be saved.");
      setForm({ full_name: "", phone: "", whatsapp_phone: "", area: "", address: "", booking_source: "whatsapp", notes: "" });
      setShowForm(false);
      await loadCustomers();
    } catch (e) { setError(e instanceof Error ? e.message : "Customer could not be saved."); }
    finally { setSaving(false); }
  }

  const filtered = customers.filter((c) => `${c.full_name} ${c.phone} ${c.area || ""}`.toLowerCase().includes(query.toLowerCase()));

  return <main className="main">
    <div className="topbar">
      <div><Link href="/" className="back-link"><ArrowLeft size={15}/> Dashboard</Link><div className="eyebrow">Customer management</div><h1 className="page-title">Customers</h1><p className="subtle">Customer contact details, dogs, bookings and payment history.</p></div>
      <button className="action" onClick={() => setShowForm(!showForm)}><Plus size={15}/> Add customer</button>
    </div>
    {error && <div className="error-box">{error}</div>}
    {showForm && <form className="panel customer-form" onSubmit={submit}>
      <div className="panel-head"><div><div className="panel-title">New customer</div><div className="panel-note">Booking can come from WhatsApp or phone call.</div></div><button type="button" className="plain-button" onClick={() => setShowForm(false)}>Close</button></div>
      <div className="form-grid">
        <label>Customer name *<input required minLength={2} maxLength={100} value={form.full_name} onChange={e => setForm({...form,full_name:e.target.value})} placeholder="Full name"/></label>
        <label>Phone number *<input type="tel" autoComplete="tel" inputMode="tel" maxLength={20} required value={form.phone} onChange={e => setForm({...form,phone:e.target.value})} placeholder="+91 98XXXXXXXX"/></label>
        <label>WhatsApp number<input type="tel" inputMode="tel" maxLength={20} value={form.whatsapp_phone} onChange={e => setForm({...form,whatsapp_phone:e.target.value})} placeholder="If different from phone"/></label>
        <label>Area / Society<input maxLength={100} value={form.area} onChange={e => setForm({...form,area:e.target.value})} placeholder="e.g. Gaur City 2"/></label>
        <label>Address<input maxLength={200} value={form.address} onChange={e => setForm({...form,address:e.target.value})} placeholder="Flat / tower / street"/></label>
        <label>Booking source<select value={form.booking_source} onChange={e => setForm({...form,booking_source:e.target.value})}><option value="whatsapp">WhatsApp</option><option value="phone">Phone call</option><option value="walk_in">Walk-in</option><option value="other">Other</option></select></label>
        <label className="full-field">Notes<textarea rows={2} maxLength={1000} value={form.notes} onChange={e => setForm({...form,notes:e.target.value})} placeholder="Any useful notes"/></label>
      </div>
      <div className="form-actions"><button className="action" disabled={saving}>{saving ? "Saving…" : "Save customer"}</button></div>
    </form>}
    <section className="panel">
      <div className="customer-toolbar"><div className="panel-title">{customers.length} customer{customers.length === 1 ? "" : "s"}</div><div className="search-box"><Search size={15}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search name, phone or area"/></div></div>
      {loading ? <div className="empty">Loading customers…</div> : filtered.length === 0 ? <div className="empty"><Users size={24}/><strong>{customers.length ? "No matching customers" : "No customers added yet"}</strong>{customers.length ? "Try another name or phone number." : "Add your first customer to start recording dogs and bookings."}</div> :
        <div className="table-wrap"><table className="data-table"><thead><tr><th>Customer</th><th>Phone</th><th>Area</th><th>Dogs</th><th>Source</th><th>Status</th></tr></thead><tbody>{filtered.map(c => <tr key={c.id}><td><Link href={`/customers/${c.id}`} className="table-link"><strong>{c.full_name}</strong></Link></td><td>{c.phone}</td><td>{c.area || "—"}</td><td>{c.dog_count}</td><td>{c.booking_source.replace("_"," ")}</td><td><span className="status-dot">{c.status}</span></td></tr>)}</tbody></table></div>}
    </section>
  </main>;
}