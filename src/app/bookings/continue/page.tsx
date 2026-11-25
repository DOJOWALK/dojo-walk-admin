"use client";

import { FormEvent, useEffect, useState } from "react";
import { ArrowLeft, RefreshCw } from "lucide-react";
import Link from "next/link";

type Booking={id:string;customer_id:string;dog_id:string;customer_name:string;dog_name:string;plan_type:string;start_date:string;price_inr:number;advance_received_inr:number;status:string;sunday_extra_enabled:number};
const plans=[{id:"monthly_am_pm",label:"Morning + Evening · ₹2,999/month",price:2999},{id:"monthly_once",label:"One walk daily · ₹1,999/month",price:1999},{id:"temporary_am_pm",label:"Temporary Morning + Evening · ₹150/day",price:150},{id:"single_walk",label:"Single walk · ₹100",price:100}];
function localDate(){const d=new Date();const offset=d.getTimezoneOffset();return new Date(d.getTime()-offset*60000).toISOString().slice(0,10);}

export default function ContinueBookingPage(){
 const [bookings,setBookings]=useState<Booking[]>([]);
 const [form,setForm]=useState({source_booking_id:"",plan_type:"monthly_am_pm",start_date:localDate(),sunday_extra_enabled:false,payment_choice:"later",payment_method:"upi",morning_time:"07:00",evening_time:"18:00",notes:""});
 const [loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[error,setError]=useState(""),[success,setSuccess]=useState("");
 async function load(){setLoading(true);try{const r=await fetch("/api/bookings");if(r.status===401){window.location.assign("/login");return;}const j=await r.json();if(!r.ok)throw new Error(j.error||"Bookings could not be loaded.");setBookings(j.bookings||[]);}catch(e){setError(e instanceof Error?e.message:"Could not load bookings.");}finally{setLoading(false);}}
 useEffect(()=>{void load();},[]);
 const eligible=bookings.filter(b=>b.status!=="cancelled");
 const selected=eligible.find(b=>b.id===form.source_booking_id);
 const monthly=form.plan_type.startsWith("monthly_");
 const plan=plans.find(p=>p.id===form.plan_type)!;
 const total=plan.price+(monthly&&form.sunday_extra_enabled?500:0);
 async function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();setSaving(true);setError("");setSuccess("");try{const r=await fetch("/api/bookings/renew",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(form)});const j=await r.json();if(!r.ok)throw new Error(j.error||"Plan could not be saved.");setSuccess("New plan saved. Total: ₹"+Number(j.price_inr).toLocaleString("en-IN")+". Previous booking history is preserved.");setForm({...form,source_booking_id:"",notes:""});await load();}catch(e){setError(e instanceof Error?e.message:"Plan could not be saved.");}finally{setSaving(false);}}
 return <main className="main">
  <div className="topbar"><div><Link href="/bookings" className="back-link"><ArrowLeft size={15}/> Bookings</Link><div className="eyebrow">Continue or change plan</div><h1 className="page-title">Continue / Change Plan</h1><p className="subtle">Create a new plan for an existing customer without deleting their old booking or payment history.</p></div></div>
  {error&&<div className="error-box">{error}</div>}{success&&<div className="success-box">{success}</div>}
  <form className="panel customer-form" onSubmit={submit}>
   <div className="panel-head"><div><div className="panel-title">New plan details</div><div className="panel-note">The previous booking ends the day before this new plan starts.</div></div><RefreshCw size={19} color="#18734d"/></div>
   {loading?<div className="empty">Loading bookings…</div>:eligible.length===0?<div className="empty">No existing booking found. Create the first booking from Bookings.</div>:<>
    <div className="form-grid">
     <label className="full-field">Existing customer booking *<select required value={form.source_booking_id} onChange={e=>setForm({...form,source_booking_id:e.target.value})}><option value="">Select customer and dog</option>{eligible.map(b=><option key={b.id} value={b.id}>{b.customer_name} · {b.dog_name} · {b.plan_type.replaceAll("_"," ")} · {b.start_date}</option>)}</select></label>
     {selected?<div className="full-field booking-price">Selected: <strong>{selected.customer_name} · {selected.dog_name}</strong><br/>Previous plan amount: ₹{selected.price_inr.toLocaleString("en-IN")} · Received: ₹{selected.advance_received_inr.toLocaleString("en-IN")}</div>:null}
     <label>New plan *<select value={form.plan_type} onChange={e=>setForm({...form,plan_type:e.target.value,sunday_extra_enabled:false})}>{plans.map(p=><option key={p.id} value={p.id}>{p.label}</option>)}</select></label>
     <label>New plan start date *<input type="date" required min={selected?selected.start_date:undefined} value={form.start_date} onChange={e=>setForm({...form,start_date:e.target.value})}/></label>
     <label className="full-field sunday-toggle"><span><input type="checkbox" checked={form.sunday_extra_enabled} disabled={!monthly} onChange={e=>setForm({...form,sunday_extra_enabled:e.target.checked})}/> Sunday Extra <strong>+₹500/month</strong></span><small>{monthly?"Optional Sunday service for monthly plans.":"Available with monthly plans only."}</small></label>
     <label>Morning time<input type="time" value={form.morning_time} onChange={e=>setForm({...form,morning_time:e.target.value})}/></label>
     <label>Evening time<input type="time" value={form.evening_time} onChange={e=>setForm({...form,evening_time:e.target.value})}/></label>
     <label>Payment option *<select value={form.payment_choice} onChange={e=>setForm({...form,payment_choice:e.target.value})}><option value="full">Full payment now</option><option value="later">Pay later</option></select></label>
     {form.payment_choice==="full"?<label>Payment method<select value={form.payment_method} onChange={e=>setForm({...form,payment_method:e.target.value})}><option value="upi">UPI</option><option value="cash">Cash</option><option value="bank">Bank transfer</option><option value="other">Other</option></select></label>:null}
     <label className="full-field">Notes<textarea rows={2} maxLength={1000} value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} placeholder="Optional plan notes"/></label>
    </div>
    <div className="booking-price">New plan total: <strong>₹{total.toLocaleString("en-IN")}</strong><br/>Payment: <strong>{form.payment_choice==="full"?"Full payment now":"Pay later"}</strong>{monthly&&form.sunday_extra_enabled?<><br/>Includes ₹500 Sunday Extra</>:null}</div>
    <div className="form-actions"><button className="action" disabled={saving||!selected}>{saving?"Saving…":"Save new plan"}</button></div>
   </>}
  </form>
 </main>;
}
