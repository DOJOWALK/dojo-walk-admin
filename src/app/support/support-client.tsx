"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Check, MessageSquare, RefreshCw, Send } from "lucide-react";

type Conversation = {
  id: string;
  status: "open" | "closed";
  customer_name: string | null;
  customer_phone: string | null;
  walker_name: string | null;
  walker_phone: string | null;
  last_message: string | null;
  last_message_at: string | null;
  unread_count: number;
};
type ChatMessage = {
  id: string;
  sender_role: "admin" | "walker" | "customer";
  sender_id: string;
  message_text: string | null;
  created_at: string;
};

export default function SupportClient() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selected, setSelected] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [filter, setFilter] = useState("open");
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const loadConversations = useCallback(async () => {
    try {
      const response = await fetch(`/api/admin/support-inbox?status=${filter}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Inbox could not be loaded.");
      const rows = data.conversations as Conversation[];
      setConversations(rows);
      if (selected && !rows.some((item) => item.id === selected)) setSelected("");
      if (!selected && rows.length) setSelected(rows[0].id);
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Inbox could not be loaded.");
    }
  }, [filter, selected]);

  const loadMessages = useCallback(async () => {
    if (!selected) { setMessages([]); return; }
    try {
      const response = await fetch(`/api/admin/support-inbox/${selected}/messages`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Messages could not be loaded.");
      setMessages(data.messages || []);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Messages could not be loaded.");
    }
  }, [selected]);

  useEffect(() => { void loadConversations(); }, [loadConversations]);
  useEffect(() => { void loadMessages(); }, [loadMessages]);

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || !draft.trim() || busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/admin/support-inbox", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversation_id: selected, message_text: draft.trim() })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Reply could not be sent.");
      setDraft("");
      await Promise.all([loadMessages(), loadConversations()]);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Reply could not be sent.");
    } finally {
      setBusy(false);
    }
  }

  async function closeConversation() {
    if (!selected || busy) return;
    setBusy(true);
    try {
      const response = await fetch("/api/admin/support-inbox", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversation_id: selected, status: "closed" })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Conversation could not be closed.");
      setSelected("");
      await loadConversations();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Conversation could not be closed.");
    } finally {
      setBusy(false);
    }
  }

  const current = conversations.find((item) => item.id === selected);
  const personName = current?.customer_name || current?.walker_name || "Portal user";
  const personType = current?.customer_name ? "Customer" : "Walker";

  return <main className="main">
    <div className="topbar">
      <div><div className="eyebrow">CUSTOMER & WALKER CARE</div><h1 className="page-title">Support Chat</h1><p className="subtle">Customer aur Walker ke support messages yahan manage karein.</p></div>
      <button className="action" type="button" onClick={() => { void loadConversations(); void loadMessages(); }}><RefreshCw size={14}/> Refresh</button>
    </div>
    {error && <div className="error-box" role="alert">{error}</div>}
    <section className="support-layout">
      <div className="panel support-list-panel">
        <div className="panel-head"><div><div className="panel-title">Conversations</div><div className="panel-note">{conversations.length} conversations</div></div>
          <select className="support-filter" value={filter} onChange={(event) => setFilter(event.target.value)}><option value="open">Open</option><option value="closed">Closed</option><option value="all">All</option></select>
        </div>
        {conversations.length ? <div className="support-conversation-list">{conversations.map((item) => {
          const title = item.customer_name || item.walker_name || "Portal user";
          const sub = item.customer_name ? "Customer" : "Walker";
          return <button key={item.id} type="button" className={`support-conversation ${selected === item.id ? "selected" : ""}`} onClick={() => setSelected(item.id)}>
            <span className="support-avatar"><MessageSquare size={16}/></span>
            <span className="support-conversation-copy"><strong>{title}</strong><small>{sub} · {item.last_message || "New conversation"}</small></span>
            {Number(item.unread_count) > 0 && <span className="support-unread">{item.unread_count}</span>}
          </button>;
        })}</div> : <div className="empty"><strong>No conversations</strong>Is filter mein abhi koi support message nahi hai.</div>}
      </div>
      <div className="panel support-chat-panel">
        {current ? <>
          <div className="support-chat-head"><div><div className="panel-title">{personName}</div><div className="panel-note">{personType} · {current.customer_phone || current.walker_phone || "Phone not available"}</div></div>
            {current.status === "open" && <button className="plain-button support-close" type="button" onClick={() => void closeConversation()} disabled={busy}><Check size={14}/> Close chat</button>}
          </div>
          <div className="support-message-list">
            {messages.map((message) => <div key={message.id} className={`support-message-row ${message.sender_role === "admin" ? "mine" : ""}`}>
              <div className="support-message"><small>{message.sender_role === "admin" ? "Admin" : message.sender_role === "customer" ? "Customer" : "Walker"}</small><p>{message.message_text}</p><time>{new Date(message.created_at.replace(" ", "T") + (message.created_at.endsWith("Z") ? "" : "Z")).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" })}</time></div>
            </div>)}
            {!messages.length && <div className="empty">Abhi koi message nahi hai.</div>}
          </div>
          {current.status === "open" && <form className="support-reply-form" onSubmit={send}><textarea value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={4000} rows={2} placeholder="Apna reply likhein…" required/><button className="action" type="submit" disabled={busy || !draft.trim()}><Send size={14}/> Send</button></form>}
          {current.status === "closed" && <div className="support-closed-note">Yeh conversation close hai.</div>}
        </> : <div className="support-empty-state"><MessageSquare size={28}/><strong>Conversation select karein</strong><span>Customer ya Walker ke message ka reply yahan dikhega.</span></div>}
      </div>
    </section>
  </main>;
}
