"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, UserRound, Phone, MapPin, PawPrint, CalendarDays, ReceiptText, Wallet, Pencil, Plus } from "lucide-react";

type R = Record<string, any>;
type CustomerForm = {full_name:string;phone:string;whatsapp_phone:string;same_whatsapp:boolean;flat_tower:string;society:string;locality:string;city:string;state:string;pincode:string;notes:string};
type DogForm = {name:string;breed:string;age_text:string;size:string;gender:string;temperament:string;medical_notes:string;emergency_notes:string};
const STATES = ["Andhra Pradesh","Arunachal Pradesh","Assam","Bihar","Chhattisgarh","Goa","Gujarat","Haryana","Jharkhand","Karnataka","Kerala","Madhya Pradesh","Maharashtra","Manipur","Meghalaya","Mizoram","Nagaland","Odisha","Punjab","Rajasthan","Sikkim","Tamil Nadu","Telangana","Tripura","Uttar Pradesh","Uttarakhand","West Bengal","Delhi","Chandigarh","Jammu and Kashmir","Ladakh","Puducherry"];
const LOCALITIES = ["Gaur City 1","Gaur City 2","Crossings Republik","Techzone 4","Noida Extension","Bisrakh","Char Murti","Sector 1 Greater Noida West","Sector 2 Greater Noida West","Sector 3 Greater Noida West","Sector 4 Greater Noida West","Sector 10 Greater Noida West","Other"];
const CITIES = ["Greater Noida West","Greater Noida","Noida","Ghaziabad","Dadri","Delhi","Other"];
const BREEDS = ["Indie / Indian Pariah","Labrador Retriever","Golden Retriever","German Shepherd","Beagle","Pug","Shih Tzu","Rottweiler","Siberian Husky","Boxer","Dachshund","Pomeranian","German Spitz","Cocker Spaniel","French Bulldog","Doberman","Great Dane","Chihuahua","Lhasa Apso","Other"];
const AGE_RANGES = ["Below 6 months","6–12 months","1–2 years","3–5 years","6–8 years","9–12 years","12+ years"];
const emptyDog:DogForm={name:"",breed:"",age_text:"",size:"",gender:"",temperament:"",medical_notes:"",emergency_notes:""};

export default function CustomerDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [customer, setCustomer] = useState<R | null>(null);
  const [dogs, setDogs] = useState<R[]>([]);
  const [bookings, setBookings] = useState<R[]>([]);
  const [payments, setPayments] = useState<R[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingCustomer,setEditingCustomer]=useState(false);
  const [savingCustomer,setSavingCustomer]=useState(false);
  const [customerForm,setCustomerForm]=useState<CustomerForm>({full_name:"",phone:"",whatsapp_phone:"",same_whatsapp:true,flat_tower:"",society:"",locality:"",city:"Greater Noida West",state:"Uttar Pradesh",pincode:"",notes:""});
  const [dogForm,setDogForm]=useState<DogForm>(emptyDog);
  const [addingDog,setAddingDog]=useState(false);
  const [savingDog,setSavingDog]=useState(false);
  const [error,setError]=useState("");
  const [success,setSuccess]=useState("");
  const [showDeleteConfirm,setShowDeleteConfirm]=useState(false);
  const [showBlockConfirm,setShowBlockConfirm]=useState(false);
  const [blockReason,setBlockReason]=useState("Payment pending");
  const [blockDuration,setBlockDuration]=useState("1 month");
  const [stateTarget,setStateTarget]=useState<"leave"|"blocked">("blocked");
  const [deleteReason,setDeleteReason]=useState("Customer requested deletion");
  const [adminPassword,setAdminPassword]=useState("");
  const [showAdminPassword,setShowAdminPassword]=useState(false);
  const [actionBusy,setActionBusy]=useState(false);
  const money = (v: any) => "₹" + Number(v || 0).toLocaleString("en-IN");
  const date = (v: string) => v ? new Date(v + "T12:00:00Z").toLocaleDateString("en-IN", {day:"2-digit",month:"short",year:"numeric"}) : "—";

  async function loadProfile() {
    setLoading(true);
    try {
      const responses = await Promise.all(["/api/customers","/api/dogs","/api/bookings","/api/payments"].map(url => fetch(url)));
      if (responses.some(r => r.status === 401)) { location.assign("/login"); return; }
      const data = await Promise.all(responses.map(r => r.json()));
      const owner=(data[0].customers || []).find((x: R) => x.id === id) || null;
      setCustomer(owner);
      setDogs((data[1].dogs || []).filter((x: R) => x.customer_id === id));
      setBookings((data[2].bookings || []).filter((x: R) => x.customer_id === id));
      setPayments((data[3].payments || []).filter((x: R) => x.customer_id === id));
      if(owner) setCustomerForm({full_name:owner.full_name||"",phone:owner.phone||"",whatsapp_phone:owner.whatsapp_phone||"",same_whatsapp:!owner.whatsapp_phone||owner.whatsapp_phone===owner.phone,flat_tower:owner.flat_tower||"",society:owner.society||"",locality:owner.locality||"",city:owner.city||"Greater Noida West",state:owner.state||"Uttar Pradesh",pincode:owner.pincode||"",notes:owner.notes||""});
    } catch { setError("Customer profile could not be loaded."); }
    finally { setLoading(false); }
  }

  useEffect(() => { void loadProfile(); }, [id]);

  async function changeBookingAccess(nextStatus:"active"|"leave"|"blocked") {
    setActionBusy(true); setError(""); setSuccess("");
    try {
      const r=await fetch("/api/customers",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({id,state:nextStatus,reason:blockReason,duration:blockDuration})});
      const j=await r.json(); if(!r.ok) throw new Error(j.error||"Customer status could not be changed.");
      setCustomer((current:R|null)=>current?{...current,status:nextStatus==="active"?"active":"inactive",customer_state:nextStatus,blocked_until:j.blocked_until}:current);
      setShowBlockConfirm(false); setSuccess(nextStatus==="blocked"?"Customer is blocked from new bookings.":nextStatus==="leave"?"Customer is marked as on leave.":"New bookings are enabled for this customer.");
    } catch(e) { setError(e instanceof Error?e.message:"Could not update booking access."); }
    finally { setActionBusy(false); }
  }

  async function deleteCustomer() {
    if (!adminPassword) { setError("Please enter the admin password."); return; }
    setActionBusy(true); setError("");
    try {
      const r=await fetch("/api/customers",{method:"DELETE",headers:{"Content-Type":"application/json"},body:JSON.stringify({id,password:adminPassword,reason:deleteReason})});
      const j=await r.json(); if(!r.ok) throw new Error(j.error||"Customer could not be deleted.");
      router.replace("/customers");
    } catch(e) { setError(e instanceof Error?e.message:"Customer could not be deleted."); }
    finally { setActionBusy(false); }
  }

  async function saveCustomer(e:FormEvent<HTMLFormElement>){
    e.preventDefault();setSavingCustomer(true);setError("");setSuccess("");
    try{
      const r=await fetch("/api/customers",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({id,...customerForm,whatsapp_phone:customerForm.same_whatsapp?customerForm.phone:customerForm.whatsapp_phone})});
      const j=await r.json();if(!r.ok)throw new Error(j.error||"Customer details could not be saved.");
      setEditingCustomer(false);setSuccess("Customer details updated successfully.");await loadProfile();
    }catch(e){setError(e instanceof Error?e.message:"Could not save customer.");}
    finally{setSavingCustomer(false);}
  }

  async function saveDog(e:FormEvent<HTMLFormElement>){
    e.preventDefault();setSavingDog(true);setError("");setSuccess("");
    try{
      const r=await fetch("/api/dogs",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({customer_id:id,...dogForm})});
      const j=await r.json();if(!r.ok)throw new Error(j.error||"Dog details could not be saved.");
      setAddingDog(false);setDogForm(emptyDog);setSuccess(addingDog?"Dog added to this customer.":"Dog profile updated.");await loadProfile();
    }catch(e){setError(e instanceof Error?e.message:"Could not save dog.");}
    finally{setSavingDog(false);}
  }

  if (loading) return <main className="main"><Link href="/customers" className="back-link"><ArrowLeft size={15}/> Customers</Link><section className="panel">Loading customer profile…</section></main>;
  if (!customer) return <main className="main"><Link href="/customers" className="back-link"><ArrowLeft size={15}/> Customers</Link><section className="panel"><h1 className="panel-title">Customer not found</h1><p className="panel-note">This customer may have been removed or the link may be incorrect.</p></section></main>;
  const address = [customer.flat_tower, customer.society, customer.locality, customer.city, customer.state, customer.pincode].filter(Boolean).join(", ") || [customer.address, customer.area].filter(Boolean).join(", ") || "Address not added";
  const field=(label:string,key:"full_name"|"phone"|"flat_tower"|"society"|"pincode",placeholder:string="")=><label>{label}<input value={customerForm[key]} onChange={e=>setCustomerForm({...customerForm,[key]:e.target.value,...(key==="phone"&&customerForm.same_whatsapp?{whatsapp_phone:e.target.value}:{})})} placeholder={placeholder}/></label>;
  const selectField=(label:string,key:"locality"|"city"|"state",options:string[])=>{const current=customerForm[key];const list=current&&!options.includes(current)?[current,...options]:options;return <label>{label}<select value={current} onChange={e=>setCustomerForm({...customerForm,[key]:e.target.value})}><option value="">Select {label.toLowerCase()}</option>{list.map(x=><option key={x} value={x}>{x}</option>)}</select></label>;};
  const dogFields=<div className="form-grid">
    <label>Dog name *<input required maxLength={80} value={dogForm.name} onChange={e=>setDogForm({...dogForm,name:e.target.value})}/></label>
    <label>Breed<select value={dogForm.breed} onChange={e=>setDogForm({...dogForm,breed:e.target.value})}><option value="">Select breed</option>{(dogForm.breed&&!BREEDS.includes(dogForm.breed)?[dogForm.breed,...BREEDS]:BREEDS).map(x=><option key={x} value={x}>{x}</option>)}</select></label>
    <label>Age range / age<select value={dogForm.age_text} onChange={e=>setDogForm({...dogForm,age_text:e.target.value})}><option value="">Select age range</option>{(dogForm.age_text&&!AGE_RANGES.includes(dogForm.age_text)?[dogForm.age_text,...AGE_RANGES]:AGE_RANGES).map(x=><option key={x} value={x}>{x}</option>)}</select></label>
    <label>Size<select value={dogForm.size} onChange={e=>setDogForm({...dogForm,size:e.target.value})}><option value="">Select size</option>{["Small","Medium","Large","Extra Large"].map(x=><option key={x}>{x}</option>)}</select></label>
    <label>Gender<select value={dogForm.gender} onChange={e=>setDogForm({...dogForm,gender:e.target.value})}><option value="">Select gender</option><option>Male</option><option>Female</option></select></label>
    <label>Temperament<select value={dogForm.temperament} onChange={e=>setDogForm({...dogForm,temperament:e.target.value})}><option value="">Select temperament</option>{["Friendly","Shy","Energetic","Calm","Anxious","Reactive","Other"].map(x=><option key={x}>{x}</option>)}</select></label>
    <label>Medical notes<input value={dogForm.medical_notes} onChange={e=>setDogForm({...dogForm,medical_notes:e.target.value})}/></label>
    <label>Emergency notes<input value={dogForm.emergency_notes} onChange={e=>setDogForm({...dogForm,emergency_notes:e.target.value})}/></label>
  </div>;

  return <main className="main">
    <Link href="/customers" className="back-link"><ArrowLeft size={15}/> Back to customers</Link>
    <div className="customer-profile-header" style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:18,flexWrap:"wrap",marginBottom:18}}>
      <div style={{minWidth:220,flex:"1 1 280px"}}>
        <h1 className="page-title" style={{marginBottom:5}}>{customer.full_name}</h1>
        <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",marginBottom:6}}>
          <span className="record-status" style={{background:(customer.customer_state||"active")==="active"?"#eaf6ed":(customer.customer_state==="leave"?"#fff3df":"#fdebea"),color:(customer.customer_state||"active")==="active"?"#27834d":(customer.customer_state==="leave"?"#a66a16":"#b83b32")}}>{(customer.customer_state||"active")==="active"?"Active":customer.customer_state==="leave"?"Leave":"Blocked"}</span>
          <span className="eyebrow">Customer Profile</span>
        </div>
        <p className="subtle">Customer contact, address and records</p>
      </div>
      <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:8,flex:"0 1 auto"}}>
        <div style={{display:"flex",justifyContent:"flex-end",gap:6,flexWrap:"wrap"}}>
          <button type="button" className="plain-button" style={{color:"#b83b32",borderColor:"#f1c7c3",padding:"7px 10px",fontSize:11}} disabled={actionBusy} onClick={()=>customer.customer_state==="blocked"?void changeBookingAccess("active"):(setStateTarget("blocked"),setShowBlockConfirm(true))}>{customer.customer_state==="blocked"?"Unblock":"Block"}</button>
          <button type="button" className="plain-button" style={{color:"#a66a16",borderColor:"#f3dfbd",padding:"7px 10px",fontSize:11}} disabled={actionBusy} onClick={()=>{setStateTarget("leave");setShowBlockConfirm(true);}}>Leave</button>
          <button type="button" className="plain-button" style={{color:"#fff",background:"#a52b2b",borderColor:"#a52b2b",padding:"7px 10px",fontSize:11}} onClick={()=>{setShowDeleteConfirm(true);setAdminPassword("");}}>Delete customer</button>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:9,padding:"7px 10px",border:"1px solid var(--line)",borderRadius:10,background:"#fff"}}>
          <span style={{fontSize:11,fontWeight:700,color:"var(--ink)"}}>Booking access</span>
          <span className="record-status" style={{background:customer.status==="inactive"?"#fdebea":"#eaf6ed",color:customer.status==="inactive"?"#b83b32":"#27834d"}}>{customer.status==="inactive"?"OFF":"ON"}</span>
        </div>
      </div>
    </div>
    {error&&<div className="error-box">{error}</div>}{success&&<div className="success-box">{success}</div>}
    {(showBlockConfirm||showDeleteConfirm)&&<section className="panel" style={{marginBottom:18}}>
      {showBlockConfirm&&<div className="booking-notes">
        <strong>{stateTarget==="leave"?"Mark "+customer.full_name+" on leave?":"Block "+customer.full_name+"?"}</strong>
        <label>Reason<select value={blockReason} onChange={e=>setBlockReason(e.target.value)}><option>Payment pending</option><option>Customer request</option><option>Misbehaviour</option><option>Repeated cancellations</option><option>Other</option></select></label>
        <label>Duration<select value={blockDuration} onChange={e=>setBlockDuration(e.target.value)}><option>7 days</option><option>15 days</option><option>1 month</option><option>3 months</option><option>6 months</option><option>Permanent</option></select></label>
        <div className="form-actions"><button type="button" className="action" disabled={actionBusy} onClick={()=>void changeBookingAccess(stateTarget)}>Confirm {stateTarget==="leave"?"leave":"block"}</button><button type="button" className="plain-button" onClick={()=>setShowBlockConfirm(false)}>Cancel</button></div>
      </div>}
      {showDeleteConfirm&&<div className="booking-notes">
        <strong>Confirm permanent deletion</strong>
        <p>This removes the customer, dogs, bookings, walks and payment records. This cannot be undone.</p>
        <strong>Customer: {customer.full_name}</strong>
        <div>Dogs: {dogs.length?dogs.map(d=>d.name).join(", "):"No dogs registered"}</div>
        <label>Delete reason<select value={deleteReason} onChange={e=>setDeleteReason(e.target.value)}><option>Customer requested deletion</option><option>Duplicate customer</option><option>No longer using service</option><option>Other</option></select></label>
        <label>Admin password<input type={showAdminPassword?"text":"password"} autoComplete="current-password" value={adminPassword} onChange={e=>setAdminPassword(e.target.value)} placeholder="Enter admin password"/></label>
        <div className="form-actions"><button type="button" className="plain-button" onClick={()=>setShowAdminPassword(!showAdminPassword)}>{showAdminPassword?"Hide password":"Show password"}</button><button type="button" className="action" disabled={actionBusy||!adminPassword} onClick={()=>void deleteCustomer()}>{actionBusy?"Deleting…":"Confirm permanent delete"}</button><button type="button" className="plain-button" onClick={()=>{setShowDeleteConfirm(false);setAdminPassword("");}}>Cancel</button></div>
      </div>}
    </section>}
    <section className="booking-overview panel">
      <div className="booking-overview-head"><div><div className="eyebrow">Owner information</div><h2 className="booking-overview-title">{customer.full_name}</h2><p className="subtle">{customer.phone || "Mobile number not added"}</p></div><button className="action" type="button" onClick={()=>{setEditingCustomer(!editingCustomer);setError("");}}><Pencil size={14}/> {editingCustomer?"Close edit":"Edit customer"}</button></div>
      <div className="booking-people-grid">
        <div className="booking-person"><div className="booking-avatar"><UserRound size={20}/></div><div className="booking-person-copy"><span className="booking-label">CONTACT</span><strong>{customer.phone || "—"}</strong><span className="booking-meta"><Phone size={13}/>{customer.whatsapp_phone || "WhatsApp not added"}</span></div></div>
        <div className="booking-person"><div className="booking-avatar"><MapPin size={20}/></div><div className="booking-person-copy"><span className="booking-label">ADDRESS</span><strong>{address}</strong></div></div>
      </div>
      {editingCustomer&&<form className="customer-form" onSubmit={saveCustomer}><div className="panel-title">Edit customer details</div><div className="form-grid">
        {field("Customer name *","full_name")}{field("Mobile number *","phone","Mobile number")}<div className="full-field"><label>WhatsApp number<input value={customerForm.same_whatsapp?customerForm.phone:customerForm.whatsapp_phone} disabled={customerForm.same_whatsapp} onChange={e=>setCustomerForm({...customerForm,whatsapp_phone:e.target.value})} placeholder="WhatsApp number"/></label><label className="checkbox-label" style={{display:"flex",alignItems:"center",gap:8,marginTop:8}}><input type="checkbox" checked={customerForm.same_whatsapp} onChange={e=>setCustomerForm({...customerForm,same_whatsapp:e.target.checked,whatsapp_phone:e.target.checked?customerForm.phone:customerForm.whatsapp_phone})}/> WhatsApp number is same as mobile number</label></div>
        {field("Flat / Tower","flat_tower")}{field("Society / Address","society")}{selectField("Area / Locality","locality",LOCALITIES)}{selectField("City *","city",CITIES)}{selectField("State *","state",STATES)}{field("PIN code *","pincode","6-digit PIN")}
      </div><div className="form-actions"><button className="action" disabled={savingCustomer}>{savingCustomer?"Saving…":"Save customer details"}</button><button type="button" className="plain-button" onClick={()=>{setEditingCustomer(false);void loadProfile();}}>Cancel</button></div></form>}
      {customer.notes && <div className="booking-notes"><strong>Notes:</strong> {customer.notes}</div>}
    </section>
    
    <section className="panel">
      <div className="panel-head"><div><div className="booking-section-heading"><PawPrint size={17}/> Dogs</div></div><button type="button" className="action" onClick={()=>{setAddingDog(true);setDogForm(emptyDog);}}><Plus size={15}/> Add dog</button></div>
      {addingDog&&<form className="customer-form" onSubmit={saveDog}><div className="panel-title">Add a dog</div>{dogFields}<div className="form-actions"><button className="action" disabled={savingDog}>{savingDog?"Saving…":"Save dog"}</button><button type="button" className="plain-button" onClick={()=>setAddingDog(false)}>Cancel</button></div></form>}
      {dogs.length ? <div className="booking-people-grid">{dogs.map(d => <div className="booking-person" key={d.id}><div className="booking-avatar dog-avatar"><PawPrint size={20}/></div><div className="booking-person-copy"><strong>{d.name}</strong><span className="booking-meta">{[d.breed,d.age_text,d.size,d.gender].filter(Boolean).join(" · ") || "Dog details"}</span><Link className="booking-profile-link" href={"/dogs/"+d.id}>View dog profile →</Link></div></div>)}</div> : <div className="booking-empty-payments"><PawPrint size={22}/><strong>No dogs added yet</strong><span>Add a dog to this customer.</span></div>}

    </section>
    <section className="panel"><div className="panel-head"><div><div className="booking-section-heading"><CalendarDays size={17}/> Booking history</div></div></div>
      {bookings.length ? <div className="payment-history-list">{bookings.map(b => <Link className="payment-history-row" key={b.id} href={"/bookings/" + b.id}><div><strong>{b.dog_name} · {date(b.start_date)}</strong><span>{b.status} · {b.walk_duration_minutes} min · {b.walks_per_day} walk(s)/day</span></div><strong className="payment-amount">Due {money(b.due_inr)}</strong></Link>)}</div> : <div className="booking-empty-payments"><CalendarDays size={22}/><strong>No bookings yet</strong><span>New walking plans for this customer will appear here.</span></div>}
    </section>
    <section className="panel booking-payments"><div className="panel-head"><div><div className="booking-section-heading"><ReceiptText size={17}/> Payment history</div></div><span className="payment-count">{payments.length} payments</span></div>
      {payments.length ? <div className="payment-history-list">{payments.map(p => <div className="payment-history-row" key={p.id}><div><strong>{date(p.payment_date)}</strong><span>{p.payment_method || "Payment"}</span></div><strong className="payment-amount">{money(p.amount_inr)}</strong></div>)}</div> : <div className="booking-empty-payments"><Wallet size={22}/><strong>No payments recorded yet</strong><span>Payments received from this customer will appear here.</span></div>}
    </section>
  </main>;
}
