import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getAdminCookieName, verifyAdminSession } from "@/lib/auth";

type Statement={bind(...values:unknown[]):Statement;all():Promise<{results?:unknown[]}>;run():Promise<unknown>};
type DBLike={prepare(sql:string):Statement;batch(statements:Statement[]):Promise<unknown[]>};
type Env={DB:DBLike;SESSION_SECRET?:string};

function planEndDate(start:string,monthly:boolean){const d=new Date(start+"T00:00:00Z");if(!monthly)return start;let days=0;while(days<26){if(d.getUTCDay()!==0)days++;if(days<26)d.setUTCDate(d.getUTCDate()+1);}return d.toISOString().slice(0,10);}
async function adminEnv(){const {env}=getCloudflareContext();const runtime=env as unknown as Env;const jar=await cookies();const valid=await verifyAdminSession(jar.get(getAdminCookieName())?.value,runtime.SESSION_SECRET);return valid?runtime:null;}

export async function POST(){
 const env=await adminEnv();
 if(!env)return NextResponse.json({error:"Unauthorized"},{status:401});
 return NextResponse.json({error:"Monthly and temporary plans have been discontinued. Create a per-walk booking instead."},{status:410});
}
