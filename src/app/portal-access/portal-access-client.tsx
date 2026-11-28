"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { KeyRound, Plus, RefreshCw, ShieldCheck } from "lucide-react";

type Account = { id: string; name: string; phone: string; role: "walker" | "customer"; is_active: number; created_at: string };
type Person = { id: string; full_name: string; phone?: string; mobile_number?: string; status: string };

export default function PortalAccessClient() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [customers, setCustomers] = useState<Person[]>([]);
  const [walkers, setWalkers] = useState<Person[]>([]);
  const [role, setRole] = useState<"walker" | "customer">("walker");
  const [entityId, setEntityId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const load = useCallback(async () => {
    try {
      const [a,c,w] = await Promise.all([
        fetch("/api/admin/portal-users",{cache:"no-store"}),
        fetch("/api/customers",{cache:"no-store"}),
        fetch("/api/walkers",{cache:"no-store"})
      ]);
      const [ad,cd,wd] = await Promise.all([a.json(),c.json(),w.json()]);
      if (!a.ok || !c.ok || !w.ok) throw new Error(ad.error || cd.error || wd.error || "Records load nahi hue.");
      setAccounts(ad.accounts || []);
      setCustomers(cd.customers || []);
      setWalkers(wd.walkers || []);
      setError("");
    } catch(reason) {
      setError(reason instanceof Error ? reason.message : "Portal access data load nahi hua.");
    }
  }, []);

  useEffect(() => { void load(); }, [load]);
  const people = (role === "walker" ? walkers : customers).filter((person) => person.status === "active");
  const selectedEntity = people.some((person) => person.id === entityId) ? entityId : people[0]?.id || "";

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError(""); setSuccess("");
    try {
      const response = await fetch("/api/admin/portal-users", {
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({role,entity_id:selectedEntity})
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Account create nahi hua.");
      setSuccess("Portal account create ho gaya. User ab registered mobile par OTP se login kar sakta hai.");
      await load();
    } catch(reason) {
      setError(reason instanceof Error ? reason.message : "Account create nahi hua.");
    } finally { setBusy(false); }
  }

  async function accountAction(account: Account, action: "enable" | "disable") {
    setBusy(true);setError("");setSuccess("");
    try {
      const response = await fetch("/api/admin/portal-users", {
        method:"PATCH",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({id:account.id,action})
      });
      const data=await response.json();
      if(!response.ok)throw new Error(data.error || "Account update nahi hua.");
      setSuccess("Account status update ho gaya.");
      await load();
    } catch(reason) {
      setError(reason instanceof Error ? reason.message : "Account update nahi hua.");
    } finally {setBusy(false);}
  }

  return <main className="main">
    <div className="topbar"><div><div className="eyebrow">SECURITY & ACCESS</div><h1 className="page-title">Portal Access</h1><p className="subtle">Walker aur Customer ke secure login accounts manage karein.</p></div><button className="action" onClick={() => void load()}><RefreshCw size={14}/> Refresh</button></div>
    {error && <div className="error-box">{error}</div>}{success && <div className="success-box">{success}</div>}
    <section className="panel portal-access-form">
      <div className="panel-head"><div><div className="panel-title">Create portal account</div><div className="panel-note">Existing active customer ya walker record ko OTP login access dein.</div></div><KeyRound size={18} color="#d95d0b"/></div>
      <form onSubmit={create}>
        <div className="form-grid">
          <label>Account type<select value={role} onChange={(event)=>setRole(event.target.value as "walker"|"customer")}><option value="walker">Walker</option><option value="customer">Customer</option></select></label>
          <label>Registered person<select value={selectedEntity} onChange={(event)=>setEntityId(event.target.value)} required><option value="">Select person</option>{people.map((person)=><option key={person.id} value={person.id}>{person.full_name} · {person.phone || person.mobile_number}</option>)}</select></label>
        </div>
        <div className="form-actions"><button className="action" type="submit" disabled={busy || !selectedEntity}><Plus size={14}/> {busy?"Saving…":"Create account"}</button></div>
      </form>
    </section>
    <section className="panel portal-account-list">
      <div className="panel-head"><div><div className="panel-title">Portal accounts</div><div className="panel-note">{accounts.length} accounts</div></div><ShieldCheck size={18} color="#d95d0b"/></div>
      {accounts.length ? <div className="table-wrap"><table className="data-table"><thead><tr><th>Name</th><th>Type</th><th>Phone</th><th>Status</th><th>Actions</th></tr></thead><tbody>{accounts.map((account)=><tr key={account.id}><td><strong>{account.name}</strong></td><td>{account.role}</td><td>{account.phone}</td><td><span className={"status-dot " + (account.is_active ? "" : "payment-unpaid")}>{account.is_active ? "Active" : "Disabled"}</span></td><td><div className="portal-account-actions"><button type="button" onClick={()=>void accountAction(account,account.is_active?"disable":"enable")} disabled={busy}>{account.is_active?"Disable":"Enable"}</button></div></td></tr>)}</tbody></table></div> : <div className="empty"><strong>No portal accounts yet</strong>Yahan banaye gaye Walker aur Customer login accounts dikhenge.</div>}
    </section>
    <p className="subtle portal-access-note">Security: Walker aur Customer mobile OTP se login karte hain. Account disable karne par existing sessions revoke ho jaate hain.</p>
  </main>;
}
