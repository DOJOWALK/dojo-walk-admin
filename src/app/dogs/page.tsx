"use client";

import { FormEvent, useEffect, useState } from "react";
import { ArrowLeft, Dog as DogIcon, Plus, Search } from "lucide-react";
import Link from "next/link";

type Customer = { id: string; full_name: string };
type DogRecord = { id: string; name: string; breed?: string; age_text?: string; size?: string; customer_name: string; customer_phone: string };

export default function DogsPage() {
  const [dogs,setDogs]=useState<DogRecord[]>([]);
  const [customers,setCustomers]=useState<Customer[]>([]);
  const [loading,setLoading]=useState(true);
  const [showForm,setShowForm]=useState(false);
  const [query,setQuery]=useState("");
  const [error,setError]=useState("");
  const [saving,setSaving]=useState(false);
  const [form,setForm]=useState({customer_id:"",name:"",breed:"",age_text:"",size:"",temperament:"",medical_notes:"",emergency_notes:""});

  async function load(){
    setLoading(true);setError("");
    try{
      const [d,c]=await Promise.all([fetch("/api/dogs"),fetch("/api/customers")]);
      if(d.status===401||c.status===401){window.location.assign("/login");return;}
      const dj=await d.json(), cj=await c.json();
      if(!d.ok)throw new Error(dj.error||"Dogs could not be loaded.");
      if(!c.ok)throw new Error(cj.error||"Customers could not be loaded.");
      setDogs(dj.dogs||[]);setCustomers(cj.customers||[]);
    }catch(e){setError(e instanceof Error?e.message:"Could not load dogs.");}
    finally{setLoading(false);}
  }
  useEffect(()=>{void load();},[]);
  async function submit(e:FormEvent<HTMLFormElement>){
    e.preventDefault();setSaving(true);setError("");
    try{
      const r=await fetch("/api/dogs",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(form)});
      const j=await r.json();if(!r.ok)throw new Error(j.error||"Dog could not be saved.");
      setForm({customer_id:"",name:"",breed:"",age_text:"",size:"",temperament:"",medical_notes:"",emergency_notes:""});setShowForm(false);await load();
    }catch(e){setError(e instanceof Error?e.message:"Dog could not be saved.");}
    finally{setSaving(false);}
  }
  const filtered=dogs.filter(d=>`${d.name} ${d.breed||""} ${d.customer_name}`.toLowerCase().includes(query.toLowerCase()));
  return <main className="main">
    <div className="topbar"><div><Link href="/" className="back-link"><ArrowLeft size={15}/> Dashboard</Link><div className="eyebrow">Dog profiles</div><h1 className="page-title">Dogs</h1><p className="subtle">Every dog is linked to its customer profile.</p></div><button className="action" onClick={()=>setShowForm(!showForm)}><Plus size={15}/> Add dog</button></div>
    {error&&<div className="error-box">{error}</div>}
    {showForm&&<form className="panel customer-form" onSubmit={submit}><div className="panel-head"><div><div className="panel-title">Register a dog</div><div className="panel-note">Choose the dog's owner first.</div></div><button type="button" className="plain-button" onClick={()=>setShowForm(false)}>Close</button></div>
      {customers.length===0?<div className="empty">Add a customer before registering a dog.</div>:<><div className="form-grid">
        <label>Customer *<select required value={form.customer_id} onChange={e=>setForm({...form,customer_id:e.target.value})}><option value="">Select customer</option>{customers.map(c=><option key={c.id} value={c.id}>{c.full_name}</option>)}</select></label>
        <label>Dog's name *<input required maxLength={80} value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Dog name"/></label>
        <label>Breed<input maxLength={80} value={form.breed} onChange={e=>setForm({...form,breed:e.target.value})} placeholder="Breed"/></label>
        <label>Age<input maxLength={40} value={form.age_text} onChange={e=>setForm({...form,age_text:e.target.value})} placeholder="e.g. 2 years"/></label>
        <label>Size<select value={form.size} onChange={e=>setForm({...form,size:e.target.value})}><option value="">Select size</option><option>Small</option><option>Medium</option><option>Large</option></select></label>
        <label>Temperament<input maxLength={200} value={form.temperament} onChange={e=>setForm({...form,temperament:e.target.value})} placeholder="Friendly, shy, energetic…"/></label>
        <label className="full-field">Medical notes<textarea rows={2} maxLength={1000} value={form.medical_notes} onChange={e=>setForm({...form,medical_notes:e.target.value})}/></label>
        <label className="full-field">Emergency notes<textarea rows={2} maxLength={1000} value={form.emergency_notes} onChange={e=>setForm({...form,emergency_notes:e.target.value})}/></label>
      </div><div className="form-actions"><button className="action" disabled={saving}>{saving?"Saving…":"Save dog profile"}</button></div></>}
    </form>}
    <section className="panel"><div className="customer-toolbar"><div className="panel-title">{dogs.length} dog{dogs.length===1?"":"s"}</div><div className="search-box"><Search size={15}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search dog or owner"/></div></div>
      {loading?<div className="empty">Loading dogs…</div>:filtered.length===0?<div className="empty"><DogIcon size={24}/><strong>{dogs.length?"No matching dogs":"No dogs registered yet"}</strong>{dogs.length?"Try another search.":"Register a customer’s dog to get started."}</div>:<div className="table-wrap"><table className="data-table"><thead><tr><th>Dog</th><th>Breed</th><th>Age</th><th>Size</th><th>Customer</th><th>Phone</th></tr></thead><tbody>{filtered.map(d=><tr key={d.id}><td><Link href={`/dogs/${d.id}`} className="table-link"><strong>{d.name}</strong></Link></td><td>{d.breed||"—"}</td><td>{d.age_text||"—"}</td><td>{d.size||"—"}</td><td>{d.customer_name}</td><td>{d.customer_phone}</td></tr>)}</tbody></table></div>}
    </section>
  </main>;
}