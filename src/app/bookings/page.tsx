"use client";

import { FormEvent, useEffect, useState } from "react";
import { ArrowLeft, CalendarPlus, Plus } from "lucide-react";
import Link from "next/link";

type Customer={id:string;full_name:string};
type Dog={id:string;name:string;customer_id:string};
type Booking={id:string;customer_name:string;dog_name:string;start_date:string;walks_per_day:number;price_per_walk_inr:number;completed_walks:number;accrued_inr:number;paid_inr:number;due_inr:number;status:string};

function localDate(){const d=new Date();const offset=d.getTimezoneOffset();return new Date(d.getTime()-offset*60000).toISOString().slice(0,10);}

export default function BookingsPage(){
 const [customers,setCustomers]=useState<Customer[]>([]);
 const [dogs,setDogs]=useState<Dog[]>([]);
 const [bookings,setBookings]=useState<Booking[]>([]);
 const [form,setForm]=useState({customer_id:"",dog_id:"",start_date:localDate(),start_slot:"morning",walks_per_day:"1",morning_time:"07:00",evening_time:"18:00",booking_source:"whatsapp",notes:""});
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
 async function submit(e:FormEvent<HTMLFormElement>){
  e.preventDefault();setSaving(true);setError("");
  try{
   const r=await fetch("/api/bookings",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...form,walks_per_day:Number(form.walks_per_day)})});
   const j=await r.json();if(!r.ok)throw new Error(j.error||"Booking could not be saved.");
   setShow(false);setForm({...form,dog_id:"",notes:""});await load();
  }catch(e){setError(e instanceof Error?e.message:"Booking could not be saved.");}
  finally{setSaving(false);}
 }
 return <main className="main">
  <div className="topbar"><div><Link href="/" className="back-link"><ArrowLeft size={15}/> Dashboard</Link><div className="eyebrow">Per-walk service</div><h1 className="page-title">Bookings</h1><p className="subtle">₹65 per dog for each 30-minute completed walk. No packages or monthly plans.</p></div><button className="action" onClick={()=>setShow(!show)}><Plus size={15}/> New booking</button></div>
  {error&&<div className="error-box">{error}</div>}
  {show&&<form className="panel customer-form" onSubmit={submit}><div className="panel-head"><div><div className="panel-title">Start walking service</div><div className="panel-note">Each booking is for one dog. Add a separate booking for each additional dog.</div></div><button type="button" className="plain-button" onClick={()=>setShow(false)}>Close</button></div>
   {customers.length===0?<div className="empty">Add a customer and dog before creating a booking.</div>:<><div className="form-grid">
    <label>Customer *<select required value={form.customer_id} onChange={e=>setForm({...form,customer_id:e.target.value,dog_id:""})}><option value="">Select customer</option>{customers.map(c=><option key={c.id} value={c.id}>{c.full_name}</option>)}</select></label>
    <label>Dog *<select required value={form.dog_id} onChange={e=>setForm({...form,dog_id:e.target.value})}><option value="">Select dog</option>{customerDogs.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
    <label>Start date *<input type="date" required value={form.start_date} onChange={e=>setForm({...form,start_date:e.target.value})}/></label>
    <label>Walks per day *<select value={form.walks_per_day} onChange={e=>setForm({...form,walks_per_day:e.target.value})}><option value="1">1 walk per day</option><option value="2">2 walks per day</option></select></label>
    <label>First walk from *<select value={form.start_slot} onChange={e=>setForm({...form,start_slot:e.target.value})}><option value="morning">Morning</option><option value="evening">Evening</option></select></label>
    <label>Morning time<input type="time" value={form.morning_time} onChange={e=>setForm({...form,morning_time:e.target.value})}/></label>
    <label>Evening time<input type="time" value={form.evening_time} onChange={e=>setForm({...form,evening_time:e.target.value})}/></label>
    <label>Booking source<select value={form.booking_source} onChange={e=>setForm({...form,booking_source:e.target.value})}><option value="whatsapp">WhatsApp</option><option value="phone">Phone call</option><option value="walk_in">Walk-in</option><option value="other">Other</option></select></label>
    <label className="full-field">Notes<textarea rows={2} maxLength={1000} value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})}/></label>
   </div><div className="booking-price">Rate: <strong>₹65 per dog, per completed 30-minute walk</strong><br/>Only completed walks are charged. Missed or cancelled walks: ₹0.</div><div className="form-actions"><button className="action" disabled={saving||!form.customer_id||!form.dog_id}>{saving?"Saving…":"Save booking"}</button></div></>}
  </form>}
  <section className="panel"><div className="panel-head"><div><div className="panel-title">{bookings.length} booking{bookings.length===1?"":"s"}</div><div className="panel-note">Billing is calculated from completed walks only.</div></div></div>
   {loading?<div className="empty">Loading bookings…</div>:bookings.length===0?<div className="empty"><CalendarPlus size={24}/><strong>No bookings recorded yet</strong>Add a customer, register their dog and create the first booking.</div>:<div className="table-wrap"><table className="data-table"><thead><tr><th>Customer</th><th>Dog</th><th>Start date</th><th>Walks/day</th><th>Completed</th><th>Charges</th><th>Received</th><th>Due</th><th>Status</th></tr></thead><tbody>{bookings.map(b=><tr key={b.id}><td><strong>{b.customer_name}</strong></td><td>{b.dog_name}</td><td>{b.start_date}</td><td>{b.walks_per_day}</td><td>{b.completed_walks}</td><td>₹{b.accrued_inr.toLocaleString("en-IN")}</td><td>₹{b.paid_inr.toLocaleString("en-IN")}</td><td><strong>₹{b.due_inr.toLocaleString("en-IN")}</strong></td><td><span className="status-dot">{b.status}</span></td></tr>)}</tbody></table></div>}
  </section>
 </main>;
}