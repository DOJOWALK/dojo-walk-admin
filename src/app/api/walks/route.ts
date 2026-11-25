import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getAdminCookieName, verifyAdminSession } from "@/lib/auth";

type Statement={bind(...values:unknown[]):Statement;all():Promise<{results?:unknown[]}>;run():Promise<unknown>};
type DBLike={prepare(sql:string):Statement};
type Env={DB:DBLike;SESSION_SECRET?:string};
async function adminEnv(){const {env}=getCloudflareContext();const runtime=env as unknown as Env;const jar=await cookies();return await verifyAdminSession(jar.get(getAdminCookieName())?.value,runtime.SESSION_SECRET)?runtime:null;}
function validDate(value:string){if(!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(value))return false;const d=new Date(value+"T00:00:00Z");return !Number.isNaN(d.getTime())&&d.toISOString().slice(0,10)===value;}

export async function GET(request:NextRequest){
 const env=await adminEnv();if(!env)return NextResponse.json({error:"Unauthorized"},{status:401});
 const date=request.nextUrl.searchParams.get("date")||new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Kolkata"}).format(new Date());
 if(!validDate(date))return NextResponse.json({error:"Choose a valid date."},{status:400});
 try{const result=await env.DB.prepare("SELECT w.*,b.plan_type,b.price_inr,c.full_name AS customer_name,c.phone AS customer_phone,c.whatsapp_phone,d.name AS dog_name,d.breed FROM walks w JOIN bookings b ON b.id=w.booking_id JOIN customers c ON c.id=b.customer_id JOIN dogs d ON d.id=w.dog_id WHERE w.walk_date=? ORDER BY CASE w.slot WHEN 'morning' THEN 0 ELSE 1 END,w.scheduled_time,c.full_name").bind(date).all();return NextResponse.json({walks:result.results??[],date});}
 catch{return NextResponse.json({error:"Walk schedule is not available. Check D1 setup."},{status:503});}
}

export async function POST(request:NextRequest){
 const env=await adminEnv();if(!env)return NextResponse.json({error:"Unauthorized"},{status:401});
 let body:Record<string,unknown>;try{body=await request.json();}catch{return NextResponse.json({error:"Invalid request."},{status:400});}
 const date=typeof body.date==="string"?body.date:"";if(!validDate(date))return NextResponse.json({error:"Choose a valid date."},{status:400});
 try{
  const result=await env.DB.prepare("SELECT b.id,b.dog_id,b.walks_per_day,b.walk_duration_minutes,b.morning_time,b.evening_time,b.plan_type,b.sunday_extra_enabled,b.start_date,b.start_slot FROM bookings b WHERE b.status='active' AND b.start_date<=? AND (b.end_date IS NULL OR b.end_date>=?) AND (strftime('%w',?)!='0' OR (b.plan_type IN ('monthly_am_pm','monthly_once') AND b.sunday_extra_enabled=1))").bind(date,date,date).all();
  const bookings=(result.results??[]) as Array<{id:string;dog_id:string;walks_per_day:number;walk_duration_minutes:number;morning_time:string|null;evening_time:string|null;start_date:string;start_slot:string}>;
  let created=0;
  for(const b of bookings){
   const slots=b.walks_per_day>=2?(date===b.start_date&&b.start_slot==="evening"?["evening"]:["morning","evening"]):[b.start_slot==="evening"?"evening":"morning"];
   const pauses=await env.DB.prepare("SELECT pause_from_date,pause_from_slot,expected_resume_date,expected_resume_slot,actual_resume_date,actual_resume_slot,status FROM booking_pauses WHERE booking_id=?").bind(b.id).all();
   const activePauses=(pauses.results??[]) as Array<{pause_from_date:string;pause_from_slot:string;expected_resume_date:string;expected_resume_slot:string;actual_resume_date:string|null;actual_resume_slot:string|null;status:string}>;
   for(const slot of slots){
    const order=(d:string,s:string)=>d+":"+(s==="morning"?"0":"1");
    const slotKey=order(date,slot);
    const isPaused=activePauses.some(p=>slotKey>=order(p.pause_from_date,p.pause_from_slot)&&slotKey<order(p.status==='resumed'&&p.actual_resume_date?p.actual_resume_date:p.expected_resume_date,p.status==='resumed'&&p.actual_resume_slot?p.actual_resume_slot:p.expected_resume_slot));
    if(isPaused)continue;
    await env.DB.prepare("UPDATE walks SET status='scheduled',notes=NULL WHERE booking_id=? AND walk_date=? AND slot=? AND status='cancelled' AND notes='Customer away pause'").bind(b.id,date,slot).run();
    const time=slot==="morning"?b.morning_time:b.evening_time;
    const saved=await env.DB.prepare("INSERT OR IGNORE INTO walks (id,booking_id,dog_id,walk_date,slot,scheduled_time,duration_minutes) VALUES (?,?,?,?,?,?,?)").bind(crypto.randomUUID(),b.id,b.dog_id,date,slot,time||null,b.walk_duration_minutes||30).run();
    if((saved as {meta?:{changes?:number}}).meta?.changes)created++;
   }
  }
  return NextResponse.json({ok:true,created});
 }catch{return NextResponse.json({error:"Could not generate the day's walks."},{status:503});}
}

export async function PATCH(request:NextRequest){
 const env=await adminEnv();if(!env)return NextResponse.json({error:"Unauthorized"},{status:401});
 let body:Record<string,unknown>;try{body=await request.json();}catch{return NextResponse.json({error:"Invalid request."},{status:400});}
 const id=typeof body.id==="string"?body.id:"";const status=String(body.status||"");
 if(!id||!["scheduled","completed","missed","cancelled"].includes(status))return NextResponse.json({error:"Invalid walk update."},{status:400});
 try{
  await env.DB.prepare("UPDATE walks SET status=?,started_at=CASE WHEN ?='completed' THEN COALESCE(started_at,CURRENT_TIMESTAMP) ELSE started_at END,completed_at=CASE WHEN ?='completed' THEN CURRENT_TIMESTAMP WHEN ?='scheduled' THEN NULL ELSE completed_at END WHERE id=?").bind(status,status,status,status,id).run();
  return NextResponse.json({ok:true});
 }catch{return NextResponse.json({error:"Walk status could not be updated."},{status:503});}
}
