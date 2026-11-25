"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, UserRound, Phone, MapPin, PawPrint, CalendarDays, ReceiptText, Wallet, Pencil, Plus } from "lucide-react";

type R = Record<string, any>;
type CustomerForm = {full_name:string;phone:string;whatsapp_phone:string;flat_tower:string;society:string;locality:string;city:string;state:string;pincode:string;notes:string};
type DogForm = {name:string;breed:string;age_text:string;size:string;gender:string;temperament:string;medical_notes:string;emergency_notes:string};
const emptyDog:DogForm={name:"",breed:"",age_text:"",size:"",gender:"",temperament:"",medical_notes:"",emergency_notes:""};

export default function CustomerDetail() {
  const { id } = useParams<{ id: string }>();
  const [customer, setCustomer] = useState<R | null>(null);
  const [dogs, setDogs] = useState<R[]>([]);
  const [bookings, setBookings] = useState<R[]>([]);
  const [payments, setPayments] = useState<R[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingCustomer,setEditingCustomer]=useState(false);
  const [savingCustomer,setSavingCustomer]=useState(false);
  const [customerForm,setCustomerForm]=useState<CustomerForm>({full_name:"",phone:"",whatsapp_phone:"",flat_tower:"",society:"",locality:"",city:"Greater Noida West",state:"Uttar Pradesh",pincode:"",notes:""});
  const [editingDog,setEditingDog]=useState<string|null>(null);
  const [dogForm,setDogForm]=useState<DogForm>(emptyDog);
  const [addingDog,setAddingDog]=useState(false);
  const [savingDog,setSavingDog]=useState(false);
  const [error,setError]=useState("");
  const [success,setSuccess]=useState("");
  const money = (v: any) => "₹" + Number(v || 0).toLocaleString("en-IN");
  const date = (v: string) => v ? new Date(v + "T00:00:00").toLocaleDateString("en-IN", {day:"2-digit",month:"short",year:"numeric"}) : "—";

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
      if(owner) setCustomerForm({full_name:owner.full_name||"",phone:owner.phone||"",whatsapp_phone:owner.whatsapp_phone||"",flat_tower:owner.flat_tower||"",society:owner.society||"",locality:owner.locality||"",city:owner.city||"Greater Noida West",state:owner.state||"Uttar Pradesh",pincode:owner.pincode||"",notes:owner.notes||""});
    } catch { setError("Customer profile could not be loaded."); }
    finally { setLoading(false); }
  }

  useEffect(() => { void loadProfile(); }, [id]);

  async function saveCustomer(e:FormEvent<HTMLFormElement>){
    e.preventDefault();setSavingCustomer(true);setError("");setSuccess("");
    try{
      const r=await fetch("/api/customers",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({id,...customerForm})});
      const j=await r.json();if(!r.ok)throw new Error(j.error||"Customer details could not be saved.");
      setEditingCustomer(false);setSuccess("Customer mobile number and address updated.");await loadProfile();
    }catch(e){setError(e instanceof Error?e.message:"Could not save customer.");}
    finally{setSavingCustomer(false);}
  }

  function startDogEdit(d:R){setEditingDog(d.id);setAddingDog(false);setDogForm({name:d.name||"",breed:d.breed||"",age_text:d.age_text||"",size:d.size||"",gender:d.gender||"",temperament:d.temperament||"",medical_notes:d.medical_notes||"",emergency_notes:d.emergency_notes||""});}
  async function saveDog(e:FormEvent<HTMLFormElement>){
    e.preventDefault();setSavingDog(true);setError("");setSuccess("");
    try{
      const r=await fetch("/api/dogs",{method:addingDog?"POST":"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(addingDog?{customer_id:id,...dogForm}:{id:editingDog,customer_id:id,...dogForm})});
      const j=await r.json();if(!r.ok)throw new Error(j.error||"Dog details could not be saved.");
      setEditingDog(null);setAddingDog(false);setDogForm(emptyDog);setSuccess(addingDog?"Dog added to this customer.":"Dog profile updated.");await loadProfile();
    }catch(e){setError(e instanceof Error?e.message:"Could not save dog.");}
    finally{setSavingDog(false);}
  }

  const totalDue = bookings.reduce((sum, b) => sum + Number(b.due_inr || 0), 0);
  const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount_inr || 0), 0);
  if (loading) return <main className="main"><Link href="/customers" className="back-link"><ArrowLeft size={15}/> Customers</Link><section className="panel">Loading customer profile…</section></main>;
  if (!customer) return <main className="main"><Link href="/customers" className="back-link"><ArrowLeft size={15}/> Customers</Link><section className="panel"><h1 className="panel-title">Customer not found</h1><p className="panel-note">This customer may have been removed or the link may be incorrect.</p></section></main>;
  const address = [customer.flat_tower, customer.society, customer.locality, customer.city, customer.state, customer.pincode].filter(Boolean).join(", ") || [customer.address, customer.area].filter(Boolean).join(", ") || "Address not added";
  const field=(label:string,key:keyof CustomerForm,placeholder:string="")=><label>{label}<input value={customerForm[key]} onChange={e=>setCustomerForm({...customerForm,[key]:e.target.value})} placeholder={placeholder}/></label>;
  const dogFields=<div className="form-grid">
    <label>Dog name *<input required maxLength={80} value={dogForm.name} onChange={e=>setDogForm({...dogForm,name:e.target.value})}/></label>
    <label>Breed<input value={dogForm.breed} onChange={e=>setDogForm({...dogForm,breed:e.target.value})}/></label>
    <label>Age range / age<input value={dogForm.age_text} onChange={e=>setDogForm({...dogForm,age_text:e.target.value})}/></label>
    <label>Size<select value={dogForm.size} onChange={e=>setDogForm({...dogForm,size:e.target.value})}><option value="">Select size</option>{["Small","Medium","Large","Extra Large"].map(x=><option key={x}>{x}</option>)}</select></label>
    <label>Gender<select value={dogForm.gender} onChange={e=>setDogForm({...dogForm,gender:e.target.value})}><option value="">Select gender</option><option>Male</option><option>Female</option></select></label>
    <label>Temperament<select value={dogForm.temperament} onChange={e=>setDogForm({...dogForm,temperament:e.target.value})}><option value="">Select temperament</option>{["Friendly","Shy","Energetic","Calm","Anxious","Reactive","Other"].map(x=><option key={x}>{x}</option>)}</select></label>
    <label>Medical notes<input value={dogForm.medical_notes} onChange={e=>setDogForm({...dogForm,medical_notes:e.target.value})}/></label>
    <label>Emergency notes<input value={dogForm.emergency_notes} onChange={e=>setDogForm({...dogForm,emergency_notes:e.target.value})}/></label>
  </div>;

  return <main className="main">
    <Link href="/customers" className="back-link"><ArrowLeft size={15}/> Back to customers</Link>
    <div className="topbar"><div><div className="eyebrow">Customer profile</div><h1 className="page-title">{customer.full_name}</h1><p className="subtle">Owner details, dogs, walking bookings and payment history in one place.</p></div><Link className="action" href="/bookings">＋ New booking</Link></div>
    {error&&<div className="error-box">{error}</div>}{success&&<div className="success-box">{success}</div>}
    <section className="booking-overview panel">
      <div className="booking-overview-head"><div><div className="eyebrow">Owner information</div><h2 className="booking-overview-title">{customer.full_name}</h2><p className="subtle">{customer.phone || "Mobile number not added"}</p></div><button className="plain-button" type="button" onClick={()=>{setEditingCustomer(!editingCustomer);setError("");}}><Pencil size={14}/> {editingCustomer?"Close edit":"Edit customer"}</button></div>
      <div className="booking-people-grid">
        <div className="booking-person"><div className="booking-avatar"><UserRound size={20}/></div><div className="booking-person-copy"><span className="booking-label">CONTACT</span><strong>{customer.phone || "—"}</strong><span className="booking-meta"><Phone size={13}/>{customer.whatsapp_phone || "WhatsApp not added"}</span></div></div>
        <div className="booking-person"><div className="booking-avatar"><MapPin size={20}/></div><div className="booking-person-copy"><span className="booking-label">ADDRESS</span><strong>{address}</strong><span className="booking-meta">Saved as separate address fields</span></div></div>
      </div>
      {editingCustomer&&<form className="customer-form" onSubmit={saveCustomer}><div className="panel-title">Edit customer details</div><div className="form-grid">
        {field("Customer name *","full_name")}{field("Mobile number *","phone","Mobile number")}{field("WhatsApp number","whatsapp_phone","If same, enter the same number")}
        {field("Flat / Tower","flat_tower")}{field("Society / Address","society")}{field("Area / Locality","locality")}{field("City *","city")}{field("State *","state")}{field("PIN code *","pincode","6-digit PIN")}
      </div><div className="form-actions"><button className="action" disabled={savingCustomer}>{savingCustomer?"Saving…":"Save customer details"}</button><button type="button" className="plain-button" onClick={()=>{setEditingCustomer(false);void loadProfile();}}>Cancel</button></div></form>}
      {customer.notes && <div className="booking-notes"><strong>Notes:</strong> {customer.notes}</div>}
    </section>
    <div className="booking-money-grid"><div className="booking-money-card"><span>Dogs</span><strong>{dogs.length}</strong></div><div className="booking-money-card"><span>Bookings</span><strong>{bookings.length}</strong></div><div className="booking-money-card received"><span>Total received</span><strong>{money(totalPaid)}</strong></div><div className="booking-money-card due"><span>Outstanding due</span><strong>{money(totalDue)}</strong></div></div>
    <section className="panel">
      <div className="panel-head"><div><div className="booking-section-heading"><PawPrint size={17}/> Dogs</div><p className="panel-note">Dogs ko isi customer profile se add aur edit karein.</p></div><button type="button" className="action" onClick={()=>{setAddingDog(true);setEditingDog(null);setDogForm(emptyDog);}}><Plus size={15}/> Add dog</button></div>
      {addingDog&&<form className="customer-form" onSubmit={saveDog}><div className="panel-title">Add a dog</div>{dogFields}<div className="form-actions"><button className="action" disabled={savingDog}>{savingDog?"Saving…":"Save dog"}</button><button type="button" className="plain-button" onClick={()=>setAddingDog(false)}>Cancel</button></div></form>}
      {dogs.length ? <div className="booking-people-grid">{dogs.map(d => <div className="booking-person" key={d.id}><div className="booking-avatar dog-avatar"><PawPrint size={20}/></div><div className="booking-person-copy"><strong>{d.name}</strong><span className="booking-meta">{[d.breed,d.age_text,d.size,d.gender].filter(Boolean).join(" · ") || "Dog details"}</span><button className="plain-button" type="button" onClick={()=>startDogEdit(d)}><Pencil size={13}/> Edit dog</button></div></div>)}</div> : <div className="booking-empty-payments"><PawPrint size={22}/><strong>No dogs added yet</strong><span>Add the customer's dog details here.</span></div>}
      {editingDog&&<form className="customer-form" onSubmit={saveDog}><div className="panel-title">Edit dog profile</div>{dogFields}<div className="form-actions"><button className="action" disabled={savingDog}>{savingDog?"Saving…":"Save dog changes"}</button><button type="button" className="plain-button" onClick={()=>setEditingDog(null)}>Cancel</button></div></form>}
    </section>
    <section className="panel"><div className="panel-head"><div><div className="booking-section-heading"><CalendarDays size={17}/> Booking history</div><p className="panel-note">Customer ke saare walking plans aur balances.</p></div></div>
      {bookings.length ? <div className="payment-history-list">{bookings.map(b => <Link className="payment-history-row" key={b.id} href={"/bookings/" + b.id}><div><strong>{b.dog_name} · {date(b.start_date)}</strong><span>{b.status} · {b.walk_duration_minutes} min · {b.walks_per_day} walk(s)/day</span></div><strong className="payment-amount">Due {money(b.due_inr)}</strong></Link>)}</div> : <div className="booking-empty-payments"><CalendarDays size={22}/><strong>No bookings yet</strong><span>New walking plans for this customer will appear here.</span></div>}
    </section>
    <section className="panel booking-payments"><div className="panel-head"><div><div className="booking-section-heading"><ReceiptText size={17}/> Payment history</div><p className="panel-note">Payments recorded against this customer.</p></div><span className="payment-count">{payments.length} payments</span></div>
      {payments.length ? <div className="payment-history-list">{payments.map(p => <div className="payment-history-row" key={p.id}><div><strong>{date(p.payment_date)}</strong><span>{p.payment_method || "Payment"}</span></div><strong className="payment-amount">{money(p.amount_inr)}</strong></div>)}</div> : <div className="booking-empty-payments"><Wallet size={22}/><strong>No payments recorded yet</strong><span>Payments received from this customer will appear here.</span></div>}
    </section>
  </main>;
}
