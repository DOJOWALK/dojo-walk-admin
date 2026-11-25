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
       d.name AS dog_name, d.breed AS dog_breed, d.age_text AS dog_age, d.size AS dog_size, d.gender AS dog_gender, d.temperament AS dog_temperament,
       c.whatsapp_phone, c.address, c.area, c.flat_tower, c.society, c.locality, c.city, c.state, c.pincode,
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


export async function PATCH(request: NextRequest) {
  const env = await adminEnv();
  if (!env) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  const id = typeof body.id === "string" ? body.id : "";
  const ownerName = typeof body.owner_name === "string" ? body.owner_name.trim() : "";
  const phone = typeof body.phone === "string" ? body.phone.trim() : "";
  const whatsapp = typeof body.whatsapp_phone === "string" ? body.whatsapp_phone.trim() : "";
  const dogName = typeof body.dog_name === "string" ? body.dog_name.trim() : "";
  const startDate = typeof body.start_date === "string" ? body.start_date : "";
  const endDate = typeof body.end_date === "string" && body.end_date ? body.end_date : null;
  const duration = Number(body.walk_duration_minutes);
  const rate = WALK_RATES[duration];
  const walksPerDay = Number(body.walks_per_day);
  const startSlot = String(body.start_slot || "");
  const status = String(body.status || "");
  const source = String(body.booking_source || "");
  const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
  const morning = typeof body.morning_time === "string" && timePattern.test(body.morning_time) ? body.morning_time : null;
  const evening = typeof body.evening_time === "string" && timePattern.test(body.evening_time) ? body.evening_time : null;
  if (!id || ownerName.length < 2 || ownerName.length > 100 || !/^[+0-9()\-\s]{7,20}$/.test(phone) || !dogName || dogName.length > 80 || !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
    return NextResponse.json({ error: "Owner, valid mobile, dog name and start date are required." }, { status: 400 });
  }
  if (!rate || ![1,2].includes(walksPerDay) || !["morning","evening"].includes(startSlot) || !["active","paused","completed","cancelled"].includes(status) || !["whatsapp","phone","walk_in","other"].includes(source) || (endDate && (!/^\d{4}-\d{2}-\d{2}$/.test(endDate) || endDate < startDate))) {
    return NextResponse.json({ error: "Please check the booking dates, status, walk schedule and duration." }, { status: 400 });
  }
  try {
    const found = await env.DB.prepare("SELECT customer_id,dog_id FROM bookings WHERE id=?").bind(id).all();
    const record = found.results?.[0];
    if (!record) return NextResponse.json({ error: "Booking not found." }, { status: 404 });
    const customerId = String(record.customer_id);
    const dogId = String(record.dog_id);
    const address = typeof body.address === "string" ? body.address.trim() : "";
    const city = typeof body.city === "string" ? body.city.trim() : "";
    const state = typeof body.state === "string" ? body.state.trim() : "";
    const area = [city,state].filter(Boolean).join(", ");
    await env.DB.prepare("UPDATE customers SET full_name=?,phone=?,whatsapp_phone=?,address=?,area=?,updated_at=CURRENT_TIMESTAMP WHERE id=?")
      .bind(ownerName,phone,whatsapp || null,address || null,area || null,customerId).run();
    await env.DB.prepare("UPDATE dogs SET name=?,breed=?,age_text=?,size=? WHERE id=?")
      .bind(dogName,typeof body.dog_breed==="string"?body.dog_breed.trim()||null:null,typeof body.dog_age==="string"?body.dog_age.trim()||null:null,["Small","Medium","Large","Extra Large"].includes(String(body.dog_size))?String(body.dog_size):null,dogId).run();
    await env.DB.prepare("UPDATE bookings SET start_date=?,end_date=?,start_slot=?,morning_time=?,evening_time=?,walks_per_day=?,walk_duration_minutes=?,price_per_walk_inr=?,status=?,booking_source=?,notes=? WHERE id=?")
      .bind(startDate,endDate,startSlot,morning,evening,walksPerDay,duration,rate,status,source,typeof body.notes==="string"?body.notes.slice(0,1000):null,id).run();
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Booking changes could not be saved. Please try again." }, { status: 503 });
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
  const dogBreed = typeof body.dog_breed === "string" ? body.dog_breed.trim() : "";
  const dogSize = ["Small","Medium","Large","Extra Large"].includes(String(body.dog_size)) ? String(body.dog_size) : "";
  const dogGender = ["Male","Female"].includes(String(body.dog_gender)) ? String(body.dog_gender) : "";
  const dogTemperament = ["Friendly","Shy","Energetic","Calm","Anxious","Reactive","Other"].includes(String(body.dog_temperament)) ? String(body.dog_temperament) : "";
  const ageRange = typeof body.dog_age_range === "string" ? body.dog_age_range.trim() : "";
  const exactAge = typeof body.dog_exact_age === "string" ? body.dog_exact_age.trim() : "";
  const dogAge = [ageRange,exactAge].filter(Boolean).join(" · ") || (typeof body.dog_age === "string" ? body.dog_age.trim() : "");
  const flatTower = typeof body.flat_tower === "string" ? body.flat_tower.trim() : "";
  const society = typeof body.society === "string" ? body.society.trim() : "";
  const locality = typeof body.locality === "string" ? body.locality.trim() : "";
  const city = typeof body.city === "string" ? body.city.trim() : "";
  const state = typeof body.state === "string" ? body.state.trim() : "";
  const pincode = typeof body.pincode === "string" ? body.pincode.trim() : "";
  const address = [flatTower,society].filter(Boolean).join(", ");
  const area = [locality,city,state,pincode].filter(Boolean).join(", ");
  const startDate = typeof body.start_date === "string" ? body.start_date : "";
  const startSlot = String(body.start_slot || "morning");
  const walksPerDay = Number(body.walks_per_day || 1);
  const walkDuration = Number(body.walk_duration_minutes || 30);
  const walkRate = WALK_RATES[walkDuration];
  const source = ["whatsapp","phone","walk_in","other"].includes(String(body.booking_source)) ? String(body.booking_source) : "whatsapp";
  const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

  if (ownerName.length < 2 || ownerName.length > 100 || !/^[+0-9()\-\s]{7,20}$/.test(phone) || dogName.length < 1 || dogName.length > 80 || !dogSize || !dogGender || !city || !state || !/^\d{6}$/.test(pincode) || !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
    return NextResponse.json({ error: "Owner, valid mobile, dog name, size, gender, city, state, six-digit PIN Code and start date are required." }, { status: 400 });
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
        "INSERT INTO customers (id,full_name,phone,whatsapp_phone,address,area,flat_tower,society,locality,city,state,pincode,booking_source) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)"
      ).bind(customerId,ownerName,phone,whatsapp || null,address || null,area || null,flatTower || null,society || null,locality || null,city || null,state || null,pincode || null,source).run();
    } else {
      // Fill in missing profile details without overwriting an existing customer's saved information.
      await env.DB.prepare(
        "UPDATE customers SET whatsapp_phone=COALESCE(whatsapp_phone,?), address=COALESCE(address,?), area=COALESCE(area,?), flat_tower=COALESCE(flat_tower,?), society=COALESCE(society,?), locality=COALESCE(locality,?), city=COALESCE(city,?), state=COALESCE(state,?), pincode=COALESCE(pincode,?) WHERE id=?"
      ).bind(whatsapp || null,address || null,area || null,flatTower || null,society || null,locality || null,city || null,state || null,pincode || null,customerId).run();
    }

    const dogs = await env.DB.prepare("SELECT id FROM dogs WHERE customer_id=? AND lower(name)=lower(?)").bind(customerId,dogName).all();
    let dogId = dogs.results?.length ? String(dogs.results[0].id) : "";
    if (!dogId) {
      dogId = crypto.randomUUID();
      await env.DB.prepare(
        "INSERT INTO dogs (id,customer_id,name,breed,age_text,size,gender,temperament) VALUES (?,?,?,?,?,?,?,?)"
      ).bind(dogId,customerId,dogName,dogBreed||null,dogAge||null,dogSize||null,dogGender||null,dogTemperament||null).run();
    }

    if (dogs.results?.length && (dogBreed || dogAge || dogSize)) {
      await env.DB.prepare("UPDATE dogs SET breed=COALESCE(?,breed), age_text=COALESCE(?,age_text), size=COALESCE(?,size), gender=COALESCE(?,gender), temperament=COALESCE(?,temperament) WHERE id=?").bind(dogBreed||null,dogAge||null,dogSize||null,dogGender||null,dogTemperament||null,dogId).run();
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
