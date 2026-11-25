import AppShell from "@/components/app-shell";
import { CalendarDays, MessageCircle, PawPrint, Users } from "lucide-react";

const stats = [
  { label: "Active customers", value: "—", note: "Add your first customer" },
  { label: "Dogs registered", value: "—", note: "Customer dogs will appear here" },
  { label: "Today's walks", value: "—", note: "Daily schedule at a glance" },
  { label: "Pending payments", value: "—", note: "Charges from completed walks" }
];

export default function DashboardPage() {
  return <AppShell active="overview">
    <main className="main">
      <header className="topbar"><div><div className="eyebrow">DOJO WALK · ADMIN</div><h1 className="page-title">Good day, Admin</h1><div className="subtle">Your daily operations, all in one place.</div></div><form action="/api/auth/logout" method="post"><button className="admin-pill" type="submit">● Admin · Sign out</button></form></header>
      <section className="stats">{stats.map((item) => <div className="stat" key={item.label}><div className="stat-label">{item.label}</div><div className="stat-value">{item.value}</div><div className="stat-note">{item.note}</div></div>)}</section>
      <section className="grid-two">
        <div className="panel"><div className="panel-head"><div><div className="panel-title">Today's walk schedule</div><div className="panel-note">Morning and evening rounds · 30 minutes each</div></div><span className="admin-pill">No walks added</span></div><div className="empty"><strong>Your walk schedule will appear here</strong>Once customers and bookings are added, your daily walks and attendance will be shown here.</div></div>
        <div className="panel"><div className="panel-head"><div><div className="panel-title">Quick actions</div><div className="panel-note">Get common tasks done faster</div></div></div><div className="quick-list">
          <a className="quick-item" href="/customers"><div className="quick-icon"><Users size={17}/></div><div><div className="quick-title">Add a customer</div><div className="quick-desc">Save contact and booking source</div></div></a>
          <a className="quick-item" href="/dogs"><div className="quick-icon"><PawPrint size={17}/></div><div><div className="quick-title">Register a dog</div><div className="quick-desc">Keep each dog under its customer</div></div></a>
          <a className="quick-item" href="/bookings"><div className="quick-icon"><CalendarDays size={17}/></div><div><div className="quick-title">Create a booking</div><div className="quick-desc">Set dog, timing and walk frequency</div></div></a>
          <div className="quick-item"><div className="quick-icon"><MessageCircle size={17}/></div><div><div className="quick-title">WhatsApp updates</div><div className="quick-desc">Prepare customer messages to review</div></div></div>
        </div></div>
      </section>
      <div className="notice"><strong>Business rules:</strong> ₹65 per dog per completed 30-minute walk · missed/cancelled walks are not charged · Sundays off · WhatsApp messages are manually reviewed before sending.</div>
    </main>
  </AppShell>;
}
