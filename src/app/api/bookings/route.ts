import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getAdminCookieName, verifyAdminSession } from "@/lib/auth";

type Result = { results?: unknown[] };
type DBLike = { prepare(sql: string): { bind(...values: unknown[]): { all(): Promise<Result>; run(): Promise<unknown> } } };
type Env = { DB: DBLike; SESSION_SECRET?: string };

async function adminEnv() {
  const { env } = getCloudflareContext();
  const runtime = env as unknown as Env;
  const jar = await cookies();
  const valid = await verifyAdminSession(jar.get(getAdminCookieName())?.value, runtime.SESSION_SECRET);
  return valid ? runtime : null;
}

export async function GET() {
  const env = await adminEnv();
  if (!env) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const result = await env.DB.prepare(
      "SELECT b.*, c.full_name AS customer_name, d.name AS dog_name, CASE WHEN b.advance_received_inr >= b.price_inr THEN 'paid' WHEN b.advance_received_inr > 0 THEN 'partial' ELSE 'unpaid' END AS payment_status FROM bookings b JOIN customers c ON c.id=b.customer_id JOIN dogs d ON d.id=b.dog_id ORDER BY b.created_at DESC"
    ).all();
    return NextResponse.json({ bookings: result.results ?? [] });
  } catch {
    return NextResponse.json({ error: "Bookings are not available. Check D1 setup." }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  const env = await adminEnv();
  if (!env) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  const customerId = typeof body.customer_id === "string" ? body.customer_id : "";
  const dogId = typeof body.dog_id === "string" ? body.dog_id : "";
  const plan = String(body.plan_type || "");
  const startDate = typeof body.start_date === "string" ? body.start_date : "";
  const source = ["whatsapp","phone","walk_in","other"].includes(String(body.booking_source)) ? String(body.booking_source) : "whatsapp";
  const plans: Record<string,{price:number;walks:number;duration:number}> = {
    monthly_am_pm: {price:2999,walks:2,duration:30},
    monthly_once: {price:1999,walks:1,duration:30},
    temporary_am_pm: {price:150,walks:2,duration:30},
    single_walk: {price:100,walks:1,duration:30}
  };
  const selected = plans[plan];
  const sundayExtra = body.sunday_extra_enabled === true && (plan === "monthly_am_pm" || plan === "monthly_once");
  const totalPrice = selected ? selected.price + (sundayExtra ? 500 : 0) : 0;
  if (!customerId || !dogId || !selected || !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
    return NextResponse.json({ error: "Customer, dog, plan and start date are required." }, { status: 400 });
  }
  const paymentChoice = String(body.payment_choice || "");
  if (paymentChoice !== "full" && paymentChoice !== "later") return NextResponse.json({ error: "Choose full payment or pay later." }, { status: 400 });
  const advance = paymentChoice === "full" ? totalPrice : 0;
  const paymentMethod = ["cash","upi","bank","other"].includes(String(body.payment_method)) ? String(body.payment_method) : "upi";
  if (!Number.isInteger(advance) || advance < 0 || advance > 10000000) return NextResponse.json({ error: "Invalid booking payment amount." }, { status: 400 });
  try {
    const dog = await env.DB.prepare("SELECT id FROM dogs WHERE id=? AND customer_id=?").bind(dogId,customerId).all();
    if (!dog.results?.length) return NextResponse.json({ error: "This dog does not belong to the selected customer." }, { status: 400 });
    const id = crypto.randomUUID();
    await env.DB.prepare(
      "INSERT INTO bookings (id,customer_id,dog_id,plan_type,start_date,morning_time,evening_time,walks_per_day,walk_duration_minutes,price_inr,sunday_extra_enabled,booking_source,advance_received_inr,notes) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)"
    ).bind(id,customerId,dogId,plan,startDate,body.morning_time || null,body.evening_time || null,selected.walks,selected.duration,totalPrice,sundayExtra?1:0,source,advance,typeof body.notes==="string"?body.notes:null).run();
    if (advance > 0) {
      await env.DB.prepare("INSERT INTO payments (id,customer_id,booking_id,amount_inr,payment_date,payment_method,reference_note) VALUES (?,?,?,?,?,?,?)").bind(crypto.randomUUID(),customerId,id,advance,new Date().toISOString().slice(0,10),paymentMethod,"Initial booking payment").run();
    }
    return NextResponse.json({ok:true,id,price_inr:totalPrice,received_inr:advance,balance_inr:totalPrice-advance,sunday_extra_enabled:sundayExtra},{status:201});
  } catch {
    return NextResponse.json({error:"Booking could not be saved. Check database setup."},{status:503});
  }
}