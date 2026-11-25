"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, PawPrint, UserRound, Phone, MapPin, Clock3, Pencil, HeartPulse } from "lucide-react";

type R = Record<string, any>;
const BREEDS = ["Indie / Indian Pariah","Labrador Retriever","Golden Retriever","German Shepherd","Beagle","Pug","Shih Tzu","Rottweiler","Siberian Husky","Boxer","Dachshund","Pomeranian","German Spitz","Cocker Spaniel","French Bulldog","Doberman","Great Dane","Chihuahua","Lhasa Apso","Other"];
const AGES = ["Below 6 months","6–12 months","1–2 years","3–5 years","6–8 years","9–12 years","12+ years"];
const EMPTY = {name:"",breed:"",age_text:"",size:"",gender:"",temperament:"",medical_notes:"",emergency_notes:""};

export default function DogDetail() {
  const { id } = useParams<{id:string}>();
  const [dog,setDog] = useState<R|null>(null);
  const [walks,setWalks] = useState<R[]>([]);
  const [form,setForm] = useState(EMPTY);
  const [editing,setEditing] = useState(false);
  const [saving,setSaving] = useState(false);
  const [error,setError] = useState("");
  const [success,setSuccess] = useState("");
  const money=(v:any)=>"₹"+Number(v||0).toLocaleString("en-IN");
  const date=(v:string)=>v?new Date(v+"T00:00:00").toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"}):"—";
  async function load(){
    const r=await fetch("/api/dogs/"+id);
    if(r.status===401){location.assign("/login");return;}
    const j=await r.json();
    if(!r.ok){setError(j.error||"Dog profile could not be loaded.");return;}
    setDog(j.dog);setWalks(j.walks||[]);
    setForm({name:j.dog.name||"",breed:j.dog.breed||"",age_text:j.dog.age_text||"",size:j.dog.size||"",gender:j.dog.gender||"",temperament:j.dog.temperament||"",medical_notes:j.dog.medical_notes||"",emergency_notes:j.dog.emergency_notes||""});
  }
  useEffect(()=>{void load();},[id]);
  async function save(e:FormEvent<HTMLFormElement>){
    e.preventDefault();setSaving(true);setError("");setSuccess("");
    try{
      const r=await fetch("/api/dogs",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({id,customer_id:dog?.customer_id,...form})});
      const j=await r.json();if(!r.ok)throw new Error(j.error||"Dog profile could not be saved.");
      setEditing(false);setSuccess("Dog profile updated successfully.");await load();
    }catch(e){setError(e instanceof Error?e.message:"Dog profile could not be saved.");}
    finally{setSaving(false);}
  }
  if(!dog)return <main className="main"><Link href="/dogs" className="back-link"><ArrowLeft size={15}/> Dogs</Link><section className="panel">{error||"Loading dog profile…"}</section></main>;
  const address=[dog.flat_tower,dog.society,dog.locality,dog.city,dog.state,dog.pincode].filter(Boolean).join(", ")||[dog.address,dog.area].filter(Boolean).join(", ")||"Address not added";
  const options=(value:string,items:string[],label:string)=><select value={value} onChange={e=>setForm(p=>({...p,[label]:e.target.value}))}><option value="">Not set</option>{(value&&!items.includes(value)?[value,...items]:items).map(x=><option key={x} value={x}>{x}</option>)}</select>;
  return <main className="main">
    <Link href={"/customers/"+dog.customer_id} className="back-link"><ArrowLeft size={15}/> Back to customer</Link>
    <div className="topbar"><div><div className="eyebrow">Dog profile</div><h1 className="page-title">{dog.name}</h1><p className="subtle">Dog details and walk records.</p></div><button className="action" type="button" onClick={()=>{setEditing(v=>!v);setError("");}}><Pencil size={14}/>{editing?"Close edit":"Edit dog"}</button></div>
    {error&&<div className="error-box">{error}</div>}{success&&<div className="success-box">{success}</div>}
    {editing&&<form className="panel customer-form" onSubmit={save}><div className="panel-title">Edit dog details</div><div className="form-grid">
      <label>Dog name *<input required maxLength={80} value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))}/></label>
      <label>Breed{options(form.breed,BREEDS,"breed")}</label>
      <label>Age range{options(form.age_text,AGES,"age_text")}</label>
      <label>Size{options(form.size,["Small","Medium","Large","Extra Large"],"size")}</label>
      <label>Gender{options(form.gender,["Male","Female"],"gender")}</label>
      <label>Temperament{options(form.temperament,["Friendly","Shy","Energetic","Calm","Anxious","Reactive","Other"],"temperament")}</label>
      <label>Medical notes<textarea rows={3} value={form.medical_notes} onChange={e=>setForm(p=>({...p,medical_notes:e.target.value}))}/></label>
      <label>Emergency instructions<textarea rows={3} value={form.emergency_notes} onChange={e=>setForm(p=>({...p,emergency_notes:e.target.value}))}/></label>
    </div><div className="form-actions"><button className="action" disabled={saving}>{saving?"Saving…":"Save dog profile"}</button><button type="button" className="plain-button" onClick={()=>{setEditing(false);void load();}}>Cancel</button></div></form>}
    <section className="booking-overview panel">
      <div className="booking-overview-head"><div><div className="eyebrow">Dog information</div><h2 className="booking-overview-title">{dog.name}</h2><p className="subtle">{[dog.breed,dog.age_text,dog.size].filter(Boolean).join(" · ")||"Dog details not added yet"}</p></div><div className="booking-avatar dog-avatar"><PawPrint size={24}/></div></div>
      <div className="booking-facts-grid">
        <div className="booking-fact"><span>Breed</span><strong>{dog.breed||"Not added"}</strong></div><div className="booking-fact"><span>Age</span><strong>{dog.age_text||"Not added"}</strong></div>
        <div className="booking-fact"><span>Size</span><strong>{dog.size||"Not added"}</strong></div><div className="booking-fact"><span>Gender</span><strong>{dog.gender||"Not added"}</strong></div>
        <div className="booking-fact"><span>Temperament</span><strong>{dog.temperament||"Not added"}</strong></div>
      </div>
    </section>
    <section className="panel"><div className="booking-section-heading"><UserRound size={17}/> Owner information</div><div className="booking-people-grid"><div className="booking-person"><div className="booking-avatar"><UserRound size={20}/></div><div className="booking-person-copy"><strong>{dog.customer_name}</strong><span className="booking-meta"><Phone size={13}/>{dog.customer_phone||"No mobile number"}</span>{dog.whatsapp_phone&&<span className="booking-meta">WhatsApp: {dog.whatsapp_phone}</span>}<Link className="booking-profile-link" href={"/customers/"+dog.customer_id}>View customer profile →</Link></div></div><div className="booking-person"><div className="booking-avatar"><MapPin size={20}/></div><div className="booking-person-copy"><span className="booking-label">WALKING ADDRESS</span><strong>{address}</strong></div></div></div></section>
    <section className="panel"><div className="booking-section-heading"><HeartPulse size={17}/> Care and safety instructions</div><div className="booking-facts-grid"><div className="booking-fact"><span>Medical notes</span><strong>{dog.medical_notes||"No medical notes added"}</strong></div><div className="booking-fact"><span>Behaviour / emergency instructions</span><strong>{dog.emergency_notes||"No emergency instructions added"}</strong></div></div></section>
    <section className="panel"><div className="panel-head"><div><div className="booking-section-heading"><Clock3 size={17}/> Walk history</div><p className="panel-note">Latest 100 scheduled and completed walks.</p></div><span className="payment-count">{walks.length} walks</span></div>
      {walks.length?<div className="payment-history-list">{walks.map(w=><div className="payment-history-row" key={w.id}><div><strong>{date(w.walk_date)} · {String(w.slot||"").replace(/^./,x=>x.toUpperCase())}</strong><span>{w.scheduled_time||"Time not set"} · {w.duration_minutes||w.walk_duration_minutes||"—"} min · {w.status}</span></div><strong className="payment-amount">{w.status==="completed"?money(w.price_per_walk_inr):"—"}</strong></div>)}</div>:<div className="booking-empty-payments">No walks recorded yet.</div>}
    </section>
  </main>;
}
