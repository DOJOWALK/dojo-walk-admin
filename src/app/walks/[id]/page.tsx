"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Pencil, UserRoundPlus, CalendarDays, Clock3, Dog, UserRound, ReceiptText, Save, X } from "lucide-react";

type Walk=Record<string,any>;
type Walker={id:string;walker_code:string;full_name:string};
const STATUSES=[{value:"scheduled",label:"Scheduled"},{value:"in_progress",label:"In Progress"},{value:"completed",label:"Completed"},{value:"missed",label:"Missed"},{value:"cancelled",label:"Cancelled"}];
const dateLabel=(v:string)=>v?new Date(v+"T12:00:00Z").toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"}):"—";
const money=(v:any)=>"₹"+Number(v||0).toLocaleString("en-IN");

export default function WalkDetailPage(){
 const {id}=useParams<{id:string}>();
 const [walk,setWalk]=useState<Walk|null>(null),[walkers,setWalkers]=useState<Walker[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(""),[busy,setBusy]=useState(false),[editing,setEditing]=useState(false),[edit,setEdit]=useState({walk_date:"",scheduled_time:"",duration_minutes:"30"}),[walkerChoice,setWalkerChoice]=useState("");
 async function load(){
  setLoading(true);setError("");
  try{const r=await fetch("/api/walks/"+encodeURIComponent(id));if(r.status===401){location.assign("/login");return;}const j=await r.json();if(!r.ok)throw new Error(j.error||"Walk details could not be loaded.");setWalk(j.walk);setWalkers(j.walkers||[]);setWalkerChoice(j.walk.assigned_walker_id||"");setEdit({walk_date:j.walk.walk_date||"",scheduled_time:j.walk.scheduled_time||"",duration_minutes:String(j.walk.duration_minutes||30)});}
  catch(e){setError(e instanceof Error?e.message:"Could not load walk.");}finally{setLoading(false);}
 }
 useEffect(()=>{void load();},[id]);
 async function patch(body:Record<string,any>){
  setBusy(true);setError("");
  try{const r=await fetch("/api/walks",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({id,...body})});const j=await r.json();if(!r.ok)throw new Error(j.error||"Could not save changes.");await load();return true;}
  catch(e){setError(e instanceof Error?e.message:"Could not save changes.");return false;}finally{setBusy(false);}
 }
 async function saveEdit(){if(!edit.walk_date||!/^([01]\d|2[0-3]):[0-5]\d$/.test(edit.scheduled_time)||!Number.isInteger(Number(edit.duration_minutes))||Number(edit.duration_minutes)<1){setError("Date, time और valid duration भरें.");return;}if(!window.confirm("Save these walk changes?"))return;if(await patch({action:"edit",...edit,duration_minutes:Number(edit.duration_minutes)}))setEditing(false);}
 async function changeWalker(value:string){setWalkerChoice(value);if(!value){setError("Walker चुनना जरूरी है।");return;}await patch({action:"assign",walker_id:value});}
 async function updateStatus(value:string){if(value==="cancelled"&&!window.confirm("क्या इस walk को cancel करना है?"))return;await patch({status:value});}
 if(loading)return <main className="main"><div className="empty">Loading walk details…</div></main>;
 if(!walk)return <main className="main"><div className="error-box">{error||"Walk not found."}</div><Link className="action" href="/schedule">Back to Walk Schedule</Link></main>;
 const statusLabel=(STATUSES.find(s=>s.value===walk.status)?.label)||String(walk.status||"Scheduled");
 return <main className="main" style={{maxWidth:1100}}>
  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,marginBottom:18}}>
   <div style={{display:"flex",alignItems:"center",gap:12}}><Link href="/schedule" aria-label="Back to Walk Schedule" style={{width:38,height:38,border:"1px solid #eee7e1",borderRadius:11,display:"grid",placeItems:"center",background:"#fff"}}><ArrowLeft size={17}/></Link><div><div className="eyebrow">Walk ID: {walk.id}</div><h1 className="page-title" style={{margin:"4px 0 0"}}>Walk Details</h1></div></div>
   <button className="action" onClick={()=>setEditing(v=>!v)} disabled={busy}><Pencil size={14}/>{editing?"Close Edit":"Edit"}</button>
  </div>
  {error&&<div className="error-box" style={{marginBottom:14}}>{error}</div>}
  {editing&&<section className="panel" style={{padding:18,marginBottom:16}}><div className="panel-title" style={{marginBottom:13}}>Edit Walk</div><div className="form-grid"><label className="field"><span>Walk Date</span><input type="date" value={edit.walk_date} onChange={e=>setEdit(v=>({...v,walk_date:e.target.value}))}/></label><label className="field"><span>Scheduled Time</span><input type="time" value={edit.scheduled_time} onChange={e=>setEdit(v=>({...v,scheduled_time:e.target.value}))}/></label><label className="field"><span>Duration (minutes)</span><input type="number" min="1" max="480" value={edit.duration_minutes} onChange={e=>setEdit(v=>({...v,duration_minutes:e.target.value}))}/></label></div><div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:14}}><button className="action" onClick={()=>setEditing(false)}><X size={14}/>Cancel</button><button className="primary" onClick={()=>void saveEdit()} disabled={busy}><Save size={14}/>Save Changes</button></div></section>}
  <section className="panel" style={{padding:18,marginBottom:16}}>
   <div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:12}}>
    <div style={{border:"1px solid #eee7e1",borderRadius:12,padding:13,minWidth:0}}><div className="field-label" style={{marginBottom:8,fontSize:11,fontWeight:800}}>Walker Assignment</div><div style={{fontSize:13,fontWeight:800,marginBottom:9}}>{walk.walker_name||"Not Assigned"}</div><select aria-label="Assign or change walker" value={walkerChoice} disabled={busy} onChange={e=>void changeWalker(e.target.value)} style={{width:"100%",border:"1px solid #e0e9e2",borderRadius:9,padding:"10px",background:"#fff",fontSize:12}}><option value="" disabled>{walk.assigned_walker_id?"Choose another walker":"Assign to Walker"}</option>{walkers.map(w=><option key={w.id} value={w.id}>{w.full_name} · {w.walker_code}</option>)}</select><div style={{fontSize:10,color:"#77716c",marginTop:6}}>{walk.assigned_walker_id?"Choose another active walker to change assignment.":"Select an active walker to assign this walk."}</div></div>
    <div style={{border:"1px solid #eee7e1",borderRadius:12,padding:13,minWidth:0}}><div style={{fontSize:11,fontWeight:800,marginBottom:8}}>Walk Status</div><select aria-label="Update walk status" value={walk.status==="in_progress"?"in_progress":walk.status} disabled={busy} onChange={e=>void updateStatus(e.target.value)} style={{width:"100%",border:"1px solid #e0e9e2",borderRadius:9,padding:"10px",background:"#fff",fontSize:12}}>{STATUSES.map(s=><option key={s.value} value={s.value}>{s.label}</option>)}</select><div style={{fontSize:10,color:"#77716c",marginTop:6}}>Current status: {statusLabel}</div></div>
   </div>
  </section>
  <section className="panel" style={{padding:18,marginBottom:16}}>
   <div style={{display:"flex",alignItems:"center",gap:13,marginBottom:15}}><div className="booking-avatar dog-avatar"><Dog size={20}/></div><div style={{minWidth:0}}><div className="panel-title">{walk.dog_name}</div><div className="panel-note">{walk.breed||"Dog"}</div></div><div style={{marginLeft:"auto",textAlign:"right"}}><div style={{fontSize:12,fontWeight:800}}>{walk.customer_name}</div><div className="panel-note">Customer ID: {walk.customer_id}</div></div></div>
   <div className="booking-facts-grid"><div className="booking-fact"><span>Date</span><strong>{dateLabel(walk.walk_date)}</strong></div><div className="booking-fact"><span>Time</span><strong>{walk.scheduled_time||walk.slot||"—"}</strong></div><div className="booking-fact"><span>Duration</span><strong>{walk.duration_minutes} min</strong></div><div className="booking-fact"><span>Walk Amount</span><strong>{money(walk.price_per_walk_inr)}</strong></div></div>
  </section>
  <section className="panel" style={{padding:18,marginBottom:16}}><div className="panel-title" style={{marginBottom:13}}>Booking Information</div><div className="booking-facts-grid"><div className="booking-fact"><span>Booking ID</span><strong>{walk.booking_id}</strong></div><div className="booking-fact"><span>Walk ID</span><strong>{walk.id}</strong></div><div className="booking-fact"><span>Customer ID</span><strong>{walk.customer_id}</strong></div></div></section>
  <section className="panel" style={{padding:18}}><div className="panel-title" style={{marginBottom:13}}>Customer & Dog Details</div><div className="booking-facts-grid"><div className="booking-fact"><span>Customer Name</span><strong>{walk.customer_name}</strong></div><div className="booking-fact"><span>Customer Phone</span><strong>{walk.whatsapp_phone||walk.customer_phone||"—"}</strong></div><div className="booking-fact"><span>Dog Name</span><strong>{walk.dog_name}</strong></div><div className="booking-fact"><span>Breed</span><strong>{walk.breed||"—"}</strong></div></div></section>
  <section className="panel" style={{padding:18,marginTop:16}}><div className="panel-title" style={{marginBottom:13}}>Payment Information</div><div className="booking-facts-grid"><div className="booking-fact"><span>Walk Amount</span><strong>{money(walk.price_per_walk_inr)}</strong></div><div className="booking-fact"><span>Billing Rule</span><strong>Completed walks only</strong></div></div></section>
 </main>;
}
