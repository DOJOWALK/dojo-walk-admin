import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getAdminCookieName, verifyAdminSession } from "@/lib/auth";

type Statement={bind(...values:unknown[]):Statement;all():Promise<{results?:unknown[]}>;run():Promise<unknown>};
type DBLike={prepare(sql:string):Statement};
type Env={DB:DBLike;SESSION_SECRET?:string};
async function adminEnv(){const {env}=getCloudflareContext();const runtime=env as unknown as Env;const jar=await cookies();return await verifyAdminSession(jar.get(getAdminCookieName())?.value,runtime.SESSION_SECRET)?runtime:null;}

export async function GET(_request:NextRequest,{params}:{params:Promise<{id:string}>}){
 const env=await adminEnv();if(!env)return NextResponse.json({error:"Unauthorized"},{status:401});
 const {id}=await params;
 try{
  const found=await env.DB.prepare("SELECT w.id,w.booking_id,w.dog_id,w.walk_date,w.slot,w.scheduled_time,w.duration_minutes,CASE WHEN w.status='scheduled' AND w.started_at IS NOT NULL AND w.completed_at IS NULL THEN 'in_progress' ELSE w.status END AS status,w.started_at,w.completed_at,w.notes,b.price_per_walk_inr,c.id AS customer_id,c.full_name AS customer_name,c.phone AS customer_phone,c.whatsapp_phone,d.name AS dog_name,d.breed,wa.walker_id AS assigned_walker_id,wr.full_name AS walker_name,wr.walker_code FROM walks w JOIN bookings b ON b.id=w.booking_id JOIN customers c ON c.id=b.customer_id JOIN dogs d ON d.id=w.dog_id LEFT JOIN walk_assignments wa ON wa.walk_id=w.id LEFT JOIN walkers wr ON wr.id=wa.walker_id WHERE w.id=?").bind(id).all();
  const walk=(found.results??[])[0];if(!walk)return NextResponse.json({error:"Walk not found."},{status:404});
  const walkers=await env.DB.prepare("SELECT id,walker_code,full_name FROM walkers WHERE status='active' ORDER BY full_name").all();
  return NextResponse.json({walk,walkers:walkers.results??[]});
 }catch{return NextResponse.json({error:"Walk details could not be loaded."},{status:503});}
}
