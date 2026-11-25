import { NextRequest,NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getAdminCookieName,verifyAdminSession } from "@/lib/auth";
type Statement={bind(...values:unknown[]):Statement;all():Promise<{results?:unknown[]}>;run():Promise<unknown>};
type DBLike={prepare(sql:string):Statement};
type Env={DB:DBLike;SESSION_SECRET?:string};
async function adminEnv(){const {env}=getCloudflareContext();const runtime=env as unknown as Env;const jar=await cookies();return await verifyAdminSession(jar.get(getAdminCookieName())?.value,runtime.SESSION_SECRET)?runtime:null;}
const categories=["Travel","Dog supplies","Equipment","Marketing","Phone & internet","Other"];
function validDate(v:string){if(!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(v))return false;const d=new Date(v+"T00:00:00Z");return !Number.isNaN(d.getTime())&&d.toISOString().slice(0,10)===v;}
export async function GET(){const env=await adminEnv();if(!env)return NextResponse.json({error:"Unauthorized"},{status:401});try{const r=await env.DB.prepare("SELECT * FROM expenses ORDER BY expense_date DESC,created_at DESC").all();return NextResponse.json({expenses:r.results??[]});}catch{return NextResponse.json({error:"Expenses are not available. Check D1 setup."},{status:503});}}
export async function POST(request:NextRequest){const env=await adminEnv();if(!env)return NextResponse.json({error:"Unauthorized"},{status:401});let body:Record<string,unknown>;try{body=await request.json();}catch{return NextResponse.json({error:"Invalid request."},{status:400});}
 const date=typeof body.expense_date==="string"?body.expense_date:"";const category=typeof body.category==="string"?body.category:"";const amount=Number(body.amount_inr);const description=typeof body.description==="string"?body.description.trim().slice(0,500):"";
 if(!validDate(date)||!categories.includes(category)||!Number.isSafeInteger(amount)||amount<=0||amount>10000000)return NextResponse.json({error:"Enter a valid date, category and positive whole-rupee amount."},{status:400});
 try{const id=crypto.randomUUID();await env.DB.prepare("INSERT INTO expenses (id,expense_date,category,amount_inr,description) VALUES (?,?,?,?,?)").bind(id,date,category,amount,description||null).run();return NextResponse.json({ok:true,id},{status:201});}catch{return NextResponse.json({error:"Expense could not be saved."},{status:503});}}
