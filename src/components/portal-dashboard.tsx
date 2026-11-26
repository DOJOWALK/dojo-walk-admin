"use client";

import { useCallback, useEffect, useState } from "react";
import { LogOut, MessageCircle, PawPrint, ShieldCheck } from "lucide-react";

type Walk = {
  id: string; walk_date: string; slot: string; scheduled_time: string | null;
  duration_minutes: number; status: string; dog_name: string; breed: string | null;
  age_text?: string | null; size?: string | null; temperament?: string | null; medical_notes?: string | null; emergency_notes?: string | null;
  customer_name?: string; customer_phone?: string; customer_address?: string; customer_area?: string; walker_name?: string;
};

export default function PortalDashboard({ role }: { role: "walker" | "customer" }) {
  const [name, setName] = useState("");
  const [today, setToday] = useState("");
  const [walks, setWalks] = useState<Walk[]>([]);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");
  const [loading, setLoading] = useState(true);
  const base = role === "walker" ? "/walker" : "/customer";

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/portal-dashboard", { cache: "no-store" });
      const data = await response.json();
      if (response.status === 401) { window.location.assign(base + "/login"); return; }
      if (!response.ok) throw new Error(data.error || "Dashboard load nahi hua.");
      setName(data.user.name);
      setToday(data.today || "");
      setWalks(data.walks || []);
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Dashboard load nahi hua.");
    } finally {
      setLoading(false);
    }
  }, [base]);

  useEffect(() => { void load(); }, [load]);

  async function openConversation(kind: "support" | "walk", walkId?: string) {
    setBusyId(walkId || "support");
    setError("");
    try {
      const response = await fetch("/api/portal-chat/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(kind === "support" ? { conversation_type: "support" } : { conversation_type: "walk", walk_id: walkId })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Chat open nahi ho paya.");
      window.location.assign(base + "/chat/" + data.conversation_id);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Chat open nahi ho paya.");
    } finally {
      setBusyId("");
    }
  }

  async function updateWalk(walkId: string, action: "start" | "complete") {
    setBusyId(walkId);
    setError("");
    try {
      const response = await fetch("/api/portal-walks/" + walkId + "/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Walk update nahi hua.");
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Walk update nahi hua.");
    } finally {
      setBusyId("");
    }
  }

  async function logout() {
    await fetch("/api/portal-auth/logout", { method: "POST" });
    window.location.assign(base + "/login");
  }

  return <main className="portal-page">
    <header className="portal-header"><a className="portal-brand" href={base + "/dashboard"}><span><PawPrint size={19}/></span><strong>Dojo Walk</strong></a><button className="portal-logout" onClick={() => void logout()}><LogOut size={15}/> Logout</button></header>
    <section className="portal-welcome"><div><div className="eyebrow">{role === "walker" ? "WALKER PORTAL" : "CUSTOMER PORTAL"}</div><h1>Namaste, {name || "Welcome"}</h1><p>{role === "walker" ? "Aapko assign ki gayi walks yahan dikhenge." : "Aapke dogs aur scheduled walks ka update yahan milega."}</p></div><button className="portal-support-button" disabled={busyId === "support"} onClick={() => void openConversation("support")}><MessageCircle size={16}/> {busyId === "support" ? "Opening…" : "Support Chat"}</button></section>
    {error && <div className="error-box">{error}</div>}
    <section className="portal-section"><div className="portal-section-heading"><div><h2>{role === "walker" ? "Assigned Walks" : "Your Walks"}</h2><p>{walks.length} records</p></div><button className="portal-refresh" onClick={() => void load()}>Refresh</button></div>
      {loading ? <div className="portal-empty">Loading…</div> : walks.length ? <div className="portal-walk-grid">{walks.map((walk) => <article className="portal-walk-card" key={walk.id}>
        <div className="portal-walk-top"><span className="portal-date">{new Date(walk.walk_date + "T00:00:00").toLocaleDateString("en-IN",{day:"numeric",month:"short",year:"numeric"})}</span><span className={"portal-status status-" + walk.status}>{walk.status.replace("_"," ")}</span></div>
        <h3>{walk.dog_name}</h3><p className="portal-muted">{walk.breed || "Dog"} · {walk.slot} · {walk.scheduled_time || "Time pending"} · {walk.duration_minutes} min</p>
        {role === "walker" ? <div className="portal-person"><strong>{walk.customer_name}</strong><span>{walk.customer_phone}</span><span>{[walk.customer_address,walk.customer_area].filter(Boolean).join(", ")}</span></div> : <div className="portal-person"><strong>{walk.walker_name || "Walker not assigned"}</strong></div>}{(walk.age_text || walk.size || walk.temperament) && <div className="portal-person"><strong>Dog care details</strong><span>{[walk.age_text,walk.size,walk.temperament].filter(Boolean).join(" · ")}</span></div>}{(walk.medical_notes || walk.emergency_notes) && <div className="portal-safety-note"><strong>Care & Emergency Notes</strong>{walk.medical_notes && <span>Medical: {walk.medical_notes}</span>}{walk.emergency_notes && <span>Emergency: {walk.emergency_notes}</span>}</div>}
        <div className="portal-walk-actions">{role === "walker" && walk.status === "scheduled" && walk.walk_date === today && <button className="portal-live-button" disabled={busyId === walk.id} onClick={() => void updateWalk(walk.id, "start")}>Start Walk</button>}{role === "walker" && walk.status === "in_progress" && <button className="portal-live-button complete" disabled={busyId === walk.id} onClick={() => void updateWalk(walk.id, "complete")}>Complete Walk</button>}<button className="portal-chat-button" disabled={busyId === walk.id} onClick={() => void openConversation("walk", walk.id)}><MessageCircle size={15}/>{busyId === walk.id ? "Please wait…" : "Open Walk Chat"}</button></div>
      </article>)}</div> : <div className="portal-empty"><ShieldCheck size={22}/><strong>Abhi koi walk listed nahi hai</strong><span>New assignments ya bookings yahan update hongi.</span></div>}
    </section>
    <footer className="portal-footer">Dojo Walk · Secure {role} access · Photos only when enabled · No video</footer>
  </main>;
}
