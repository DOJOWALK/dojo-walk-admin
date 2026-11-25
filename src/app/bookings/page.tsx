"use client";

import { FormEvent, useEffect, useState } from "react";
import { ArrowLeft, CalendarPlus, Plus, Search } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Booking={id:string;customer_id:string;dog_id:string;customer_name:string;customer_phone?:string;dog_name:string;start_date:string;walks_per_day:number;walk_duration_minutes:number;price_per_walk_inr:number;completed_walks:number;accrued_inr:number;paid_inr:number;due_inr:number;status:string};
const STATES = ["Andhra Pradesh","Arunachal Pradesh","Assam","Bihar","Chhattisgarh","Goa","Gujarat","Haryana","Himachal Pradesh","Jharkhand","Karnataka","Kerala","Madhya Pradesh","Maharashtra","Manipur","Meghalaya","Mizoram","Nagaland","Odisha","Punjab","Rajasthan","Sikkim","Tamil Nadu","Telangana","Tripura","Uttar Pradesh","Uttarakhand","West Bengal","Andaman and Nicobar Islands","Chandigarh","Dadra and Nagar Haveli and Daman and Diu","Delhi","Jammu and Kashmir","Ladakh","Lakshadweep","Puducherry"];
const BREEDS = ["Indie / Indian Pariah","Labrador Retriever","Golden Retriever","German Shepherd","Beagle","Pug","Shih Tzu","Rottweiler","Siberian Husky","Boxer","Dachshund","Pomeranian","German Spitz","Cocker Spaniel","French Bulldog","Doberman","Great Dane","Chihuahua","Lhasa Apso","Other"];
const LOCALITIES = ["Gaur City 1","Gaur City 2","Crossings Republik","Techzone 4","Noida Extension","Bisrakh","Char Murti","Sector 1 Greater Noida West","Sector 2 Greater Noida West","Sector 3 Greater Noida West","Sector 4 Greater Noida West","Sector 10 Greater Noida West","Other"];
const CITIES = ["Greater Noida West","Greater Noida","Noida","Ghaziabad","Dadri","Delhi","Other"];
function localDate(){return new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Kolkata"}).format(new Date());}
const initialForm=()=>({owner_name:"",phone:"",whatsapp_phone:"",same_whatsapp:true,dog_name:"",dog_breed:"",dog_age_range:"",dog_size:"",dog_gender:"",dog_temperament:"",flat_tower:"",society:"",locality:"",city:"Greater Noida West",state:"Uttar Pradesh",pincode:"",start_date:localDate(),start_slot:"morning",walks_per_day:"1",walk_duration_minutes:"30",morning_time:"07:00",evening_time:"18:00",booking_source:"whatsapp",notes:""});

export default function BookingsPage(){
 const router=useRouter();
 const [bookings,setBookings]=useState<Booking[]>([]);
 const [form,setForm]=useState(initialForm);
 const [show,setShow]=useState(false),[loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[error,setError]=useState(""),[success,setSuccess]=useState("");
 const [query,setQuery]=useState("");
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
 useEffect(()=>{if(new URLSearchParams(window.location.search).get("new")==="1"){setShow(true);window.history.replaceState({}, "", "/bookings");}void load();},[]);
 async function submit(e:FormEvent<HTMLFormElement>){
  e.preventDefault();setSaving(true);setError("");setSuccess("");
  try{
   const payload={...form,whatsapp_phone:form.same_whatsapp?form.phone:form.whatsapp_phone,dog_age: form.dog_age_range,walks_per_day:Number(form.walks_per_day),walk_duration_minutes:Number(form.walk_duration_minutes)};
   const r=await fetch("/api/bookings",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
   const j=await r.json();if(!r.ok)throw new Error(j.error||"Booking could not be saved.");
   setSuccess("Booking saved! Owner and dog profiles have been added or matched automatically.");
   setShow(false);setForm(initialForm());await load();
  }catch(e){setError(e instanceof Error?e.message:"Booking could not be saved.");}
  finally{setSaving(false);}
 }
 const filteredBookings=bookings.filter(b=>`${b.customer_name} ${b.customer_phone||""} ${b.dog_name} ${b.status}`.toLowerCase().includes(query.toLowerCase()));
 return <main className="main">
  <div className="topbar"><div><Link href="/" className="back-link"><ArrowLeft size={15}/> Dashboard</Link><div className="eyebrow">Booking-first workflow</div><h1 className="page-title">Bookings</h1><p className="subtle">Add the owner, dog and complete address here. Their profiles are created or matched automatically.</p></div><button className="action" onClick={()=>{setShow(!show);setSuccess("");}}><Plus size={15}/> Add booking</button></div>
  {error&&<div className="error-box">{error}</div>}{success&&<div className="success-box">{success}</div>}
  {show&&<form className="panel customer-form" onSubmit={submit}>
   <div className="panel-head"><div><div className="panel-title">New booking · Owner + Dog</div><div className="panel-note">Existing owners are matched by mobile number; an existing dog with the same name is reused.</div></div><button type="button" className="plain-button" onClick={()=>setShow(false)}>Close</button></div>
   <div className="form-grid">
    <label>Owner name *<input required minLength={2} maxLength={100} autoComplete="name" value={form.owner_name} onChange={e=>setForm({...form,owner_name:e.target.value})} placeholder="Owner full name"/></label>
    <label>Mobile number *<input required type="tel" inputMode="tel" autoComplete="tel" maxLength={20} value={form.phone} onChange={e=>setForm({...form,phone:e.target.value,...(form.same_whatsapp?{whatsapp_phone:e.target.value}:{})})} placeholder="+91 98XXXXXXXX"/></label>
    <div className="full-field"><label>WhatsApp number<input type="tel" inputMode="tel" maxLength={20} value={form.whatsapp_phone} onChange={e=>setForm({...form,whatsapp_phone:e.target.value,same_whatsapp:false})} placeholder="If different from mobile" disabled={form.same_whatsapp}/></label><label className="checkbox-label" style={{display:"flex",alignItems:"center",gap:8,marginTop:8}}><input type="checkbox" checked={form.same_whatsapp} onChange={e=>setForm({...form,same_whatsapp:e.target.checked,whatsapp_phone:e.target.checked?form.phone:form.whatsapp_phone})}/> WhatsApp number is same as mobile number</label></div>
    <label>Dog name *<input required maxLength={80} value={form.dog_name} onChange={e=>setForm({...form,dog_name:e.target.value})} placeholder="Dog's name"/></label>
    <label>Breed<select value={form.dog_breed} onChange={e=>setForm({...form,dog_breed:e.target.value})}><option value="">Select breed</option>{BREEDS.map(x=><option key={x} value={x}>{x}</option>)}</select></label>
    <label>Age range<select value={form.dog_age_range} onChange={e=>setForm({...form,dog_age_range:e.target.value})}><option value="">Select age range</option><option>Below 6 months</option><option>6–12 months</option><option>1–2 years</option><option>3–5 years</option><option>6–8 years</option><option>9–12 years</option><option>12+ years</option></select></label>
    <label>Dog size<select required value={form.dog_size} onChange={e=>setForm({...form,dog_size:e.target.value})}><option value="">Select size</option><option>Small</option><option>Medium</option><option>Large</option><option>Extra Large</option></select></label>
    <label>Gender<select required value={form.dog_gender} onChange={e=>setForm({...form,dog_gender:e.target.value})}><option value="">Select gender</option><option>Male</option><option>Female</option></select></label>
    <label>Temperament<select value={form.dog_temperament} onChange={e=>setForm({...form,dog_temperament:e.target.value})}><option value="">Select temperament</option><option>Friendly</option><option>Shy</option><option>Energetic</option><option>Calm</option><option>Anxious</option><option>Reactive</option><option>Other</option></select></label>
    <div className="full-field"><div className="panel-title">Owner address</div><div className="panel-note">Save the address in separate fields for easier search and accurate customer records.</div></div>
    <label>Flat / Tower<input maxLength={80} value={form.flat_tower} onChange={e=>setForm({...form,flat_tower:e.target.value})} placeholder="e.g. A-1204, Tower 7"/></label>
    <label>Society / Address<input maxLength={150} value={form.society} onChange={e=>setForm({...form,society:e.target.value})} placeholder="e.g. Gaur City 2"/></label>
    <label>Area / Locality<select required value={form.locality} onChange={e=>setForm({...form,locality:e.target.value})}><option value="">Select locality</option>{LOCALITIES.map(x=><option key={x} value={x}>{x}</option>)}</select></label>
    <label>City<select required value={form.city} onChange={e=>setForm({...form,city:e.target.value})}>{CITIES.map(x=><option key={x} value={x}>{x}</option>)}</select></label>
    <label>State *<select required value={form.state} onChange={e=>setForm({...form,state:e.target.value})}>{STATES.map(s=><option key={s} value={s}>{s}</option>)}</select></label>
    <label>PIN Code *<input required inputMode="numeric" pattern="[0-9]{6}" minLength={6} maxLength={6} value={form.pincode} onChange={e=>setForm({...form,pincode:e.target.value.replace(/\D/g,"").slice(0,6)})} placeholder="6-digit PIN code"/></label>
    <div className="full-field"><div className="panel-title">Walk schedule</div></div>
    <label>Start date *<input type="date" required value={form.start_date} onChange={e=>setForm({...form,start_date:e.target.value})}/></label>
    <label>Walk duration *<select value={form.walk_duration_minutes} onChange={e=>setForm({...form,walk_duration_minutes:e.target.value})}><option value="20">20 minutes · ₹45</option><option value="30">30 minutes · ₹65</option><option value="45">45 minutes · ₹95</option><option value="60">60 minutes · ₹125</option></select></label>
    <label>Walks per day *<select value={form.walks_per_day} onChange={e=>setForm({...form,walks_per_day:e.target.value})}><option value="1">1 walk per day</option><option value="2">2 walks per day</option></select></label>
    <label>First walk from *<select value={form.start_slot} onChange={e=>setForm({...form,start_slot:e.target.value})}><option value="morning">Morning</option><option value="evening">Evening</option></select></label>
    {form.walks_per_day==="1"?<label>{form.start_slot==="morning"?"Morning":"Evening"} time<input required type="time" value={form.start_slot==="morning"?form.morning_time:form.evening_time} onChange={e=>setForm({...form,[form.start_slot==="morning"?"morning_time":"evening_time"]:e.target.value})}/></label>:<><label>Morning time<input required type="time" value={form.morning_time} onChange={e=>setForm({...form,morning_time:e.target.value})}/></label><label>Evening time<input required type="time" value={form.evening_time} onChange={e=>setForm({...form,evening_time:e.target.value})}/></label></>}
    <label>Booking source<select value={form.booking_source} onChange={e=>setForm({...form,booking_source:e.target.value})}><option value="whatsapp">WhatsApp</option><option value="phone">Phone call</option><option value="walk_in">Walk-in</option><option value="other">Other</option></select></label>
    <label className="full-field">Notes / medical details<textarea rows={3} maxLength={1000} value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} placeholder="Special instructions, health or behaviour notes…"/></label>
   </div>
   <div className="booking-price">Rate: <strong>₹{({20:45,30:65,45:95,60:125} as Record<number,number>)[Number(form.walk_duration_minutes)]} per dog, per completed {form.walk_duration_minutes}-minute walk</strong><br/>Only completed walks are charged. Missed or cancelled walks: ₹0.</div>
   <div className="form-actions"><button className="action" disabled={saving}>{saving?"Saving…":"Save booking + owner + dog"}</button></div>
  </form>}
  <section className="panel"><div className="list-toolbar"><div className="panel-title">{bookings.length} booking{bookings.length===1?"":"s"}</div><div className="search-box"><Search size={15}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search customer, phone or dog"/></div></div>
   {loading?<div className="empty">Loading bookings…</div>:filteredBookings.length===0?<div className="empty"><CalendarPlus size={24}/><strong>{bookings.length?"No matching bookings":"No bookings recorded yet"}</strong>{bookings.length?"Try another name, phone or dog.":"Use Add booking to create an owner, dog and booking together."}</div>:<div className="record-list booking-record-list">{filteredBookings.map(b=><button type="button" className="record-card booking-record-card" key={b.id} onClick={()=>router.push(`/bookings/${b.id}`)}><div className="booking-record-head"><div><strong className="booking-record-dog">{b.dog_name}</strong><span className="booking-record-owner">{b.customer_name}</span></div><span className={`record-status status-${b.status}`}>{b.status}</span></div><div className="booking-record-meta"><span>{b.start_date}</span><span>{b.walks_per_day} {b.walks_per_day===1?"walk":"walks"}/day</span><span>{b.walk_duration_minutes} min</span><span>{b.completed_walks||0} completed</span></div><div className="booking-record-money"><div><span>Charges</span><strong>₹{Number(b.accrued_inr||0).toLocaleString("en-IN")}</strong></div><div><span>Received</span><strong className="received-value">₹{Number(b.paid_inr||0).toLocaleString("en-IN")}</strong></div><div><span>Due</span><strong className="due-value">₹{Number(b.due_inr||0).toLocaleString("en-IN")}</strong></div></div><div className="booking-record-open"><span className="record-subtitle">{b.customer_phone||"No phone number"}</span><span className="record-open">View booking details →</span></div></button>)}</div>}
  </section>
 </main>;
}
