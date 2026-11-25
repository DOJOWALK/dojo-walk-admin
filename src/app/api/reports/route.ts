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
  const [payments,expenses,walks,bookings,dues]=await Promise.all([
   env.DB.prepare("SELECT COALESCE(SUM(amount_inr),0) AS total,COUNT(*) AS count FROM payments WHERE payment_date BETWEEN ? AND ?").bind(from,to).all(),
   env.DB.prepare("SELECT COALESCE(SUM(amount_inr),0) AS total,COUNT(*) AS count FROM expenses WHERE expense_date BETWEEN ? AND ?").bind(from,to).all(),
   env.DB.prepare("SELECT COUNT(*) AS total,SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END) AS completed,SUM(CASE WHEN status='missed' THEN 1 ELSE 0 END) AS missed FROM walks WHERE walk_date BETWEEN ? AND ?").bind(from,to).all(),
   env.DB.prepare("SELECT COUNT(*) AS total FROM bookings WHERE start_date BETWEEN ? AND ?").bind(from,to).all(),
   env.DB.prepare("SELECT COALESCE(SUM(MAX(price_inr-advance_received_inr,0)),0) AS total FROM bookings WHERE status IN ('active','paused')").all()
  ]);
  const p=(payments.results?.[0]||{}) as {total?:number;count?:number};const e=(expenses.results?.[0]||{}) as {total?:number;count?:number};const w=(walks.results?.[0]||{}) as {total?:number;completed?:number;missed?:number};const b=(bookings.results?.[0]||{}) as {total?:number};const d=(dues.results?.[0]||{}) as {total?:number};
  return NextResponse.json({from,to,received:Number(p.total||0),payment_count:Number(p.count||0),expenses:Number(e.total||0),expense_count:Number(e.count||0),net_cash_flow:Number(p.total||0)-Number(e.total||0),walks_total:Number(w.total||0),walks_completed:Number(w.completed||0),walks_missed:Number(w.missed||0),new_bookings:Number(b.total||0),pending_dues:Number(d.total||0)});
 }catch{return NextResponse.json({error:"Reports could not be prepared. Check D1 setup."},{status:503});}}
