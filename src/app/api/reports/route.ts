import { NextRequest,NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getAdminCookieName,verifyAdminSession } from "@/lib/auth";
type Statement={bind(...values:unknown[]):Statement;all():Promise<{results?:unknown[]}>};
type DBLike={prepare(sql:string):Statement};
type Env={DB:DBLike;SESSION_SECRET?:string};
async function adminEnv(){const {env}=getCloudflareContext();const runtime=env as unknown as Env;const jar=await cookies();return await verifyAdminSession(jar.get(getAdminCookieName())?.value,runtime.SESSION_SECRET)?runtime:null;}
function validDate(v:string){if(!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(v))return false;const d=new Date(v+"T00:00:00Z");return !Number.isNaN(d.getTime())&&d.toISOString().slice(0,10)===v;}
export async function GET(request:NextRequest){const env=await adminEnv();if(!env)return NextResponse.json({error:"Unauthorized"},{status:401});
 const now=new Date();const today=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Kolkata"}).format(now);const defaultFrom=today.slice(0,7)+"-01";const from=request.nextUrl.searchParams.get("from")||defaultFrom;const to=request.nextUrl.searchParams.get("to")||today;
 if(!validDate(from)||!validDate(to)||from>to)return NextResponse.json({error:"Choose a valid date range."},{status:400});
 try{
  const [payments,expenses,walks,bookings,dues,earned]=await Promise.all([
   env.DB.prepare("SELECT COALESCE(SUM(amount_inr),0) AS total,COUNT(*) AS count FROM payments WHERE payment_date BETWEEN ? AND ?").bind(from,to).all(),
   env.DB.prepare("SELECT COALESCE(SUM(amount_inr),0) AS total,COUNT(*) AS count FROM expenses WHERE expense_date BETWEEN ? AND ?").bind(from,to).all(),
   env.DB.prepare("SELECT COUNT(*) AS total,SUM(CASE WHEN w.status='completed' THEN 1 ELSE 0 END) AS completed,SUM(CASE WHEN w.status='missed' THEN 1 ELSE 0 END) AS missed,SUM(CASE WHEN w.status='completed' AND b.price_per_walk_inr>0 AND w.walk_date>=COALESCE(b.billing_start_date,b.start_date) THEN 1 ELSE 0 END) AS billable_completed FROM walks w JOIN bookings b ON b.id=w.booking_id WHERE w.walk_date BETWEEN ? AND ?").bind(from,to).all(),
   env.DB.prepare("SELECT COUNT(*) AS total FROM bookings WHERE start_date BETWEEN ? AND ?").bind(from,to).all(),
   env.DB.prepare("SELECT COALESCE(SUM(MAX(x.accrued-x.paid,0)),0) AS total FROM (SELECT b.id,COALESCE((SELECT COUNT(*) FROM walks w WHERE w.booking_id=b.id AND w.status='completed' AND w.walk_date>=COALESCE(b.billing_start_date,b.start_date)),0)*b.price_per_walk_inr AS accrued,COALESCE((SELECT SUM(p.amount_inr) FROM payments p WHERE p.booking_id=b.id AND p.payment_date>=COALESCE(b.billing_start_date,b.start_date)),0) AS paid FROM bookings b WHERE b.status!='cancelled') x").all(),
   env.DB.prepare("SELECT COALESCE(SUM(b.price_per_walk_inr),0) AS total FROM walks w JOIN bookings b ON b.id=w.booking_id WHERE w.walk_date BETWEEN ? AND ? AND w.status='completed' AND w.walk_date>=COALESCE(b.billing_start_date,b.start_date)").bind(from,to).all()
  ]);
  const p=(payments.results?.[0]||{}) as {total?:number;count?:number};const e=(expenses.results?.[0]||{}) as {total?:number;count?:number};const w=(walks.results?.[0]||{}) as {total?:number;completed?:number;missed?:number;billable_completed?:number};const b=(bookings.results?.[0]||{}) as {total?:number};const d=(dues.results?.[0]||{}) as {total?:number};const earn=(earned.results?.[0]||{}) as {total?:number};
  return NextResponse.json({from,to,received:Number(p.total||0),payment_count:Number(p.count||0),expenses:Number(e.total||0),expense_count:Number(e.count||0),net_cash_flow:Number(p.total||0)-Number(e.total||0),walks_total:Number(w.total||0),walks_completed:Number(w.completed||0),walks_missed:Number(w.missed||0),new_bookings:Number(b.total||0),pending_dues:Number(d.total||0),earned:Number(earn.total||0),walker_payout_estimate:Number(w.billable_completed||0)*50,operating_cost_estimate:Number(w.billable_completed||0)*5,owner_margin_estimate:Number(w.billable_completed||0)*10});
 }catch{return NextResponse.json({error:"Reports could not be prepared. Apply migration 0004 and check D1 setup."},{status:503});}}
