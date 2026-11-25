"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, UserRound, Phone, MapPin, PawPrint, CalendarDays, ReceiptText, Wallet } from "lucide-react";

type R = Record<string, any>;

export default function CustomerDetail() {
  const { id } = useParams<{ id: string }>();
  const [customer, setCustomer] = useState<R | null>(null);
  const [dogs, setDogs] = useState<R[]>([]);
  const [bookings, setBookings] = useState<R[]>([]);
  const [payments, setPayments] = useState<R[]>([]);
  const [loading, setLoading] = useState(true);
  const money = (v: any) => "₹" + Number(v || 0).toLocaleString("en-IN");
  const date = (v: string) => v ? new Date(v + "T00:00:00").toLocaleDateString("en-IN", {day:"2-digit",month:"short",year:"numeric"}) : "—";

  useEffect(() => {
    (async () => {
      try {
        const responses = await Promise.all(["/api/customers","/api/dogs","/api/bookings","/api/payments"].map(url => fetch(url)));
        if (responses.some(r => r.status === 401)) { location.assign("/login"); return; }
        const data = await Promise.all(responses.map(r => r.json()));
        setCustomer((data[0].customers || []).find((x: R) => x.id === id) || null);
        setDogs((data[1].dogs || []).filter((x: R) => x.customer_id === id));
        setBookings((data[2].bookings || []).filter((x: R) => x.customer_id === id));
        setPayments((data[3].payments || []).filter((x: R) => x.customer_id === id));
      } finally { setLoading(false); }
    })();
  }, [id]);

  const totalDue = bookings.reduce((sum, b) => sum + Number(b.due_inr || 0), 0);
  const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount_inr || 0), 0);

  if (loading) return <main className="main"><Link href="/customers" className="back-link"><ArrowLeft size={15}/> Customers</Link><section className="panel">Loading customer profile…</section></main>;
  if (!customer) return <main className="main"><Link href="/customers" className="back-link"><ArrowLeft size={15}/> Customers</Link><section className="panel"><h1 className="panel-title">Customer not found</h1><p className="panel-note">This customer may have been removed or the link may be incorrect.</p></section></main>;

  const address = [customer.flat_tower, customer.society, customer.locality, customer.city, customer.state, customer.pincode].filter(Boolean).join(", ") || [customer.address, customer.area].filter(Boolean).join(", ") || "Address not added";

  return <main className="main">
    <Link href="/customers" className="back-link"><ArrowLeft size={15}/> Back to customers</Link>
    <div className="topbar"><div><div className="eyebrow">Customer profile</div><h1 className="page-title">{customer.full_name}</h1><p className="subtle">Owner details, dogs, walking bookings and payment history in one place.</p></div><Link className="action" href="/bookings">＋ New booking</Link></div>

    <section className="booking-overview panel">
      <div className="booking-overview-head"><div><div className="eyebrow">Owner information</div><h2 className="booking-overview-title">{customer.full_name}</h2><p className="subtle">{customer.phone || "Mobile number not added"}</p></div><span className="booking-status status-active">{customer.status || "Customer"}</span></div>
      <div className="booking-people-grid">
        <div className="booking-person"><div className="booking-avatar"><UserRound size={20}/></div><div className="booking-person-copy"><span className="booking-label">CONTACT</span><strong>{customer.phone || "—"}</strong><span className="booking-meta"><Phone size={13}/>{customer.whatsapp_phone || "WhatsApp same as mobile / not added"}</span></div></div>
        <div className="booking-person"><div className="booking-avatar"><MapPin size={20}/></div><div className="booking-person-copy"><span className="booking-label">ADDRESS</span><strong>{address}</strong><span className="booking-meta">Saved as separate address fields</span></div></div>
      </div>
      {customer.notes && <div className="booking-notes"><strong>Notes:</strong> {customer.notes}</div>}
    </section>

    <div className="booking-money-grid">
      <div className="booking-money-card"><span>Dogs</span><strong>{dogs.length}</strong></div>
      <div className="booking-money-card"><span>Bookings</span><strong>{bookings.length}</strong></div>
      <div className="booking-money-card received"><span>Total received</span><strong>{money(totalPaid)}</strong></div>
      <div className="booking-money-card due"><span>Outstanding due</span><strong>{money(totalDue)}</strong></div>
    </div>

    <section className="panel">
      <div className="panel-head"><div><div className="booking-section-heading"><PawPrint size={17}/> Dogs</div><p className="panel-note">Is customer ke dogs yahin manage honge. Dog List ab alag navigation mein nahi hai.</p></div></div>
      {dogs.length ? <div className="booking-people-grid">{dogs.map(d => <Link className="booking-person" key={d.id} href={"/dogs/" + d.id}><div className="booking-avatar dog-avatar"><PawPrint size={20}/></div><div className="booking-person-copy"><strong>{d.name}</strong><span className="booking-meta">{[d.breed,d.age_text,d.size,d.gender].filter(Boolean).join(" · ") || "Dog details"}</span><span className="booking-profile-link">View dog details →</span></div></Link>)}</div> : <div className="booking-empty-payments"><PawPrint size={22}/><strong>No dogs added yet</strong><span>Dog details will appear here when a booking is created.</span></div>}
    </section>

    <section className="panel">
      <div className="panel-head"><div><div className="booking-section-heading"><CalendarDays size={17}/> Booking history</div><p className="panel-note">Customer ke saare walking plans aur balances.</p></div></div>
      {bookings.length ? <div className="payment-history-list">{bookings.map(b => <Link className="payment-history-row" key={b.id} href={"/bookings/" + b.id}><div><strong>{b.dog_name} · {date(b.start_date)}</strong><span>{b.status} · {b.walk_duration_minutes} min · {b.walks_per_day} walk(s)/day</span></div><strong className="payment-amount">Due {money(b.due_inr)}</strong></Link>)}</div> : <div className="booking-empty-payments"><CalendarDays size={22}/><strong>No bookings yet</strong><span>New walking plans for this customer will appear here.</span></div>}
    </section>

    <section className="panel booking-payments">
      <div className="panel-head"><div><div className="booking-section-heading"><ReceiptText size={17}/> Payment history</div><p className="panel-note">Payments recorded against this customer.</p></div><span className="payment-count">{payments.length} payments</span></div>
      {payments.length ? <div className="payment-history-list">{payments.map(p => <div className="payment-history-row" key={p.id}><div><strong>{date(p.payment_date)}</strong><span>{p.payment_method || "Payment"}</span></div><strong className="payment-amount">{money(p.amount_inr)}</strong></div>)}</div> : <div className="booking-empty-payments"><Wallet size={22}/><strong>No payments recorded yet</strong><span>Payments received from this customer will appear here.</span></div>}
    </section>
  </main>;
}
