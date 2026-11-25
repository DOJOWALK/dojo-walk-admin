import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getAdminCookieName, verifyAdminSession } from "@/lib/auth";

type Result = { results?: Array<Record<string, unknown>> };
type DBLike = { prepare(sql: string): { all(): Promise<Result>; bind(...values: unknown[]): { all(): Promise<Result>; run(): Promise<unknown> } } };
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
      `SELECT b.*, c.full_name AS customer_name, c.phone AS customer_phone,
       d.name AS dog_name,
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

  const ownerName = typeof body.owner_name === "string" ? body.owner_name.trim() : "";
  const phone = typeof body.phone === "string" ? body.phone.trim() : "";
  const whatsapp = typeof body.whatsapp_phone === "string" ? body.whatsapp_phone.trim() : "";
  const dogName = typeof body.dog_name === "string" ? body.dog_name.trim() : "";
  const address = typeof body.address === "string" ? body.address.trim() : "";
  const area = [typeof body.city === "string" ? body.city.trim() : "", typeof body.state === "string" ? body.state.trim() : ""].filter(Boolean).join(", ");
  const startDate = typeof body.start_date === "string" ? body.start_date : "";
  const startSlot = String(body.start_slot || "morning");
  const walksPerDay = Number(body.walks_per_day || 1);
  const walkDuration = Number(body.walk_duration_minutes || 30);
  const walkRate = WALK_RATES[walkDuration];
  const source = ["whatsapp","phone","walk_in","other"].includes(String(body.booking_source)) ? String(body.booking_source) : "whatsapp";
  const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

  if (ownerName.length < 2 || ownerName.length > 100 || !/^[+0-9()\-\s]{7,20}$/.test(phone) || dogName.length < 1 || dogName.length > 80 || !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
    return NextResponse.json({ error: "Owner name, valid mobile number, dog name and start date are required." }, { status: 400 });
  }
  if (!["morning","evening"].includes(startSlot) || ![1,2].includes(walksPerDay) || !walkRate) {
    return NextResponse.json({ error: "Choose a valid starting walk, daily walk count and walk duration." }, { status: 400 });
  }
  const morningTime = typeof body.morning_time === "string" && timePattern.test(body.morning_time) ? body.morning_time : null;
  const eveningTime = typeof body.evening_time === "string" && timePattern.test(body.evening_time) ? body.evening_time : null;

  try {
    // Match owners by the last 10 digits so +91 and local number formats do not create duplicates.
    const allCustomers = await env.DB.prepare("SELECT id, phone FROM customers").all();
    const normalizedPhone = phone.replace(/\D/g, "").slice(-10);
    const matched = (allCustomers.results ?? []).find(c => String(c.phone ?? "").replace(/\D/g, "").slice(-10) === normalizedPhone);
    let customerId = matched ? String(matched.id) : "";

    if (!customerId) {
      customerId = crypto.randomUUID();
      await env.DB.prepare(
        "INSERT INTO customers (id,full_name,phone,whatsapp_phone,address,area,booking_source) VALUES (?,?,?,?,?,?,?)"
      ).bind(customerId,ownerName,phone,whatsapp || null,address || null,area || null,source).run();
    } else {
      // Fill in missing profile details without overwriting an existing customer's saved information.
      await env.DB.prepare(
        "UPDATE customers SET whatsapp_phone=COALESCE(whatsapp_phone,?), address=COALESCE(address,?), area=COALESCE(area,?) WHERE id=?"
      ).bind(whatsapp || null,address || null,area || null,customerId).run();
    }

    const dogs = await env.DB.prepare("SELECT id FROM dogs WHERE customer_id=? AND lower(name)=lower(?)").bind(customerId,dogName).all();
    let dogId = dogs.results?.length ? String(dogs.results[0].id) : "";
    if (!dogId) {
      dogId = crypto.randomUUID();
      await env.DB.prepare(
        "INSERT INTO dogs (id,customer_id,name) VALUES (?,?,?)"
      ).bind(dogId,customerId,dogName).run();
    }

    const existing = await env.DB.prepare("SELECT id FROM bookings WHERE dog_id=? AND status='active'").bind(dogId).all();
    if (existing.results?.length) return NextResponse.json({ error: "This dog already has an active booking. Please check the existing booking before adding another." }, { status: 409 });

    const id = crypto.randomUUID();
    await env.DB.prepare(
      "INSERT INTO bookings (id,customer_id,dog_id,plan_type,start_date,end_date,start_slot,morning_time,evening_time,walks_per_day,walk_duration_minutes,price_inr,sunday_extra_enabled,booking_source,advance_received_inr,notes,price_per_walk_inr) VALUES (?,?,?,'single_walk',?,NULL,?,?,?,?,?,0,0,?,0,?,?)"
    ).bind(id,customerId,dogId,startDate,startSlot,morningTime,eveningTime,walksPerDay,walkDuration,source,typeof body.notes==="string"?body.notes.slice(0,1000):null,walkRate).run();

    return NextResponse.json({ok:true,id,customer_id:customerId,dog_id:dogId,customer_created:!matched,dog_created:!dogs.results?.length,walk_duration_minutes:walkDuration,price_per_walk_inr:walkRate,walks_per_day:walksPerDay},{status:201});
  } catch {
    return NextResponse.json({error:"Booking could not be saved. Please check the database setup and try again."},{status:503});
  }
}
