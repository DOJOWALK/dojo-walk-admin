import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getAdminCookieName, verifyAdminSession } from "@/lib/auth";

type Statement={bind(...values:unknown[]):Statement;all():Promise<{results?:unknown[]}>;run():Promise<unknown>};
type DBLike={prepare(sql:string):Statement};
type Env={DB:DBLike;SESSION_SECRET?:string};
async function adminEnv(){const {env}=getCloudflareContext();const runtime=env as unknown as Env;const jar=await cookies();return await verifyAdminSession(jar.get(getAdminCookieName())?.value,runtime.SESSION_SECRET)?runtime:null;}

export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
 const env=await adminEnv();if(!env)return NextResponse.json({error:"Unauthorized"},{status:401});
 const {id}=await params;
 try{
  await env.DB.prepare("CREATE TABLE IF NOT EXISTS walk_assignments (walk_id TEXT PRIMARY KEY REFERENCES walks(id) ON DELETE CASCADE, walker_id TEXT NOT NULL REFERENCES walkers(id), assigned_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)").run();
  const [walks,walkers]=await Promise.all([
   env.DB.prepare("SELECT w.id,w.walk_date,w.slot,w.scheduled_time,w.duration_minutes,w.status,wa.walker_id AS assigned_walker_id,wr.full_name AS walker_name,wr.walker_code FROM walks w LEFT JOIN walk_assignments wa ON wa.walk_id=w.id LEFT JOIN walkers wr ON wr.id=wa.walker_id WHERE w.booking_id=? ORDER BY w.walk_date DESC,CASE w.slot WHEN 'morning' THEN 0 ELSE 1 END,w.scheduled_time").bind(id).all(),
   env.DB.prepare("SELECT id,walker_code,full_name FROM walkers WHERE status='active' ORDER BY full_name").all()
  ]);
  return NextResponse.json({walks:walks.results??[],walkers:walkers.results??[]});
 }catch{return NextResponse.json({error:"Booking walks could not be loaded."},{status:503});}
}
