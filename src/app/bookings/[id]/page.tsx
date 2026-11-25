"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { UserRound, PawPrint, CalendarDays, Clock3, Footprints, ReceiptText, Phone, MapPin } from "lucide-react";

type RecordData = Record<string, any>;
const STATES = ["Andhra Pradesh","Arunachal Pradesh","Assam","Bihar","Chhattisgarh","Goa","Gujarat","Haryana","Himachal Pradesh","Jharkhand","Karnataka","Kerala","Madhya Pradesh","Maharashtra","Manipur","Meghalaya","Mizoram","Nagaland","Odisha","Punjab","Rajasthan","Sikkim","Tamil Nadu","Telangana","Tripura","Uttar Pradesh","Uttarakhand","West Bengal","Andaman and Nicobar Islands","Chandigarh","Dadra and Nagar Haveli and Daman and Diu","Delhi","Jammu and Kashmir","Ladakh","Lakshadweep","Puducherry"];

export default function BookingDetail() {
  const { id } = useParams<{ id: string }>();
  const [booking, setBooking] = useState<RecordData | null>(null);
  const [payments, setPayments] = useState<RecordData[]>([]);
  const [form, setForm] = useState<RecordData | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const money = (v: any) => "₹" + Number(v || 0).toLocaleString("en-IN");
  const displayDate = (v: string) => v ? new Date(`${v}T00:00:00`).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";
  const statusLabel = (v: string) => ({ active: "Active", paused: "Paused", completed: "Completed", cancelled: "Cancelled" }[v] || v);

  async function load() {
    const [br, pr] = await Promise.all([fetch("/api/bookings"), fetch("/api/payments")]);
    if (br.status === 401 || pr.status === 401) { location.assign("/login"); return; }
    const [bj, pj] = await Promise.all([br.json(), pr.json()]);
    const item = (bj.bookings || []).find((x: RecordData) => x.id === id) || null;
    setBooking(item);
    setPayments((pj.payments || []).filter((x: RecordData) => x.booking_id === id));
    if (item) {
      const parts = String(item.area || "").split(",");
      setForm({
        owner_name: item.customer_name || "", phone: item.customer_phone || "",
        whatsapp_phone: item.whatsapp_phone || "", address: item.address || "",
        flat_tower: item.flat_tower || "", society: item.society || "",
        locality: item.locality || parts[0]?.trim() || "", city: item.city || parts[1]?.trim() || "Greater Noida West",
        state: item.state || parts.slice(2).join(",").trim() || "Uttar Pradesh", pincode: item.pincode || "",
        dog_name: item.dog_name || "", dog_breed: item.dog_breed || "",
        dog_age: item.dog_age || "", dog_size: item.dog_size || "",
        dog_gender: item.dog_gender || "", dog_temperament: item.dog_temperament || "",
        start_date: item.start_date || "", end_date: item.end_date || "",
        start_slot: item.start_slot || "morning", morning_time: item.morning_time || "07:00",
        evening_time: item.evening_time || "18:00", walks_per_day: String(item.walks_per_day || 1),
        walk_duration_minutes: String(item.walk_duration_minutes || 30),
        status: item.status || "active", booking_source: item.booking_source || "whatsapp",
        notes: item.notes || ""
      });
    }
  }
  useEffect(() => { void load(); }, [id]);

  function change(key: string, value: string) { setForm((old: RecordData | null) => old ? { ...old, [key]: value } : old); }

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!form) return;
    const confirmed = window.confirm("Kya aap ye booking, owner aur dog details save karna chahte hain?");
    if (!confirmed) return;
    if (Number(form.walk_duration_minutes) !== Number(booking?.walk_duration_minutes)) {
      const rateConfirmed = window.confirm("Dhyan dein: walk duration badalne se is booking ki purani completed walks ki billing bhi recalculate ho sakti hai. Kya aap phir bhi continue karna chahte hain?");
      if (!rateConfirmed) return;
    }
    setSaving(true); setError(""); setSuccess("");
    try {
      const r = await fetch("/api/bookings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, id, walks_per_day: Number(form.walks_per_day), walk_duration_minutes: Number(form.walk_duration_minutes) }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Changes could not be saved.");
      setEditing(false); setSuccess("Booking profile updated successfully."); await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Changes could not be saved."); }
    finally { setSaving(false); }
  }

  if (!booking) return <main className="main"><Link href="/bookings" className="back-link">← Bookings</Link><section className="panel">Loading booking details…</section></main>;

  return <main className="main">
    <Link href="/bookings" className="back-link">← Bookings</Link>
    <div className="topbar"><div><div className="eyebrow">Booking profile</div><h1 className="page-title">{booking.dog_name} · Booking</h1><p className="subtle">View and update this booking, owner and dog information.</p></div><button className="action" type="button" onClick={() => { if (editing) { if (window.confirm("Kya aap editing band karke unsaved changes discard karna chahte hain?")) { setEditing(false); void load(); } } else { setEditing(true); setError(""); setSuccess(""); } }}>{editing ? "Close edit" : "Edit booking"}</button></div>
    {error && <div className="error-box">{error}</div>}{success && <div className="success-box">{success}</div>}
    {editing && form && <form className="panel customer-form" onSubmit={save}>
      <div className="panel-head"><div><div className="panel-title">Edit booking profile</div><div className="panel-note">Update owner, dog and service details below.</div></div></div>
      <h3 className="panel-title">Owner details</h3>
      <div className="form-grid">
        <label>Owner name *<input required minLength={2} maxLength={100} value={form.owner_name} onChange={e=>change("owner_name",e.target.value)}/></label>
        <label>Mobile number *<input required type="tel" maxLength={20} value={form.phone} onChange={e=>change("phone",e.target.value)}/></label>
        <label>WhatsApp number<input type="tel" maxLength={20} value={form.whatsapp_phone} onChange={e=>change("whatsapp_phone",e.target.value)}/></label>
        <label>Flat / Tower<input maxLength={80} value={form.flat_tower} onChange={e=>change("flat_tower",e.target.value)}/></label>
        <label>Society / Address<input maxLength={150} value={form.society} onChange={e=>change("society",e.target.value)}/></label>
        <label>Area / Locality<input maxLength={100} value={form.locality} onChange={e=>change("locality",e.target.value)}/></label>
        <label>City<input required maxLength={100} value={form.city} onChange={e=>change("city",e.target.value)}/></label>
        <label>State<select required value={form.state} onChange={e=>change("state",e.target.value)}>{STATES.map(s=><option key={s}>{s}</option>)}</select></label>
        <label>PIN Code<input required inputMode="numeric" pattern="[0-9]{6}" minLength={6} maxLength={6} value={form.pincode} onChange={e=>change("pincode",e.target.value.replace(/\\D/g,"").slice(0,6))}/></label>
      </div>
      <h3 className="panel-title">Dog details</h3>
      <div className="form-grid">
        <label>Dog name *<input required maxLength={80} value={form.dog_name} onChange={e=>change("dog_name",e.target.value)}/></label>
        <label>Breed<input maxLength={80} value={form.dog_breed} onChange={e=>change("dog_breed",e.target.value)}/></label>
        <label>Age<input maxLength={40} value={form.dog_age} onChange={e=>change("dog_age",e.target.value)}/></label>
        <label>Dog size<select value={form.dog_size} onChange={e=>change("dog_size",e.target.value)}><option value="">Not set</option><option>Small</option><option>Medium</option><option>Large</option><option>Extra Large</option></select></label>
        <label>Gender<select value={form.dog_gender} onChange={e=>change("dog_gender",e.target.value)}><option value="">Not set</option><option>Male</option><option>Female</option></select></label>
        <label>Temperament<select value={form.dog_temperament} onChange={e=>change("dog_temperament",e.target.value)}><option value="">Not set</option><option>Friendly</option><option>Shy</option><option>Energetic</option><option>Calm</option><option>Anxious</option><option>Reactive</option><option>Other</option></select></label>
      </div>
      <h3 className="panel-title">Service and schedule</h3>
      <div className="form-grid">
        <label>Start date *<input required type="date" value={form.start_date} onChange={e=>change("start_date",e.target.value)}/></label>
        <label>End date (optional)<input type="date" min={form.start_date} value={form.end_date} onChange={e=>change("end_date",e.target.value)}/></label>
        <label>Status<select value={form.status} onChange={e=>change("status",e.target.value)}><option value="active">Active</option><option value="paused">Paused</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></select></label>
        <label>Walk duration<select value={form.walk_duration_minutes} onChange={e=>change("walk_duration_minutes",e.target.value)}><option value="20">20 minutes · ₹45</option><option value="30">30 minutes · ₹65</option><option value="45">45 minutes · ₹95</option><option value="60">60 minutes · ₹125</option></select></label>
        <label>Walks per day<select value={form.walks_per_day} onChange={e=>change("walks_per_day",e.target.value)}><option value="1">1 walk per day</option><option value="2">2 walks per day</option></select></label>
        <label>First walk from<select value={form.start_slot} onChange={e=>change("start_slot",e.target.value)}><option value="morning">Morning</option><option value="evening">Evening</option></select></label>
        {form.walks_per_day === "1" ? <label>{form.start_slot === "morning" ? "Morning" : "Evening"} time<input type="time" value={form.start_slot === "morning" ? form.morning_time : form.evening_time} onChange={e=>change(form.start_slot === "morning" ? "morning_time" : "evening_time",e.target.value)}/></label> : <><label>Morning time<input type="time" value={form.morning_time} onChange={e=>change("morning_time",e.target.value)}/></label><label>Evening time<input type="time" value={form.evening_time} onChange={e=>change("evening_time",e.target.value)}/></label></>}
        <label>Booking source<select value={form.booking_source} onChange={e=>change("booking_source",e.target.value)}><option value="whatsapp">WhatsApp</option><option value="phone">Phone call</option><option value="walk_in">Walk-in</option><option value="other">Other</option></select></label>
        <label className="full-field">Notes<textarea rows={3} maxLength={1000} value={form.notes} onChange={e=>change("notes",e.target.value)}/></label>
      </div>
      <div className="booking-price">Rate is based on duration: <strong>{money(({20:45,30:65,45:95,60:125} as Record<number,number>)[Number(form.walk_duration_minutes)])} per dog, per completed walk.</strong> Changing duration/rate also changes the rate used in the booking's billing calculation, including its existing billable completed walks.</div>
      <div className="form-actions"><button className="action" disabled={saving}>{saving ? "Saving…" : "Save changes"}</button><button type="button" className="plain-button" onClick={()=>{ if (window.confirm("Kya aap bina save kiye changes cancel karna chahte hain?")) { setEditing(false); void load(); } }}>Cancel</button></div>
    </form>}
    <section className="booking-overview panel">
      <div className="booking-overview-head">
        <div><div className="eyebrow">Booking overview</div><h2 className="booking-overview-title">{booking.dog_name}’s walking plan</h2><p className="subtle">Booking details, schedule and billing at a glance.</p></div>
        <span className={`booking-status status-${booking.status}`}>{statusLabel(booking.status)}</span>
      </div>
      <div className="booking-people-grid">
        <div className="booking-person">
          <div className="booking-avatar"><UserRound size={20}/></div>
          <div className="booking-person-copy"><span className="booking-label">OWNER</span><strong>{booking.customer_name}</strong><span className="booking-meta"><Phone size={13}/>{booking.customer_phone || "No mobile number"}</span><Link className="booking-profile-link" href={"/customers/"+booking.customer_id}>View customer profile <span>→</span></Link></div>
        </div>
        <div className="booking-person">
          <div className="booking-avatar dog-avatar"><PawPrint size={20}/></div>
          <div className="booking-person-copy"><span className="booking-label">DOG</span><strong>{booking.dog_name}</strong><span className="booking-meta">{[booking.dog_breed, booking.dog_age, booking.dog_size, booking.dog_gender, booking.dog_temperament].filter(Boolean).join(" · ") || "Dog profile"}</span><Link className="booking-profile-link" href={"/dogs/"+booking.dog_id}>View dog profile <span>→</span></Link></div>
        </div>
      </div>
      <div className="booking-section-heading"><CalendarDays size={17}/> Walk schedule</div>
      <div className="booking-facts-grid">
        <div className="booking-fact"><span>Start date</span><strong>{displayDate(booking.start_date)}</strong></div>
        <div className="booking-fact"><span>End date</span><strong>{booking.end_date ? displayDate(booking.end_date) : "No end date"}</strong></div>
        <div className="booking-fact"><span>Walks per day</span><strong>{booking.walks_per_day} {Number(booking.walks_per_day) === 1 ? "walk" : "walks"}</strong></div>
        <div className="booking-fact"><span>Duration</span><strong>{booking.walk_duration_minutes} minutes</strong></div>
        <div className="booking-fact"><span>Completed walks</span><strong>{booking.completed_walks ?? 0}</strong></div>
        <div className="booking-fact"><span>Usual time</span><strong>{Number(booking.walks_per_day) === 1 ? (booking.start_slot === "evening" ? booking.evening_time : booking.morning_time) || "—" : `AM ${booking.morning_time || "—"} · PM ${booking.evening_time || "—"}`}</strong></div>
      </div>
      {(booking.flat_tower || booking.society || booking.locality || booking.city || booking.state || booking.pincode || booking.address || booking.area) && <div className="booking-address"><MapPin size={14}/><span>{[booking.flat_tower,booking.society,booking.locality,booking.city,booking.state,booking.pincode].filter(Boolean).join(", ") || [booking.address,booking.area].filter(Boolean).join(", ")}</span></div>}
      {booking.notes && <div className="booking-notes"><strong>Notes:</strong> {booking.notes}</div>}
    </section>
    <section className="booking-billing panel">
      <div className="booking-section-heading"><ReceiptText size={17}/> Billing summary</div>
      <div className="booking-money-grid">
        <div className="booking-money-card"><span>Total charges</span><strong>{money(booking.accrued_inr)}</strong></div>
        <div className="booking-money-card received"><span>Received</span><strong>{money(booking.paid_inr)}</strong></div>
        <div className="booking-money-card due"><span>Outstanding due</span><strong>{money(booking.due_inr)}</strong></div>
      </div>
    </section>
    <section className="panel booking-payments">
      <div className="panel-head"><div><h2 className="panel-title">Payment history</h2><p className="panel-note">Payments recorded against this booking.</p></div><span className="payment-count">{payments.length} {payments.length === 1 ? "payment" : "payments"}</span></div>
      {payments.length ? <div className="payment-history-list">{payments.map(x=><div className="payment-history-row" key={x.id}><div><strong>{displayDate(x.payment_date)}</strong><span>{x.payment_method || "Payment"}</span></div><strong className="payment-amount">{money(x.amount_inr)}</strong></div>)}</div> : <div className="booking-empty-payments"><div className="booking-empty-icon"><ReceiptText size={22}/></div><strong>No payments recorded yet</strong><span>Payments received for this booking will appear here.</span></div>}
    </section>
  </main>;
}
