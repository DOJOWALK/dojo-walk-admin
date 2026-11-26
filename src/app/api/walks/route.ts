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
 try{await env.DB.prepare("CREATE TABLE IF NOT EXISTS walk_assignments (walk_id TEXT PRIMARY KEY REFERENCES walks(id) ON DELETE CASCADE, walker_id TEXT NOT NULL REFERENCES walkers(id), assigned_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)").run();const result=await env.DB.prepare("SELECT w.*,b.price_per_walk_inr,c.id AS customer_id,c.full_name AS customer_name,c.phone AS customer_phone,c.whatsapp_phone,d.name AS dog_name,d.breed,wa.walker_id AS assigned_walker_id,wr.full_name AS walker_name FROM walks w JOIN bookings b ON b.id=w.booking_id JOIN customers c ON c.id=b.customer_id JOIN dogs d ON d.id=w.dog_id LEFT JOIN walk_assignments wa ON wa.walk_id=w.id LEFT JOIN walkers wr ON wr.id=wa.walker_id WHERE w.walk_date=? ORDER BY CASE w.slot WHEN 'morning' THEN 0 ELSE 1 END,w.scheduled_time,c.full_name").bind(date).all();const walkers=await env.DB.prepare("SELECT id,walker_code,full_name FROM walkers WHERE status='active' ORDER BY full_name").all();const rows=(result.results??[]) as Array<Record<string,unknown>>;const walks=rows.map(w=>({...w,status:w.status==="scheduled"&&w.started_at&&!w.completed_at?"in_progress":w.status}));return NextResponse.json({walks,walkers:walkers.results??[],date});}
 catch{return NextResponse.json({error:"Walk schedule is not available. Check D1 setup."},{status:503});}
}

export async function POST(request:NextRequest){
 const env=await adminEnv();if(!env)return NextResponse.json({error:"Unauthorized"},{status:401});
 let body:Record<string,unknown>;try{body=await request.json();}catch{return NextResponse.json({error:"Invalid request."},{status:400});}
 const date=typeof body.date==="string"?body.date:"";const includeSunday=body.include_sunday===true;if(!validDate(date))return NextResponse.json({error:"Choose a valid date."},{status:400});
 try{
  const result=await env.DB.prepare("SELECT b.id,b.dog_id,b.walks_per_day,b.walk_duration_minutes,b.morning_time,b.evening_time,b.start_date,b.start_slot FROM bookings b WHERE b.status='active' AND b.start_date<=? AND (b.end_date IS NULL OR b.end_date>=?) AND (?=1 OR strftime('%w',?)!='0')").bind(date,date,includeSunday?1:0,date).all();
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
 if(!id)return NextResponse.json({error:"Walk ID is required."},{status:400});if(body.action==="assign"){const walkerId=typeof body.walker_id==="string"?body.walker_id:"";try{await env.DB.prepare("CREATE TABLE IF NOT EXISTS walk_assignments (walk_id TEXT PRIMARY KEY REFERENCES walks(id) ON DELETE CASCADE, walker_id TEXT NOT NULL REFERENCES walkers(id), assigned_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)").run();const found=await env.DB.prepare("SELECT walk_date,scheduled_time,duration_minutes FROM walks WHERE id=?").bind(id).all();const walk=(found.results??[])[0] as {walk_date:string;scheduled_time:string|null;duration_minutes:number}|undefined;if(!walk)return NextResponse.json({error:"Walk not found."},{status:404});if(!walkerId){await env.DB.prepare("DELETE FROM walk_assignments WHERE walk_id=?").bind(id).run();return NextResponse.json({ok:true});}const active=await env.DB.prepare("SELECT id FROM walkers WHERE id=? AND status='active'").bind(walkerId).all();if(!active.results?.length)return NextResponse.json({error:"Choose an active walker."},{status:400});const assigned=await env.DB.prepare("SELECT w.id,w.scheduled_time,w.duration_minutes FROM walks w JOIN walk_assignments a ON a.walk_id=w.id WHERE a.walker_id=? AND w.walk_date=? AND w.status NOT IN ('cancelled','missed') AND w.id<>?").bind(walkerId,walk.walk_date,id).all();const mins=(v:string|null)=>{if(!v)return -1;const p=v.split(":").map(Number);return p[0]*60+(p[1]||0)};const start=mins(walk.scheduled_time),end=start+Number(walk.duration_minutes||30);const conflict=(assigned.results??[]).some(x=>{const y=x as {scheduled_time:string|null;duration_minutes:number};const s=mins(y.scheduled_time);return start>=0&&s>=0&&start<s+Number(y.duration_minutes||30)&&s<end;});if(conflict)return NextResponse.json({error:"This walker already has another walk at the same time."},{status:409});await env.DB.prepare("INSERT INTO walk_assignments (walk_id,walker_id) VALUES (?,?) ON CONFLICT(walk_id) DO UPDATE SET walker_id=excluded.walker_id,assigned_at=CURRENT_TIMESTAMP").bind(id,walkerId).run();return NextResponse.json({ok:true});}catch{return NextResponse.json({error:"Walker assignment could not be saved."},{status:503});}}
 if(body.action==="edit"){const date=String(body.walk_date||"");const time=String(body.scheduled_time||"");const duration=Number(body.duration_minutes);if(!validDate(date)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)||!Number.isInteger(duration)||duration<1||duration>480)return NextResponse.json({error:"Enter a valid date, time and duration (1–480 minutes)."},{status:400});try{const result=await env.DB.prepare("UPDATE walks SET walk_date=?,scheduled_time=?,duration_minutes=? WHERE id=?").bind(date,time,duration,id).run();if((result as {meta?:{changes?:number}}).meta?.changes===0)return NextResponse.json({error:"Walk not found."},{status:404});return NextResponse.json({ok:true});}catch{return NextResponse.json({error:"Walk details could not be saved."},{status:503});}}
 if(!["scheduled","in_progress","completed","missed","cancelled"].includes(status))return NextResponse.json({error:"Invalid walk status."},{status:400});
 try{
  await env.DB.prepare("UPDATE walks SET status=CASE WHEN ?='in_progress' THEN 'scheduled' ELSE ? END,started_at=CASE WHEN ? IN ('in_progress','completed') THEN COALESCE(started_at,CURRENT_TIMESTAMP) WHEN ?='scheduled' THEN NULL ELSE started_at END,completed_at=CASE WHEN ?='completed' THEN CURRENT_TIMESTAMP WHEN ? IN ('scheduled','in_progress') THEN NULL ELSE NULL END WHERE id=?").bind(status,status,status,status,status,status,id).run();
  return NextResponse.json({ok:true});
 }catch{return NextResponse.json({error:"Walk status could not be updated."},{status:503});}
}
