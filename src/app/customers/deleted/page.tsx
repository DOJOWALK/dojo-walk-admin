"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, History } from "lucide-react";

type DeletedCustomer = {id:string;customer_name:string;dog_names:string;reason:string;deleted_at:string};

export default function DeletedCustomersPage() {
  const [records,setRecords]=useState<DeletedCustomer[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  useEffect(()=>{(async()=>{
    try{
      const response=await fetch("/api/customers?view=deleted");
      if(response.status===401){window.location.assign("/login");return;}
      const data=await response.json();
      if(!response.ok)throw new Error(data.error||"Delete history could not be loaded.");
      setRecords(data.records||[]);
    }catch(e){setError(e instanceof Error?e.message:"Delete history could not be loaded.");}
    finally{setLoading(false);}
  })();},[]);
  const date=(value:string)=>value?new Date(value.replace(" ","T")+"Z").toLocaleString("en-IN",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"}):"—";
  return <main className="main">
    <Link href="/customers" className="back-link"><ArrowLeft size={15}/> Back to customers</Link>
    <div className="eyebrow">Customer management</div><h1 className="page-title">Delete history</h1>
    <p className="subtle">Permanent customer deletion records.</p>
    {error&&<div className="error-box">{error}</div>}
    <section className="panel">
      {loading?<div className="empty">Loading delete history…</div>:records.length===0?<div className="empty"><History size={24}/><strong>No deleted customers</strong><span>Deleted customer records will appear here.</span></div>:
      <div className="payment-history-list">{records.map(record=><div className="payment-history-row" key={record.id}><div><strong>{record.customer_name}</strong><span>Dog(s): {record.dog_names}</span><span>Reason: {record.reason}</span><span>Deleted: {date(record.deleted_at)}</span></div><span className="record-status status-inactive">Permanently deleted</span></div>)}</div>}
    </section>
  </main>;
}
