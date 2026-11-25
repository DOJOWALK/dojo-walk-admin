import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyAdminSession, getAdminCookieName } from "@/lib/auth";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { Activity, CalendarDays, Camera, ChartNoAxesCombined, CircleDollarSign, ClipboardList, Dog, House, MessageCircle, PawPrint, Settings, Users, Wallet } from "lucide-react";

const navigation = [
  { label: "Overview", href: "/", icon: House, active: true },
  { label: "Customers", href: "/customers", icon: Users },
  { label: "Dogs", href: "/dogs", icon: Dog },
  { label: "Bookings", href: "/bookings", icon: ClipboardList },
  { label: "Walk Schedule", href: "/schedule", icon: CalendarDays },
  { label: "Attendance", href: "/attendance", icon: Activity },
  { label: "Walk Photos", href: "/photos", icon: Camera },
  { label: "Payments", href: "/payments", icon: CircleDollarSign },
  { label: "Expenses", href: "/expenses", icon: Wallet },
  { label: "Reports", href: "/reports", icon: ChartNoAxesCombined },
  { label: "WhatsApp", href: "/whatsapp", icon: MessageCircle },
  { label: "Settings", href: "/settings", icon: Settings }
];

const stats = [
  { label: "Active customers", value: "—", note: "Add your first customer" },
  { label: "Dogs registered", value: "—", note: "Customer dogs will appear here" },
  { label: "Today's walks", value: "—", note: "Daily schedule at a glance" },
  { label: "Pending payments", value: "—", note: "Track monthly balances" }
];

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const env = getCloudflareContext().env as { SESSION_SECRET?: string };
  const isAdmin = await verifyAdminSession(cookieStore.get(getAdminCookieName())?.value, env.SESSION_SECRET);
  if (!isAdmin) redirect("/login");
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark">DW</div><div><div className="brand-name">Dojo Walk</div><div className="brand-sub">ADMIN WORKSPACE</div></div></div>
        <div><p className="nav-label">WORKSPACE</p><nav className="nav-list">{navigation.map(({label, href, icon: Icon, active}) => <a key={label} href={href} className={`nav-link ${active ? "active" : ""}`}><Icon size={16}/>{label}</a>)}</nav></div>
        <div className="sidebar-foot">Gaur City · Crossings Republik<br/>Ghaziabad, Uttar Pradesh<br/><strong>Single-admin system</strong></div>
      </aside>
      <main className="main">
        <header className="topbar"><div><div className="eyebrow">Dojo Walk</div><h1 className="page-title">Good day, Admin</h1><div className="subtle">Here’s your business overview. Your workspace is ready to be set up.</div></div><form action="/api/auth/logout" method="post"><button className="admin-pill" type="submit">● Admin · Sign out</button></form></header>
        <section className="stats">{stats.map((item) => <div className="stat" key={item.label}><div className="stat-label">{item.label}</div><div className="stat-value">{item.value}</div><div className="stat-note">{item.note}</div></div>)}</section>
        <section className="grid-two">
          <div className="panel"><div className="panel-head"><div><div className="panel-title">Today’s walk schedule</div><div className="panel-note">Morning and evening rounds · 30 minutes each</div></div><span className="admin-pill">No walks added</span></div><div className="empty"><strong>Your walk schedule will appear here</strong>Once customers and bookings are added, you can mark attendance and upload 2–3 walk photos for each visit.</div></div>
          <div className="panel"><div className="panel-head"><div><div className="panel-title">Quick actions</div><div className="panel-note">Common admin tasks</div></div></div><div className="quick-list">
            <a className="quick-item" href="/customers"><div className="quick-icon"><Users size={17}/></div><div><div className="quick-title">Add a customer</div><div className="quick-desc">Save contact and booking source</div></div></a>
            <a className="quick-item" href="/dogs"><div className="quick-icon"><PawPrint size={17}/></div><div><div className="quick-title">Register a dog</div><div className="quick-desc">Keep each dog under its customer</div></div></a>
            <a className="quick-item" href="/bookings"><div className="quick-icon"><CalendarDays size={17}/></div><div><div className="quick-title">Create a booking</div><div className="quick-desc">Choose plan, timing and advance</div></div></a>
            <div className="quick-item"><div className="quick-icon"><MessageCircle size={17}/></div><div><div className="quick-title">Send WhatsApp update</div><div className="quick-desc">Review message before sending</div></div></div>
          </div></div>
        </section>
        <div className="notice"><strong>Business rules configured for the build:</strong> Sunday weekly off · monthly plans use 26 working days · cancellation fee ₹299 · customer updates are manual WhatsApp messages. No customer information has been added.</div>
      </main>
    </div>
  );
}