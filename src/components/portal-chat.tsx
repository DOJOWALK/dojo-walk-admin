"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { ArrowLeft, ImagePlus, LogOut, PawPrint, Send } from "lucide-react";

type Message = { id: string; sender_role: string; sender_id: string; message_text: string | null; created_at: string };

export default function PortalChat({ role, conversationId }: { role: "walker" | "customer"; conversationId: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [myId, setMyId] = useState("");
  const base = role === "walker" ? "/walker" : "/customer";

  const load = useCallback(async () => {
    try {
      const [meResponse, chatResponse] = await Promise.all([
        fetch("/api/portal-auth/me", { cache: "no-store" }),
        fetch("/api/portal-chat/conversations/" + conversationId + "/messages", { cache: "no-store" })
      ]);
      if (meResponse.status === 401 || chatResponse.status === 401) { window.location.assign(base + "/login"); return; }
      const me = await meResponse.json();
      const chat = await chatResponse.json();
      if (!chatResponse.ok) throw new Error(chat.error || "Chat load nahi hua.");
      setMyId(me.user.id);
      setMessages(chat.messages || []);
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Chat load nahi hua.");
    }
  }, [base, conversationId]);

  useEffect(() => { void load(); const timer = window.setInterval(() => void load(), 5000); return () => window.clearInterval(timer); }, [load]);

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft.trim() || busy) return;
    setBusy(true);
    try {
      const response = await fetch("/api/portal-chat/conversations/" + conversationId + "/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message_text: draft.trim() })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Message send nahi hua.");
      setDraft("");
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Message send nahi hua.");
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    await fetch("/api/portal-auth/logout", { method: "POST" });
    window.location.assign(base + "/login");
  }

  return <main className="portal-page portal-chat-page">
    <header className="portal-header"><a className="portal-brand" href={base + "/dashboard"}><span><PawPrint size={19}/></span><strong>Dojo Walk</strong></a><button className="portal-logout" onClick={() => void logout()}><LogOut size={15}/> Logout</button></header>
    <section className="portal-chat-shell">
      <div className="portal-chat-title"><a href={base + "/dashboard"}><ArrowLeft size={16}/> Back</a><div><h1>Chat</h1><p>Messages update automatically. Photo upload will be enabled after private storage setup. Video is not supported.</p></div></div>
      {error && <div className="error-box">{error}</div>}
      <div className="portal-chat-messages">{messages.map((message) => <div key={message.id} className={"portal-chat-line " + (message.sender_id === myId ? "own" : "")}><div className="portal-chat-bubble"><small>{message.sender_id === myId ? "You" : message.sender_role === "admin" ? "Dojo Walk Support" : message.sender_role === "walker" ? "Walker" : "Customer"}</small><p>{message.message_text}</p><time>{new Date(message.created_at.replace(" ","T") + (message.created_at.endsWith("Z") ? "" : "Z")).toLocaleTimeString("en-IN",{timeZone:"Asia/Kolkata",hour:"2-digit",minute:"2-digit"})}</time></div></div>)}</div>
      <form className="portal-chat-compose" onSubmit={send}><textarea value={draft} onChange={(event) => setDraft(event.target.value)} rows={2} maxLength={4000} placeholder="Message likhein…" required/><button className="portal-send" type="submit" disabled={busy || !draft.trim()}><Send size={16}/> Send</button></form>
    </section>
  </main>;
}
