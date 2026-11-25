import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getAdminCookieName, verifyAdminSession } from "@/lib/auth";

type Statement={bind(...values:unknown[]):Statement;all():Promise<{results?:unknown[]}>;run():Promise<unknown>};
type DBLike={prepare(sql:string):Statement};
type Env={DB:DBLike;SESSION_SECRET?:string};
async function adminEnv(){const {env}=getCloudflareContext();const runtime=env as unknown as Env;const jar=await cookies();return await verifyAdminSession(jar.get(getAdminCookieName())?.value,runtime.SESSION_SECRET)?runtime:null;}
function validDate(value:string){if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;const d=new Date(value+"T00:00:00Z");return !Number.isNaN(d.getTime())&&d.toISOString().slice(0,10)===value;}
function key(date:string,slot:string){return date+":"+(slot==="morning"?"0":"1");}
function addWorkingDays(date:string,count:number){const d=new Date(date+"T00:00:00Z");let n=0;while(n<count){d.setUTCDate(d.getUTCDate()+1);if(d.getUTCDay()!==0)n++;}return d.toISOString().slice(0,10);}

export async function GET(){
 const env=await adminEnv();if(!env)return NextResponse.json({error:"Unauthorized"},{status:401});
 try{
  const [bookings,pauses]=await Promise.all([
   env.DB.prepare("SELECT b.id AS booking_id,b.plan_type,b.start_date,b.end_date,b.status,c.full_name AS customer_name,d.name AS dog_name FROM bookings b JOIN customers c ON c.id=b.customer_id JOIN dogs d ON d.id=b.dog_id WHERE b.status='active' ORDER BY c.full_name").all(),
   env.DB.prepare("SELECT p.*,c.full_name AS customer_name,d.name AS dog_name FROM booking_pauses p JOIN bookings b ON b.id=p.booking_id JOIN customers c ON c.id=b.customer_id JOIN dogs d ON d.id=b.dog_id ORDER BY p.created_at DESC LIMIT 100").all()
  ]);
  return NextResponse.json({bookings:bookings.results??[],pauses:pauses.results??[]});
 }catch{return NextResponse.json({error:"Away records are unavailable. Apply database migrations first."},{status:503});}
}

export async function POST(request:NextRequest){
 const env=await adminEnv();if(!env)return NextResponse.json({error:"Unauthorized"},{status:401});
 let body:Record<string,unknown>;try{body=await request.json();}catch{return NextResponse.json({error:"Invalid request."},{status:400});}
 const bookingId=typeof body.booking_id==="string"?body.booking_id:"";
 const fromDate=typeof body.pause_from_date==="string"?body.pause_from_date:"";
 const fromSlot=String(body.pause_from_slot||"");
 const resumeDate=typeof body.expected_resume_date==="string"?body.expected_resume_date:"";
 const resumeSlot=String(body.expected_resume_slot||"");
 if(!bookingId||!validDate(fromDate)||!validDate(resumeDate)||!["morning","evening"].includes(fromSlot)||!["morning","evening"].includes(resumeSlot)||key(resumeDate,resumeSlot)<=key(fromDate,fromSlot))return NextResponse.json({error:"Choose a valid booking, pause time and later return time."},{status:400});
 try{
  const overlap=await env.DB.prepare("SELECT id FROM booking_pauses WHERE booking_id=? AND status='active'").bind(bookingId).all();
  if(overlap.results?.length)return NextResponse.json({error:"This booking already has an active away period. Resume it before adding another."},{status:409});
  const found=await env.DB.prepare("SELECT id FROM bookings WHERE id=? AND status='active'").bind(bookingId).all();
  if(!found.results?.length)return NextResponse.json({error:"Active booking not found."},{status:404});
  const id=crypto.randomUUID();
  await env.DB.prepare("INSERT INTO booking_pauses (id,booking_id,pause_from_date,pause_from_slot,expected_resume_date,expected_resume_slot,reason) VALUES (?,?,?,?,?,?,?)").bind(id,bookingId,fromDate,fromSlot,resumeDate,resumeSlot,typeof body.reason==="string"?body.reason.slice(0,500):null).run();
  await env.DB.prepare("UPDATE walks SET status='cancelled',notes='Customer away pause' WHERE booking_id=? AND status='scheduled' AND (walk_date>? OR (walk_date=? AND slot>=?)) AND (walk_date<? OR (walk_date=? AND slot<?))").bind(bookingId,fromDate,fromDate,fromSlot,resumeDate,resumeDate,resumeSlot).run();
  return NextResponse.json({ok:true,id},{status:201});
 }catch{return NextResponse.json({error:"Away period could not be saved. Apply database migrations first."},{status:503});}
}

export async function PATCH(request:NextRequest){
 const env=await adminEnv();if(!env)return NextResponse.json({error:"Unauthorized"},{status:401});
 let body:Record<string,unknown>;try{body=await request.json();}catch{return NextResponse.json({error:"Invalid request."},{status:400});}
 const id=typeof body.id==="string"?body.id:"";
 const resumeDate=typeof body.resume_date==="string"?body.resume_date:"";
 const resumeSlot=String(body.resume_slot||"");
 if(!id||!validDate(resumeDate)||!["morning","evening"].includes(resumeSlot))return NextResponse.json({error:"Choose when walks should resume."},{status:400});
 try{
  const found=await env.DB.prepare("SELECT p.*,b.end_date FROM booking_pauses p JOIN bookings b ON b.id=p.booking_id WHERE p.id=? AND p.status='active'").bind(id).all();
  const pause=found.results?.[0] as {id:string;booking_id:string;pause_from_date:string;pause_from_slot:string;expected_resume_date:string;expected_resume_slot:string;end_date:string|null}|undefined;
  if(!pause)return NextResponse.json({error:"Active away record not found."},{status:404});
  if(key(resumeDate,resumeSlot)<=key(pause.pause_from_date,pause.pause_from_slot)||key(resumeDate,resumeSlot)>key(pause.expected_resume_date,pause.expected_resume_slot))return NextResponse.json({error:"Early return must be after the pause start and no later than the expected return."},{status:400});
  await env.DB.prepare("UPDATE booking_pauses SET actual_resume_date=?,actual_resume_slot=?,status='resumed',resumed_at=CURRENT_TIMESTAMP WHERE id=?").bind(resumeDate,resumeSlot,id).run();
  let fullDays=0;
  if(pause.end_date){
   const d=new Date(pause.pause_from_date+"T00:00:00Z"),end=new Date(resumeDate+"T00:00:00Z");
   while(d<=end){
    const day=d.toISOString().slice(0,10);
    if(d.getUTCDay()!==0&&day<=pause.end_date&&key(day,"morning")>=key(pause.pause_from_date,pause.pause_from_slot)&&key(day,"evening")<key(resumeDate,resumeSlot))fullDays++;
    d.setUTCDate(d.getUTCDate()+1);
   }
   if(fullDays>0)await env.DB.prepare("UPDATE bookings SET end_date=? WHERE id=?").bind(addWorkingDays(pause.end_date,fullDays),pause.booking_id).run();
  }
  return NextResponse.json({ok:true,extended_working_days:fullDays});
 }catch{return NextResponse.json({error:"Return could not be saved."},{status:503});}
}
