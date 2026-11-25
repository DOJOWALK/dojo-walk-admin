import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getAdminCookieName, verifyAdminSession } from "@/lib/auth";

type Result = { results?: unknown[] };
type DBLike = { prepare(sql: string): { bind(...values: unknown[]): { all(): Promise<Result>; run(): Promise<unknown> } } };
type Env = { DB: DBLike; SESSION_SECRET?: string };
const WALK_RATES: Record<number, number> = {20:45,30:65,45:95,60:125};

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
      `SELECT b.*, c.full_name AS customer_name, d.name AS dog_name,
       COALESCE((SELECT COUNT(*) FROM walks w WHERE w.booking_id=b.id AND w.status='completed' AND w.walk_date>=COALESCE(b.billing_start_date,b.start_date)),0) AS completed_walks,
       COALESCE((SELECT COUNT(*) FROM walks w WHERE w.booking_id=b.id AND w.status='completed' AND w.walk_date>=COALESCE(b.billing_start_date,b.start_date)),0)*b.price_per_walk_inr AS accrued_inr,
       COALESCE((SELECT SUM(p.amount_inr) FROM payments p WHERE p.booking_id=b.id AND p.payment_date>=COALESCE(b.billing_start_date,b.start_date)),0) AS paid_inr,
       MAX(0,COALESCE((SELECT COUNT(*) FROM walks w WHERE w.booking_id=b.id AND w.status='completed' AND w.walk_date>=COALESCE(b.billing_start_date,b.start_date)),0)*b.price_per_walk_inr-COALESCE((SELECT SUM(p.amount_inr) FROM payments p WHERE p.booking_id=b.id AND p.payment_date>=COALESCE(b.billing_start_date,b.start_date)),0)) AS due_inr
       FROM bookings b JOIN customers c ON c.id=b.customer_id JOIN dogs d ON d.id=b.dog_id ORDER BY b.created_at DESC`
    ).all();
    return NextResponse.json({ bookings: result.results ?? [], price_options: WALK_RATES });
  } catch {
    return NextResponse.json({ error: "Bookings are not available. Apply database migrations 0001–0004 first." }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  const env = await adminEnv();
  if (!env) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  const customerId = typeof body.customer_id === "string" ? body.customer_id : "";
  const dogId = typeof body.dog_id === "string" ? body.dog_id : "";
  const startDate = typeof body.start_date === "string" ? body.start_date : "";
  const startSlot = String(body.start_slot || "morning");
  const walksPerDay = Number(body.walks_per_day || 1);
  const walkDuration = Number(body.walk_duration_minutes || 30);
  const walkRate = WALK_RATES[walkDuration];
  const source = ["whatsapp","phone","walk_in","other"].includes(String(body.booking_source)) ? String(body.booking_source) : "whatsapp";
  const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
  if (!customerId || !dogId || !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) return NextResponse.json({ error: "Customer, dog and start date are required." }, { status: 400 });
  if (!["morning","evening"].includes(startSlot) || ![1,2].includes(walksPerDay) || !walkRate) return NextResponse.json({ error: "Choose a valid starting walk, daily walk count and walk duration." }, { status: 400 });
  const morningTime = typeof body.morning_time === "string" && timePattern.test(body.morning_time) ? body.morning_time : null;
  const eveningTime = typeof body.evening_time === "string" && timePattern.test(body.evening_time) ? body.evening_time : null;
  try {
    const dog = await env.DB.prepare("SELECT id FROM dogs WHERE id=? AND customer_id=?").bind(dogId,customerId).all();
    if (!dog.results?.length) return NextResponse.json({ error: "This dog does not belong to the selected customer." }, { status: 400 });
    const existing = await env.DB.prepare("SELECT id FROM bookings WHERE dog_id=? AND status='active'").bind(dogId).all();
    if (existing.results?.length) return NextResponse.json({ error: "This dog already has an active walking booking. Continue using that booking or cancel it first." }, { status: 409 });
    const id = crypto.randomUUID();
    await env.DB.prepare(
      "INSERT INTO bookings (id,customer_id,dog_id,plan_type,start_date,end_date,start_slot,morning_time,evening_time,walks_per_day,walk_duration_minutes,price_inr,sunday_extra_enabled,booking_source,advance_received_inr,notes,price_per_walk_inr) VALUES (?,?,?,'single_walk',?,NULL,?,?,?,?,?,0,0,?,0,?,?)"
    ).bind(id,customerId,dogId,startDate,startSlot,morningTime,eveningTime,walksPerDay,walkDuration,source,typeof body.notes==="string"?body.notes.slice(0,1000):null,walkRate).run();
    return NextResponse.json({ok:true,id,walk_duration_minutes:walkDuration,price_per_walk_inr:walkRate,walks_per_day:walksPerDay},{status:201});
  } catch {
    return NextResponse.json({error:"Booking could not be saved. Check that migration 0004 has been applied."},{status:503});
  }
}