"use client";

import { FormEvent, useEffect, useState } from "react";
import { ArrowLeft, CalendarPlus, Plus } from "lucide-react";
import Link from "next/link";

type Customer={id:string;full_name:string};
type Dog={id:string;name:string;customer_id:string};
type Booking={id:string;customer_name:string;dog_name:string;plan_type:string;start_date:string;price_inr:number;status:string;advance_received_inr:number;sunday_extra_enabled:number;payment_status:string};

function localDate(){const d=new Date();const offset=d.getTimezoneOffset();return new Date(d.getTime()-offset*60000).toISOString().slice(0,10);}

const planLabels:Record<string,string>={monthly_am_pm:"Morning + Evening · Monthly",monthly_once:"One walk daily · Monthly",temporary_am_pm:"Temporary Morning + Evening",single_walk:"Single walk"};

export default function BookingsPage(){
 const [customers,setCustomers]=useState<Customer[]>([]);
 const [dogs,setDogs]=useState<Dog[]>([]);
 const [bookings,setBookings]=useState<Booking[]>([]);
 const [form,setForm]=useState({customer_id:"",dog_id:"",plan_type:"monthly_am_pm",sunday_extra_enabled:false,start_date:localDate(),morning_time:"07:00",evening_time:"18:00",booking_source:"whatsapp",advance_received_inr:"",payment_choice:"later",payment_method:"upi",notes:""});
 const [show,setShow]=useState(false),[loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[error,setError]=useState("");
 async function load(){
  setLoading(true);setError("");
  try{
   const [c,d,b]=await Promise.all([fetch("/api/customers"),fetch("/api/dogs"),fetch("/api/bookings")]);
   if([c,d,b].some(r=>r.status===401)){window.location.assign("/login");return;}
   const [cj,dj,bj]=await Promise.all([c.json(),d.json(),b.json()]);
   if(!c.ok||!d.ok||!b.ok)throw new Error(cj.error||dj.error||bj.error||"Bookings could not be loaded.");
   setCustomers(cj.customers||[]);setDogs(dj.dogs||[]);setBookings(bj.bookings||[]);
  }catch(e){setError(e instanceof Error?e.message:"Could not load bookings.");}
  finally{setLoading(false);}
 }
 useEffect(()=>{void load();},[]);
 const customerDogs=dogs.filter(d=>d.customer_id===form.customer_id);
 const monthlyPlan=form.plan_type.startsWith("monthly_");
 const basePrice=({monthly_am_pm:2999,monthly_once:1999,temporary_am_pm:150,single_walk:100} as Record<string,number>)[form.plan_type];
 const totalPrice=basePrice+(monthlyPlan&&form.sunday_extra_enabled?500:0);
 const receivedAmount=form.payment_choice==="full"?totalPrice:form.payment_choice==="later"?0:Number(form.advance_received_inr||0);
 const dueAmount=Math.max(0,totalPrice-receivedAmount);
 async function submit(e:FormEvent<HTMLFormElement>){
  e.preventDefault();setSaving(true);setError("");
  try{
   const r=await fetch("/api/bookings",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...form,advance_received_inr:receivedAmount,payment_method:form.payment_method})});
   const j=await r.json();if(!r.ok)throw new Error(j.error||"Booking could not be saved.");
   setShow(false);setForm({...form,dog_id:"",advance_received_inr:"",notes:""});await load();
  }catch(e){setError(e instanceof Error?e.message:"Booking could not be saved.");}
  finally{setSaving(false);}
 }
 return <main className="main">
  <div className="topbar"><div><Link href="/" className="back-link"><ArrowLeft size={15}/> Dashboard</Link><div className="eyebrow">Bookings & plans</div><h1 className="page-title">Bookings</h1><p className="subtle">Record phone and WhatsApp bookings, packages and advance payments.</p></div><button className="action" onClick={()=>setShow(!show)}><Plus size={15}/> New booking</button></div>
  {error&&<div className="error-box">{error}</div>}
  {show&&<form className="panel customer-form" onSubmit={submit}><div className="panel-head"><div><div className="panel-title">Create booking</div><div className="panel-note">Prices are set from your confirmed Dojo Walk rates.</div></div><button type="button" className="plain-button" onClick={()=>setShow(false)}>Close</button></div>
   {customers.length===0?<div className="empty">Add a customer and dog before creating a booking.</div>:<><div className="form-grid">
    <label>Customer *<select required value={form.customer_id} onChange={e=>setForm({...form,customer_id:e.target.value,dog_id:""})}><option value="">Select customer</option>{customers.map(c=><option key={c.id} value={c.id}>{c.full_name}</option>)}</select></label>
    <label>Dog *<select required value={form.dog_id} onChange={e=>setForm({...form,dog_id:e.target.value})}><option value="">Select dog</option>{customerDogs.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
    <label>Package *<select value={form.plan_type} onChange={e=>setForm({...form,plan_type:e.target.value})}><option value="monthly_am_pm">Morning + Evening · ₹2,999/month</option><option value="monthly_once">One walk daily · ₹1,999/month</option><option value="temporary_am_pm">Temporary Morning + Evening · ₹150/day</option><option value="single_walk">Single walk · ₹100</option></select></label>
    <label className="full-field sunday-toggle"><span><input type="checkbox" checked={form.sunday_extra_enabled} disabled={!monthlyPlan} onChange={e=>setForm({...form,sunday_extra_enabled:e.target.checked})}/> Sunday Extra Walk <strong>+₹500/month</strong></span><small>{monthlyPlan?"Sunday walks included in this monthly plan.":"Sunday Extra is available with monthly plans only."}</small></label>
    <label>Start date *<input type="date" required value={form.start_date} onChange={e=>setForm({...form,start_date:e.target.value})}/></label>
    <label>Morning time<input type="time" value={form.morning_time} onChange={e=>setForm({...form,morning_time:e.target.value})}/></label>
    <label>Evening time<input type="time" value={form.evening_time} onChange={e=>setForm({...form,evening_time:e.target.value})}/></label>
    <label>Booking source<select value={form.booking_source} onChange={e=>setForm({...form,booking_source:e.target.value})}><option value="whatsapp">WhatsApp</option><option value="phone">Phone call</option><option value="walk_in">Walk-in</option><option value="other">Other</option></select></label>
    <label>Payment option *<select value={form.payment_choice} onChange={e=>setForm({...form,payment_choice:e.target.value,advance_received_inr:e.target.value==="full"?String(totalPrice):e.target.value==="later"?"0":""})}><option value="advance">Advance payment</option><option value="full">Full payment now</option><option value="later">Pay later</option></select></label>
    {form.payment_choice==="advance"?<label>Advance amount received (₹)<input type="number" inputMode="numeric" min="1" max={totalPrice} step="1" required value={form.advance_received_inr} onChange={e=>setForm({...form,advance_received_inr:e.target.value})} placeholder="Enter amount"/></label>:null}
    {form.payment_choice!=="later"?<label>Payment method<select value={form.payment_method} onChange={e=>setForm({...form,payment_method:e.target.value})}><option value="upi">UPI</option><option value="cash">Cash</option><option value="bank">Bank transfer</option><option value="other">Other</option></select></label>:null}
    <label className="full-field">Notes<textarea rows={2} maxLength={1000} value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})}/></label>
   </div><div className="booking-price">Total plan amount: <strong>₹{totalPrice.toLocaleString("en-IN")}</strong><br/>Received now: <strong>₹{receivedAmount.toLocaleString("en-IN")}</strong> · Balance due: <strong>₹{dueAmount.toLocaleString("en-IN")}</strong><br/>{monthlyPlan&&form.sunday_extra_enabled?<span>Includes ₹500 Sunday Extra · </span>:null}<span>30 minutes per walk</span></div><div className="form-actions"><button className="action" disabled={saving}>{saving?"Saving…":"Save booking"}</button></div></>}
  </form>}
  <section className="panel"><div className="panel-head"><div><div className="panel-title">{bookings.length} booking{bookings.length===1?"":"s"}</div><div className="panel-note">Latest bookings first</div></div></div>
   {loading?<div className="empty">Loading bookings…</div>:bookings.length===0?<div className="empty"><CalendarPlus size={24}/><strong>No bookings recorded yet</strong>Add a customer, register their dog and create the first booking.</div>:<div className="table-wrap"><table className="data-table"><thead><tr><th>Customer</th><th>Dog</th><th>Package</th><th>Start date</th><th>Amount</th><th>Received</th><th>Payment</th><th>Booking</th></tr></thead><tbody>{bookings.map(b=><tr key={b.id}><td><strong>{b.customer_name}</strong></td><td>{b.dog_name}</td><td>{planLabels[b.plan_type]||b.plan_type}</td><td>{b.start_date}</td><td>₹{b.price_inr.toLocaleString("en-IN")}</td><td>₹{b.advance_received_inr.toLocaleString("en-IN")}</td><td><span className={`status-dot payment-${b.payment_status}`}>{b.payment_status}</span></td><td><span className="status-dot">{b.status}</span></td></tr>)}</tbody></table></div>}
  </section>
 </main>;
}