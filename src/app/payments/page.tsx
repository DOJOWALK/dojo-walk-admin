"use client";

import { FormEvent, useEffect, useState } from "react";
import { ArrowLeft, CircleDollarSign, Plus } from "lucide-react";
import Link from "next/link";

type Booking={id:string;customer_name:string;dog_name:string;due_inr:number;status:string;start_date:string;completed_walks:number};
type Payment={id:string;customer_name:string;dog_name:string|null;amount_inr:number;payment_date:string;payment_method:string;reference_note:string|null};
function localDate(){const d=new Date();const offset=d.getTimezoneOffset();return new Date(d.getTime()-offset*60000).toISOString().slice(0,10);}

export default function PaymentsPage(){
 const [bookings,setBookings]=useState<Booking[]>([]);
 const [payments,setPayments]=useState<Payment[]>([]);
 const [form,setForm]=useState({booking_id:"",amount_inr:"",payment_date:localDate(),payment_method:"upi",reference_note:""});
 const [show,setShow]=useState(false),[loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[error,setError]=useState(""),[success,setSuccess]=useState("");
 async function load(){
  setLoading(true);setError("");
  try{
   const [br,pr]=await Promise.all([fetch("/api/bookings"),fetch("/api/payments")]);
   if(br.status===401||pr.status===401){window.location.assign("/login");return;}
   const [bj,pj]=await Promise.all([br.json(),pr.json()]);
   if(!br.ok||!pr.ok)throw new Error(bj.error||pj.error||"Payment data could not be loaded.");
   setBookings(bj.bookings||[]);setPayments(pj.payments||[]);
  }catch(e){setError(e instanceof Error?e.message:"Could not load payments.");}
  finally{setLoading(false);}
 }
 useEffect(()=>{void load();},[]);
 const pendingBookings=bookings.filter(b=>b.status!=="cancelled"&&b.due_inr>0);
 const selected=pendingBookings.find(b=>b.id===form.booking_id);
 const balance=selected?.due_inr||0;
 async function submit(e:FormEvent<HTMLFormElement>){
  e.preventDefault();setSaving(true);setError("");setSuccess("");
  try{
   const r=await fetch("/api/payments",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...form,amount_inr:Number(form.amount_inr)})});
   const j=await r.json();if(!r.ok)throw new Error(j.error||"Payment could not be saved.");
   setSuccess("Payment saved. Remaining balance: ₹"+Number(j.balance_inr).toLocaleString("en-IN"));
   setForm({...form,booking_id:"",amount_inr:"",reference_note:""});await load();
  }catch(e){setError(e instanceof Error?e.message:"Payment could not be saved.");}
  finally{setSaving(false);}
 }
 return <main className="main">
  <div className="topbar"><div><Link href="/" className="back-link"><ArrowLeft size={15}/> Dashboard</Link><div className="eyebrow">Payments & balances</div><h1 className="page-title">Payments</h1><p className="subtle">Collect payment only for walks already marked completed.</p></div><button className="action" onClick={()=>setShow(!show)}><Plus size={15}/> Record payment</button></div>
  {error&&<div className="error-box">{error}</div>}{success&&<div className="success-box">{success}</div>}
  {show&&<form className="panel customer-form" onSubmit={submit}><div className="panel-head"><div><div className="panel-title">Add payment</div><div className="panel-note">Only accrued completed-walk charges can be collected. Rate is ₹65 per dog per walk.</div></div><button type="button" className="plain-button" onClick={()=>setShow(false)}>Close</button></div>
   {pendingBookings.length===0?<div className="empty">No outstanding completed-walk balance.</div>:<><div className="form-grid">
    <label className="full-field">Booking *<select required value={form.booking_id} onChange={e=>{const b=pendingBookings.find(x=>x.id===e.target.value);setForm({...form,booking_id:e.target.value,amount_inr:b?String(b.due_inr):""});}}><option value="">Select booking</option>{pendingBookings.map(b=><option key={b.id} value={b.id}>{b.customer_name} · {b.dog_name} · {b.completed_walks} completed · Due ₹{b.due_inr.toLocaleString("en-IN")}</option>)}</select></label>
    <label>Amount received (₹) *<input type="number" required min="1" max={balance||10000000} step="1" inputMode="numeric" value={form.amount_inr} onChange={e=>setForm({...form,amount_inr:e.target.value})}/></label>
    <label>Payment date *<input type="date" required value={form.payment_date} onChange={e=>setForm({...form,payment_date:e.target.value})}/></label>
    <label>Payment method<select value={form.payment_method} onChange={e=>setForm({...form,payment_method:e.target.value})}><option value="upi">UPI</option><option value="cash">Cash</option><option value="bank">Bank transfer</option><option value="other">Other</option></select></label>
    <label>Reference / Note<input maxLength={250} value={form.reference_note} onChange={e=>setForm({...form,reference_note:e.target.value})} placeholder="Optional transaction note"/></label>
   </div><div className="booking-price">Outstanding completed-walk balance: <strong>₹{balance.toLocaleString("en-IN")}</strong></div><div className="form-actions"><button className="action" disabled={saving||!selected}>{saving?"Saving…":"Save payment"}</button></div></>}
  </form>}
  <section className="panel"><div className="panel-head"><div><div className="panel-title">{payments.length} payment record{payments.length===1?"":"s"}</div><div className="panel-note">Payment history, newest first</div></div></div>
   {loading?<div className="empty">Loading payments…</div>:payments.length===0?<div className="empty"><CircleDollarSign size={24}/><strong>No payments recorded yet</strong>Payments collected against completed walks will appear here.</div>:<div className="table-wrap"><table className="data-table"><thead><tr><th>Customer</th><th>Dog</th><th>Date</th><th>Amount</th><th>Method</th><th>Note</th></tr></thead><tbody>{payments.map(p=><tr key={p.id}><td><strong>{p.customer_name}</strong></td><td>{p.dog_name||"—"}</td><td>{p.payment_date}</td><td>₹{p.amount_inr.toLocaleString("en-IN")}</td><td>{p.payment_method.toUpperCase()}</td><td>{p.reference_note||"—"}</td></tr>)}</tbody></table></div>}
  </section>
 </main>;
}