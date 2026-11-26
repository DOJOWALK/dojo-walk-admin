"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { ArrowLeft, CalendarPlus, MapPin } from "lucide-react";
import Link from "next/link";

type Dog = { id: string; name: string; breed: string | null };
type RequestRow = { id: string; dog_id: string; service_type: string; preferred_date: string; preferred_time: string; duration_minutes: number; pickup_address: string; estimated_price_inr: number; proposed_date: string | null; proposed_time: string | null; final_price_inr: number | null; admin_note: string | null; status: string };
const today = () => new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Kolkata"}).format(new Date());
const labels: Record<string,string> = {monthly_am_pm:"Monthly · Morning + Evening",monthly_once:"Monthly · Once daily",temporary_am_pm:"Temporary · Morning + Evening",single_walk:"Single walk"};
const statusLabels: Record<string,string> = {new_request:"New request",under_review:"Under review",time_proposed:"Time proposed",customer_confirmed:"Confirmed by you",rejected:"Not accepted",cancelled:"Cancelled",converted:"Booking created"};

export default function CustomerBookingsPage() {
  const [dogs,setDogs]=useState<Dog[]>([]);
  const [requests,setRequests]=useState<RequestRow[]>([]);
  const [form,setForm]=useState({dog_id:"",service_type:"single_walk",preferred_date:today(),preferred_time:"07:00",duration_minutes:"30",pickup_address:"",instructions:"",pickup_latitude:"",pickup_longitude:""});
  const [loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[error,setError]=useState(""),[success,setSuccess]=useState("");
  const load=useCallback(async()=>{
    setLoading(true);
    try { const r=await fetch("/api/customer/booking-requests",{cache:"no-store"}); const j=await r.json(); if(r.status===401){window.location.assign("/customer/login");return;} if(!r.ok)throw new Error(j.error||"Requests load nahi hui."); setDogs(j.dogs||[]);setRequests(j.requests||[]); if(!form.dog_id && j.dogs?.[0])setForm(v=>({...v,dog_id:j.dogs[0].id})); }
    catch(e){setError(e instanceof Error?e.message:"Requests load nahi hui.");} finally{setLoading(false);}
  }
  useEffect(()=>{void load();},[]);
  function captureLocation(){ if(!navigator.geolocation){setError("Is device par location available nahi hai.");return;} setError(""); navigator.geolocation.getCurrentPosition(pos=>setForm(v=>({...v,pickup_latitude:String(pos.coords.latitude),pickup_longitude:String(pos.coords.longitude)})),()=>setError("Location permission nahi mili. Aap address manually enter kar sakte hain."),{enableHighAccuracy:true,timeout:12000,maximumAge:60000}); }
  async function submit(e:FormEvent<HTMLFormElement>){
    e.preventDefault();setSaving(true);setError("");setSuccess("");
    try { const r=await fetch("/api/customer/booking-requests",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...form,duration_minutes:Number(form.duration_minutes)})}); const j=await r.json();if(!r.ok)throw new Error(j.error||"Request submit nahi hui.");setSuccess("Booking request Admin ko bhej di gayi hai. Final timing aur price Admin confirm karega.");setForm(v=>({...v,instructions:""}));await load(); }
    catch(e){setError(e instanceof Error?e.message:"Request submit nahi hui.");} finally{setSaving(false);}
  }
  async function respond(id:string,action:"confirm"|"cancel"){
    setError("");try{const r=await fetch("/api/customer/booking-requests",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({id,action})});const j=await r.json();if(!r.ok)throw new Error(j.error||"Update nahi hua.");await load();}catch(e){setError(e instanceof Error?e.message:"Update nahi hua.");}
  }
  return <main className="portal-page">
    <header className="portal-header"><Link className="portal-brand" href="/customer/dashboard"><span>DW</span><strong>Dojo Walk</strong></Link><Link className="portal-logout" href="/customer/dashboard"><ArrowLeft size={14}/> Dashboard</Link></header>
    <section className="portal-welcome"><div><div className="eyebrow">CUSTOMER PORTAL</div><h1>Book a Walk</h1><p>Request bhejein; final schedule Admin review ke baad confirm hoga.</p></div></section>
    {error&&<div className="error-box">{error}</div>}{success&&<div className="success-box">{success}</div>}
    <section className="portal-section">
      <div className="portal-section-heading"><div><h2>New booking request</h2><p>Estimate ₹45–₹125 per walk; final amount Admin confirm karega.</p></div><CalendarPlus size={20}/></div>
      {dogs.length===0 ? <div className="portal-empty"><strong>Dog profile nahi mila</strong><span>Admin se apne dog ka profile add karwane ke liye Support Chat use karein.</span></div> :
      <form className="form-grid" onSubmit={submit}>
        <label>Dog *<select required value={form.dog_id} onChange={e=>setForm({...form,dog_id:e.target.value})}>{dogs.map(d=><option key={d.id} value={d.id}>{d.name}{d.breed?" · "+d.breed:""}</option>)}</select></label>
        <label>Service *<select value={form.service_type} onChange={e=>setForm({...form,service_type:e.target.value})}><option value="single_walk">Single walk</option><option value="monthly_once">Monthly · Once daily</option><option value="monthly_am_pm">Monthly · Morning + Evening</option><option value="temporary_am_pm">Temporary · Morning + Evening</option></select></label>
        <label>Preferred date *<input required type="date" min={today()} value={form.preferred_date} onChange={e=>setForm({...form,preferred_date:e.target.value})}/></label>
        <label>Preferred time *<input required type="time" value={form.preferred_time} onChange={e=>setForm({...form,preferred_time:e.target.value})}/></label>
        <label>Walk duration *<select value={form.duration_minutes} onChange={e=>setForm({...form,duration_minutes:e.target.value})}><option value="20">20 minutes</option><option value="30">30 minutes</option><option value="45">45 minutes</option><option value="60">60 minutes</option></select></label>
        <label className="full-field">Pickup address *<textarea required minLength={5} maxLength={500} rows={3} value={form.pickup_address} onChange={e=>setForm({...form,pickup_address:e.target.value})} placeholder="Flat, tower, society, street, landmark"/></label>
        <label className="full-field">Instructions (optional)<textarea maxLength={1000} rows={2} value={form.instructions} onChange={e=>setForm({...form,instructions:e.target.value})} placeholder="Pickup instructions or anything the Walker should know"/></label>
        <div className="full-field" style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}><button type="button" className="portal-refresh" onClick={captureLocation}><MapPin size={14}/> Use my current location</button><span className="subtle">{form.pickup_latitude ? "Location captured ✓" : "Optional: GPS permission se pickup point attach karein."}</span>{form.pickup_latitude&&<button type="button" className="plain-button" onClick={()=>setForm(v=>({...v,pickup_latitude:"",pickup_longitude:""}))}>Remove location</button>}</div>
        <div className="full-field form-actions"><button className="action" disabled={saving||!form.dog_id}>{saving?"Sending…":"Send booking request"}</button></div>
      </form>}
    </section>
    <section className="portal-section" style={{marginTop:16}}>
      <div className="portal-section-heading"><div><h2>Your requests</h2><p>Admin ka response aur proposed schedule yahan dikhega.</p></div><button className="portal-refresh" onClick={()=>void load()}>Refresh</button></div>
      {loading?<div className="portal-empty">Loading…</div>:requests.length===0?<div className="portal-empty">Abhi koi booking request nahi hai.</div>:<div className="record-list">{requests.map(r=><article className="record-card" key={r.id}><div className="record-main"><div className="record-heading"><strong>{dogs.find(d=>d.id===r.dog_id)?.name||"Your dog"}</strong><span className={"record-status status-"+r.status}>{statusLabels[r.status]||r.status}</span></div><div className="record-subtitle">{labels[r.service_type]||r.service_type} · {r.duration_minutes} min · {r.preferred_date} at {r.preferred_time}</div>{r.proposed_date&&<div className="record-subtitle"><strong>Admin proposed:</strong> {r.proposed_date} at {r.proposed_time} · Final ₹{r.final_price_inr??r.estimated_price_inr}</div>}<div className="record-subtitle">{r.pickup_address}</div>{r.admin_note&&<div className="record-subtitle">Admin note: {r.admin_note}</div>}</div>{r.status==="time_proposed"&&<div className="record-side"><button className="action" onClick={()=>void respond(r.id,"confirm")}>Confirm time</button><button className="plain-button" onClick={()=>void respond(r.id,"cancel")}>Cancel request</button></div>}{["new_request","under_review"].includes(r.status)&&<div className="record-side"><button className="plain-button" onClick={()=>void respond(r.id,"cancel")}>Cancel request</button></div>}</article>)}</div>}
    </section>
    <footer className="portal-footer">Dojo Walk · Booking requests are not confirmed until you accept the proposed time.</footer>
  </main>;
}
