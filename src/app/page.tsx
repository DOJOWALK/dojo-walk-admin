"use client";

import { useEffect, useState, type CSSProperties } from "react";
import AppShell from "@/components/app-shell";
import { Activity, CalendarDays, CheckCircle2, Clock3, CreditCard, Dog, Footprints, Plus, Sunrise, Sunset, Users, Wallet, ArrowUpRight } from "lucide-react";

type Row = Record<string, string | number | null>;
type DashboardData = {
  date: string;
  counts: Row;
  walks: Row;
  slots: Row[];
  dues: Row;
  payments: Row;
  expenses: Row;
  recent_bookings: Row[];
  recent_payments: Row[];
};

const money = (value: unknown) => "₹" + Number(value || 0).toLocaleString("en-IN");
const number = (value: unknown) => Number(value || 0);

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
    fetch("/api/walks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ date: today }) })
      .then(async response => {
        if (response.status === 401) { window.location.assign("/login"); throw new Error("Please sign in again."); }
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Today's walk schedule could not be prepared.");
      })
      .then(() => fetch("/api/dashboard"))
      .then(async response => {
        if (response.status === 401) { window.location.assign("/login"); throw new Error("Please sign in again."); }
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Dashboard could not be loaded.");
        return result as DashboardData;
      })
      .then(result => { if (alive) setData(result); })
      .catch(e => { if (alive) setError(e instanceof Error ? e.message : "Dashboard could not be loaded."); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const count = data?.counts ?? {};
  const walks = data?.walks ?? {};
  const totalWalks = number(walks.total);
  const completed = number(walks.completed);
  const progress = totalWalks ? Math.round(completed / totalWalks * 100) : 0;
  const morning = data?.slots.find(row => row.slot === "morning") ?? {};
  const evening = data?.slots.find(row => row.slot === "evening") ?? {};
  const dateLabel = data?.date ? new Date(data.date + "T12:00:00+05:30").toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" }) : "Your daily operations";

  return <AppShell active="overview">
    <main className="main dashboard-main">
      <header className="dashboard-welcome">
        <div><div className="eyebrow">DOJO WALK · ADMIN WORKSPACE</div><h1 className="page-title">Dashboard</h1><div className="subtle">{dateLabel} · Your business at a glance</div></div>
        <a className="action dashboard-add-button" href="/bookings?new=1"><Plus size={17}/> Add Booking</a>
      </header>

      {error && <div className="error-box">{error}</div>}
      {loading && <div className="dashboard-loading">Loading your live business summary…</div>}

      <section className="dashboard-kpis">
        <a className="dashboard-kpi" href="/bookings"><span className="dashboard-kpi-icon orange"><CalendarDays size={19}/></span><span className="dashboard-kpi-label">Active Bookings</span><strong>{loading || !data ? "—" : number(count.active)}</strong><small>{data ? `${number(count.paused)} paused · ${number(count.ending_soon)} ending soon` : "Booking summary unavailable"}</small></a>
        <a className="dashboard-kpi" href="/schedule"><span className="dashboard-kpi-icon green"><Footprints size={19}/></span><span className="dashboard-kpi-label">Today's Walks</span><strong>{loading || !data ? "—" : totalWalks}</strong><small>{data ? `${completed} completed · ${number(walks.scheduled)} scheduled · ${number(walks.missed)} missed` : "Walk summary unavailable"}</small></a>
        <a className="dashboard-kpi" href="/payments"><span className="dashboard-kpi-icon blue"><Wallet size={19}/></span><span className="dashboard-kpi-label">Pending Payments</span><strong>{loading || !data ? "—" : money(data?.dues.total)}</strong><small>{data ? `${number(data.dues.bookings_due)} bookings with balance` : "Payment summary unavailable"}</small></a>
        <a className="dashboard-kpi" href="/customers"><span className="dashboard-kpi-icon violet"><Users size={19}/></span><span className="dashboard-kpi-label">Customers</span><strong>{loading || !data ? "—" : number(count.customers)}</strong><small>{data ? `${number(count.dogs)} dogs in profiles` : "Customer summary unavailable"}</small></a>
      </section>

      <section className="dashboard-main-grid">
        <div className="panel dashboard-walk-panel">
          <div className="dashboard-section-head"><div><div className="panel-title">Today's Walks</div><div className="panel-note">Daily attendance and walk progress</div></div><a className="dashboard-text-link" href="/schedule">Open schedule <ArrowUpRight size={14}/></a></div>
          <div className="walk-progress-layout">
            <div className="walk-progress-number"><strong>{loading || !data ? "—" : completed}<span> / {data ? totalWalks : "—"}</span></strong><small>Completed walks</small></div>
            <div className="walk-progress-ring" style={{ "--progress": progress } as CSSProperties}><div><strong>{loading || !data ? "—" : progress + "%"}</strong><small>Done</small></div></div>
          </div>
          <div className="walk-progress-track"><span style={{ width: progress + "%" }}/></div>
          <div className="walk-slot-grid">
            <div className="walk-slot-card morning"><div className="walk-slot-heading"><span><Sunrise size={17}/> Morning</span><small>{data ? `${number(morning.completed)}/${number(morning.total)} done` : "—"}</small></div><strong>{data ? number(morning.scheduled) : "—"}</strong><small>Scheduled remaining</small></div>
            <div className="walk-slot-card evening"><div className="walk-slot-heading"><span><Sunset size={17}/> Evening</span><small>{data ? `${number(evening.completed)}/${number(evening.total)} done` : "—"}</small></div><strong>{data ? number(evening.scheduled) : "—"}</strong><small>Scheduled remaining</small></div>
          </div>
          {!loading && totalWalks === 0 && <div className="dashboard-empty-note">No walks are scheduled for today yet. Generate today's schedule from Walk Schedule.</div>}
        </div>

        <div className="panel dashboard-bookings-panel">
          <div className="dashboard-section-head"><div><div className="panel-title">Active Bookings</div><div className="panel-note">Your current walking subscriptions</div></div><a className="dashboard-text-link" href="/bookings">View all <ArrowUpRight size={14}/></a></div>
          <div className="active-booking-total"><div><strong>{loading || !data ? "—" : number(count.active)}</strong><small>Active bookings</small></div><span className="active-booking-icon"><Dog size={25}/></span></div>
          <div className="booking-status-list">
            <div><span><i className="status-mark active"/>Active</span><strong>{data ? number(count.active) : "—"}</strong></div>
            <div><span><i className="status-mark paused"/>Paused</span><strong>{data ? number(count.paused) : "—"}</strong></div>
            <div><span><i className="status-mark ending"/>Ending in 7 days</span><strong>{data ? number(count.ending_soon) : "—"}</strong></div>
          </div>
          <a className="dashboard-outline-link" href="/bookings">Manage bookings <ArrowUpRight size={14}/></a>
        </div>
      </section>

      <section className="dashboard-finance-grid">
        <a className="dashboard-finance-card due" href="/payments"><span className="dashboard-finance-icon"><CreditCard size={19}/></span><span className="dashboard-finance-label">Total outstanding</span><strong>{loading || !data ? "—" : money(data.dues.total)}</strong><small>{data ? `${number(data.dues.bookings_due)} bookings need payment follow-up` : "Payment summary unavailable"}</small></a>
        <a className="dashboard-finance-card received" href="/payments"><span className="dashboard-finance-icon"><CheckCircle2 size={19}/></span><span className="dashboard-finance-label">Received today</span><strong>{loading || !data ? "—" : money(data?.payments.total)}</strong><small>{data ? `${number(data.payments.count)} payments recorded today` : "Payment summary unavailable"}</small></a>
        <a className="dashboard-finance-card expense" href="/expenses"><span className="dashboard-finance-icon"><Wallet size={19}/></span><span className="dashboard-finance-label">Expenses today</span><strong>{loading || !data ? "—" : money(data?.expenses.total)}</strong><small>{data ? `${number(data.expenses.count)} expense entries` : "Expense summary unavailable"}</small></a>
      </section>

      <section className="panel dashboard-activity-panel">
        <div className="dashboard-section-head"><div><div className="panel-title">Recent Activity</div><div className="panel-note">Latest bookings and payments</div></div><Activity size={18} color="#F47721"/></div>
        <div className="dashboard-activity-grid">
          <div><div className="activity-group-title"><CalendarDays size={15}/> Recent bookings</div>
            {data?.recent_bookings.length ? data.recent_bookings.slice(0,4).map(row => <a className="activity-row" href={"/bookings/" + row.id} key={"b-" + row.id}><span className="activity-dot booking"><Users size={14}/></span><span><strong>{row.dog_name}</strong><small>{row.customer_name} · {String(row.status || "").replace("_"," ")}</small></span><ArrowUpRight size={14}/></a>) : <div className="dashboard-activity-empty">No bookings recorded yet.</div>}
          </div>
          <div><div className="activity-group-title"><Wallet size={15}/> Recent payments</div>
            {data?.recent_payments.length ? data.recent_payments.slice(0,4).map(row => <a className="activity-row" href="/payments" key={"p-" + row.id}><span className="activity-dot payment"><CheckCircle2 size={14}/></span><span><strong>{money(row.amount_inr)}</strong><small>{row.customer_name} · {row.payment_date}</small></span><ArrowUpRight size={14}/></a>) : <div className="dashboard-activity-empty">No payments recorded yet.</div>}
          </div>
        </div>
      </section>
      <div className="notice dashboard-business-note"><strong>Walk rates:</strong> 20 min ₹45 · 30 min ₹65 · 45 min ₹95 · 60 min ₹125 per dog. Only completed walks are charged; missed or cancelled walks are not billed.</div>
    </main>
  </AppShell>;
}
