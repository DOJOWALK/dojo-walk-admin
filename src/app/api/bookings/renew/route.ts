import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getAdminCookieName, verifyAdminSession } from "@/lib/auth";

type Statement={bind(...values:unknown[]):Statement;all():Promise<{results?:unknown[]}>;run():Promise<unknown>};
type DBLike={prepare(sql:string):Statement;batch(statements:Statement[]):Promise<unknown[]>};
type Env={DB:DBLike;SESSION_SECRET?:string};

async function adminEnv(){const {env}=getCloudflareContext();const runtime=env as unknown as Env;const jar=await cookies();const valid=await verifyAdminSession(jar.get(getAdminCookieName())?.value,runtime.SESSION_SECRET);return valid?runtime:null;}

export async function POST(request:NextRequest){
 const env=await adminEnv();if(!env)return NextResponse.json({error:"Unauthorized"},{status:401});
 let body:Record<string,unknown>;try{body=await request.json();}catch{return NextResponse.json({error:"Invalid request."},{status:400});}
 const sourceId=typeof body.source_booking_id==="string"?body.source_booking_id:"";
 const plan=String(body.plan_type||"");
 const startDate=typeof body.start_date==="string"?body.start_date:"";
 const choice=String(body.payment_choice||"");
 const plans:Record<string,{price:number;walks:number;duration:number}>={monthly_am_pm:{price:2999,walks:2,duration:30},monthly_once:{price:1999,walks:1,duration:30},temporary_am_pm:{price:150,walks:2,duration:30},single_walk:{price:100,walks:1,duration:30}};
 const selected=plans[plan];const sunday=body.sunday_extra_enabled===true&&(plan==="monthly_am_pm"||plan==="monthly_once");const total=selected?selected.price+(sunday?500:0):0;
 if(!sourceId||!selected||!/^\d{4}-\d{2}-\d{2}$/.test(startDate)||(choice!=="full"&&choice!=="later"))return NextResponse.json({error:"Select a customer booking, new plan, start date and payment option."},{status:400});
 const received=choice==="full"?total:0;const method=["cash","upi","bank","other"].includes(String(body.payment_method))?String(body.payment_method):"upi";
 try{
  const found=await env.DB.prepare("SELECT id,customer_id,dog_id,start_date,status FROM bookings WHERE id=?").bind(sourceId).all();
  const old=found.results?.[0] as {id:string;customer_id:string;dog_id:string;start_date:string;status:string}|undefined;
  if(!old||old.status==="cancelled")return NextResponse.json({error:"Original booking not found or cancelled."},{status:404});
  if(startDate<=old.start_date)return NextResponse.json({error:"New plan start date must be after the original booking start date."},{status:400});
  const id=crypto.randomUUID();
  const statements:Statement[]=[
   env.DB.prepare("UPDATE bookings SET end_date=?,status='completed' WHERE id=?").bind(new Date(new Date(startDate+"T00:00:00Z").getTime()-86400000).toISOString().slice(0,10),sourceId),
   env.DB.prepare("INSERT INTO bookings (id,customer_id,dog_id,plan_type,start_date,morning_time,evening_time,walks_per_day,walk_duration_minutes,price_inr,sunday_extra_enabled,booking_source,advance_received_inr,notes) SELECT ?,customer_id,dog_id,?,?,?,?,?,?,?,?,?,?,? FROM bookings WHERE id=?").bind(id,plan,startDate,body.morning_time||null,body.evening_time||null,selected.walks,selected.duration,total,sunday?1:0,"other",received,typeof body.notes==="string"?body.notes.slice(0,1000):"Continued / changed plan",sourceId)
  ];
  if(received>0)statements.push(env.DB.prepare("INSERT INTO payments (id,customer_id,booking_id,amount_inr,payment_date,payment_method,reference_note) VALUES (?,?,?,?,?,?,?)").bind(crypto.randomUUID(),old.customer_id,id,received,new Date().toISOString().slice(0,10),method,"Full payment for continued plan"));
  await env.DB.batch(statements);
  return NextResponse.json({ok:true,id,price_inr:total,received_inr:received},{status:201});
 }catch{return NextResponse.json({error:"Plan could not be continued. Please check database setup."},{status:503});}
}
