import AppShell from "@/components/app-shell";
import { CalendarDays, MessageCircle, Users, Plus } from "lucide-react";

const stats = [
  { label: "Active bookings", value: "—", note: "Currently running dog-walk services" },
  { label: "Today's walks", value: "—", note: "Daily schedule at a glance" },
  { label: "Pending payments", value: "—", note: "Charges from completed walks" }
];

export default function DashboardPage() {
  return <AppShell active="overview">
    <main className="main">
      <header className="topbar"><div><div className="eyebrow">DOJO WALK · ADMIN</div><h1 className="page-title">Good day, Admin</h1><div className="subtle">Your daily operations, all in one place.</div></div><form action="/api/auth/logout" method="post"><button className="admin-pill" type="submit">● Admin · Sign out</button></form></header>
      <section className="booking-priority"><div><div className="booking-priority-kicker">START HERE</div><div className="booking-priority-title">New customer? Add a booking first.</div><div className="booking-priority-note">Owner, dog and booking details ek hi step mein save karein.</div></div><a className="action booking-priority-button" href="/bookings"><Plus size={17}/> Add Booking</a></section>
      <section className="stats">{stats.map((item) => <div className="stat" key={item.label}><div className="stat-label">{item.label}</div><div className="stat-value">{item.value}</div><div className="stat-note">{item.note}</div></div>)}</section>
      <section className="grid-two">
        <div className="panel"><div className="panel-head"><div><div className="panel-title">Today's walk schedule</div><div className="panel-note">Morning and evening rounds · duration selected per booking</div></div><span className="admin-pill">No walks added</span></div><div className="empty"><strong>Your walk schedule will appear here</strong>Once customers and bookings are added, your daily walks and attendance will be shown here.</div></div>
        <div className="panel"><div className="panel-head"><div><div className="panel-title">Quick actions</div><div className="panel-note">Get common tasks done faster</div></div></div><div className="quick-list">
          <a className="quick-item quick-item-primary" href="/bookings"><div className="quick-icon"><CalendarDays size={17}/></div><div><div className="quick-title">Add a booking</div><div className="quick-desc">Start with owner, dog and walk schedule</div></div></a>
          <a className="quick-item" href="/customers"><div className="quick-icon"><Users size={17}/></div><div><div className="quick-title">Add a customer</div><div className="quick-desc">Save contact and booking source</div></div></a>
          <div className="quick-item"><div className="quick-icon"><MessageCircle size={17}/></div><div><div className="quick-title">WhatsApp updates</div><div className="quick-desc">Prepare customer messages to review</div></div></div>
        </div></div>
      </section>
      <div className="notice"><strong>Business rules:</strong> 20 min ₹45 · 30 min ₹65 · 45 min ₹95 · 60 min ₹125 per dog · missed/cancelled walks are not charged · Sundays off · WhatsApp messages are manually reviewed before sending.</div>
    </main>
  </AppShell>;
}
