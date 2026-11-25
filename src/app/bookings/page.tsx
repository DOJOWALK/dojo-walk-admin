"use client";

import { FormEvent, useEffect, useState } from "react";
import { ArrowLeft, CalendarPlus, Plus } from "lucide-react";
import Link from "next/link";

type Booking={id:string;customer_id:string;dog_id:string;customer_name:string;customer_phone?:string;dog_name:string;start_date:string;walks_per_day:number;walk_duration_minutes:number;price_per_walk_inr:number;completed_walks:number;accrued_inr:number;paid_inr:number;due_inr:number;status:string};
const STATES = ["Andhra Pradesh","Arunachal Pradesh","Assam","Bihar","Chhattisgarh","Goa","Gujarat","Haryana","Himachal Pradesh","Jharkhand","Karnataka","Kerala","Madhya Pradesh","Maharashtra","Manipur","Meghalaya","Mizoram","Nagaland","Odisha","Punjab","Rajasthan","Sikkim","Tamil Nadu","Telangana","Tripura","Uttar Pradesh","Uttarakhand","West Bengal","Andaman and Nicobar Islands","Chandigarh","Dadra and Nagar Haveli and Daman and Diu","Delhi","Jammu and Kashmir","Ladakh","Lakshadweep","Puducherry"];
function localDate(){const d=new Date();const offset=d.getTimezoneOffset();return new Date(d.getTime()-offset*60000).toISOString().slice(0,10);}
const initialForm=()=>({owner_name:"",phone:"",whatsapp_phone:"",dog_name:"",dog_breed:"",dog_age:"",dog_size:"",address:"",city:"",state:"Uttar Pradesh",start_date:localDate(),start_slot:"morning",walks_per_day:"1",walk_duration_minutes:"30",morning_time:"07:00",evening_time:"18:00",booking_source:"whatsapp",notes:""});

export default function BookingsPage(){
 const [bookings,setBookings]=useState<Booking[]>([]);
 const [form,setForm]=useState(initialForm);
 const [show,setShow]=useState(false),[loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[error,setError]=useState(""),[success,setSuccess]=useState("");
 async function load(){
  setLoading(true);setError("");
  try{
   const r=await fetch("/api/bookings");
   if(r.status===401){window.location.assign("/login");return;}
   const j=await r.json();if(!r.ok)throw new Error(j.error||"Bookings could not be loaded.");
   setBookings(j.bookings||[]);
  }catch(e){setError(e instanceof Error?e.message:"Could not load bookings.");}
  finally{setLoading(false);}
 }
 useEffect(()=>{void load();},[]);
 async function submit(e:FormEvent<HTMLFormElement>){
  e.preventDefault();setSaving(true);setError("");setSuccess("");
  try{
   const r=await fetch("/api/bookings",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...form,walks_per_day:Number(form.walks_per_day),walk_duration_minutes:Number(form.walk_duration_minutes)})});
   const j=await r.json();if(!r.ok)throw new Error(j.error||"Booking could not be saved.");
   setSuccess("Booking saved! Owner and dog profiles have been added or matched automatically.");
   setShow(false);setForm(initialForm());await load();
  }catch(e){setError(e instanceof Error?e.message:"Booking could not be saved.");}
  finally{setSaving(false);}
 }
 return <main className="main">
  <div className="topbar"><div><Link href="/" className="back-link"><ArrowLeft size={15}/> Dashboard</Link><div className="eyebrow">Booking-first workflow</div><h1 className="page-title">Bookings</h1><p className="subtle">Add the owner and dog here. Their profiles are created or matched automatically.</p></div><button className="action" onClick={()=>{setShow(!show);setSuccess("");}}><Plus size={15}/> Add booking</button></div>
  {error&&<div className="error-box">{error}</div>}{success&&<div className="success-box">{success}</div>}
  {show&&<form className="panel customer-form" onSubmit={submit}><div className="panel-head"><div><div className="panel-title">New booking · Owner + Dog</div><div className="panel-note">Existing owners are matched by mobile number; an existing dog with the same name is reused.</div></div><button type="button" className="plain-button" onClick={()=>setShow(false)}>Close</button></div>
   <div className="form-grid">
    <label>Owner name *<input required minLength={2} maxLength={100} autoComplete="name" value={form.owner_name} onChange={e=>setForm({...form,owner_name:e.target.value})} placeholder="Owner full name"/></label>
    <label>Mobile number *<input required type="tel" inputMode="tel" autoComplete="tel" maxLength={20} value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} placeholder="+91 98XXXXXXXX"/></label>
    <label>WhatsApp number<input type="tel" inputMode="tel" maxLength={20} value={form.whatsapp_phone} onChange={e=>setForm({...form,whatsapp_phone:e.target.value})} placeholder="If different from mobile"/></label>
    <label>Dog name *<input required maxLength={80} value={form.dog_name} onChange={e=>setForm({...form,dog_name:e.target.value})} placeholder="Dog's name"/></label>
    <label>Breed<input maxLength={80} value={form.dog_breed} onChange={e=>setForm({...form,dog_breed:e.target.value})} placeholder="Dog breed"/></label>
    <label>Age<input maxLength={40} value={form.dog_age} onChange={e=>setForm({...form,dog_age:e.target.value})} placeholder="e.g. 2 years"/></label>
    <label>Dog size<select value={form.dog_size} onChange={e=>setForm({...form,dog_size:e.target.value})}><option value="">Select size</option><option value="Small">Small</option><option value="Medium">Medium</option><option value="Large">Large</option></select></label>
    <label className="full-field">Address / Flat / Tower<input maxLength={200} value={form.address} onChange={e=>setForm({...form,address:e.target.value})} placeholder="Flat number, tower, society"/></label>
    <label>City *<input required maxLength={100} value={form.city} onChange={e=>setForm({...form,city:e.target.value})} placeholder="e.g. Greater Noida West"/></label>
    <label>State *<select required value={form.state} onChange={e=>setForm({...form,state:e.target.value})}>{STATES.map(s=><option key={s} value={s}>{s}</option>)}</select></label>
    <label>Start date *<input type="date" required value={form.start_date} onChange={e=>setForm({...form,start_date:e.target.value})}/></label>
    <label>Walk duration *<select value={form.walk_duration_minutes} onChange={e=>setForm({...form,walk_duration_minutes:e.target.value})}><option value="20">20 minutes · ₹45</option><option value="30">30 minutes · ₹65</option><option value="45">45 minutes · ₹95</option><option value="60">60 minutes · ₹125</option></select></label>
    <label>Walks per day *<select value={form.walks_per_day} onChange={e=>setForm({...form,walks_per_day:e.target.value})}><option value="1">1 walk per day</option><option value="2">2 walks per day</option></select></label>
    <label>First walk from *<select value={form.start_slot} onChange={e=>setForm({...form,start_slot:e.target.value})}><option value="morning">Morning</option><option value="evening">Evening</option></select></label>
    {form.walks_per_day==="1"?<label>{form.start_slot==="morning"?"Morning":"Evening"} time<input required type="time" value={form.start_slot==="morning"?form.morning_time:form.evening_time} onChange={e=>setForm({...form,[form.start_slot==="morning"?"morning_time":"evening_time"]:e.target.value})}/></label>:<><label>Morning time<input required type="time" value={form.morning_time} onChange={e=>setForm({...form,morning_time:e.target.value})}/></label><label>Evening time<input required type="time" value={form.evening_time} onChange={e=>setForm({...form,evening_time:e.target.value})}/></label></>}
    <label>Booking source<select value={form.booking_source} onChange={e=>setForm({...form,booking_source:e.target.value})}><option value="whatsapp">WhatsApp</option><option value="phone">Phone call</option><option value="walk_in">Walk-in</option><option value="other">Other</option></select></label>
    <label className="full-field">Notes<textarea rows={2} maxLength={1000} value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})}/></label>
   </div>
   <div className="booking-price">Rate: <strong>₹{({20:45,30:65,45:95,60:125} as Record<number,number>)[Number(form.walk_duration_minutes)]} per dog, per completed {form.walk_duration_minutes}-minute walk</strong><br/>Only completed walks are charged. Missed or cancelled walks: ₹0.</div>
   <div className="form-actions"><button className="action" disabled={saving}>{saving?"Saving…":"Save booking + owner + dog"}</button></div>
  </form>}
  <section className="panel"><div className="panel-head"><div><div className="panel-title">{bookings.length} booking{bookings.length===1?"":"s"}</div><div className="panel-note">Billing is calculated from completed walks only.</div></div></div>
   {loading?<div className="empty">Loading bookings…</div>:bookings.length===0?<div className="empty"><CalendarPlus size={24}/><strong>No bookings recorded yet</strong>Use Add booking to create the owner, dog and booking together.</div>:<div className="table-wrap"><table className="data-table"><thead><tr><th>Customer</th><th>Mobile</th><th>Dog</th><th>Start date</th><th>Walks/day</th><th>Duration</th><th>Completed</th><th>Charges</th><th>Received</th><th>Due</th><th>Status</th></tr></thead><tbody>{bookings.map(b=><tr key={b.id}><td><Link href={`/customers/${b.customer_id}`} className="table-link"><strong>{b.customer_name}</strong></Link></td><td>{b.customer_phone||"—"}</td><td><Link href={`/dogs/${b.dog_id}`} className="table-link">{b.dog_name}</Link></td><td>{b.start_date}</td><td>{b.walks_per_day}</td><td>{b.walk_duration_minutes} min</td><td>{b.completed_walks}</td><td>₹{Number(b.accrued_inr||0).toLocaleString("en-IN")}</td><td>₹{Number(b.paid_inr||0).toLocaleString("en-IN")}</td><td><strong>₹{Number(b.due_inr||0).toLocaleString("en-IN")}</strong></td><td><span className="status-dot">{b.status}</span></td></tr>)}</tbody></table></div>}
  </section>
 </main>;
}
