import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getPortalIdentity, isSameOrigin, PortalDB } from "@/lib/portal-auth";

type Env = { DB: PortalDB };
const RATES: Record<number, number> = { 20: 45, 30: 65, 45: 95, 60: 125 };
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

export async function GET() {
  const { env } = getCloudflareContext();
  const db = (env as unknown as Env).DB;
  try {
    const identity = await getPortalIdentity(db);
    if (!identity) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (identity.role !== "customer" || !identity.customer_id) return NextResponse.json({ error: "Customer access only." }, { status: 403 });
    const [dogs, requests] = await Promise.all([
      db.prepare("SELECT id,name,breed FROM dogs WHERE customer_id=? ORDER BY name").bind(identity.customer_id).all(),
      db.prepare("SELECT id,dog_id,service_type,preferred_date,preferred_time,duration_minutes,pickup_address,estimated_price_inr,proposed_date,proposed_time,final_price_inr,admin_note,status,created_at FROM booking_requests WHERE customer_id=? ORDER BY created_at DESC LIMIT 50").bind(identity.customer_id).all()
    ]);
    return NextResponse.json({ dogs: dogs.results ?? [], requests: requests.results ?? [] });
  } catch {
    return NextResponse.json({ error: "Booking requests are not available yet. The reviewed database migration is required." }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Request origin is not allowed." }, { status: 403 });
  const { env } = getCloudflareContext();
  const db = (env as unknown as Env).DB;
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  try {
    const identity = await getPortalIdentity(db);
    if (!identity) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (identity.role !== "customer" || !identity.customer_id) return NextResponse.json({ error: "Customer access only." }, { status: 403 });
    const dogId = typeof body.dog_id === "string" ? body.dog_id : "";
    const service = ["monthly_am_pm","monthly_once","temporary_am_pm","single_walk"].includes(String(body.service_type)) ? String(body.service_type) : "";
    const date = typeof body.preferred_date === "string" ? body.preferred_date : "";
    const time = typeof body.preferred_time === "string" ? body.preferred_time : "";
    const duration = Number(body.duration_minutes);
    const address = typeof body.pickup_address === "string" ? body.pickup_address.trim().slice(0,500) : "";
    const instructions = typeof body.instructions === "string" ? body.instructions.trim().slice(0,1000) : "";
    const lat = body.pickup_latitude === null || body.pickup_latitude === undefined || body.pickup_latitude === "" ? null : Number(body.pickup_latitude);
    const lon = body.pickup_longitude === null || body.pickup_longitude === undefined || body.pickup_longitude === "" ? null : Number(body.pickup_longitude);
    if (!dogId || !service || !datePattern.test(date) || !timePattern.test(time) || !RATES[duration] || address.length < 5 ||
      ((lat === null) !== (lon === null)) || (lat !== null && (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lon) || lon! < -180 || lon! > 180))) {
      return NextResponse.json({ error: "Dog, service, date, time, duration and pickup address check karein." }, { status: 400 });
    }
    const ownedDog = await db.prepare("SELECT id FROM dogs WHERE id=? AND customer_id=?").bind(dogId, identity.customer_id).all();
    if (!ownedDog.results?.length) return NextResponse.json({ error: "Selected dog is not linked to your account." }, { status: 404 });
    const id = crypto.randomUUID();
    await db.prepare("INSERT INTO booking_requests (id,customer_id,dog_id,service_type,preferred_date,preferred_time,duration_minutes,pickup_address,pickup_latitude,pickup_longitude,instructions,estimated_price_inr) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)")
      .bind(id,identity.customer_id,dogId,service,date,time,duration,address,lat,lon,instructions || null,RATES[duration]).run();
    return NextResponse.json({ ok: true, id, estimated_price_inr: RATES[duration] }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Request save nahi hui. Database migration apply hone ke baad dobara try karein." }, { status: 503 });
  }
}

export async function PATCH(request: NextRequest) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Request origin is not allowed." }, { status: 403 });
  const { env } = getCloudflareContext();
  const db = (env as unknown as Env).DB;
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  try {
    const identity = await getPortalIdentity(db);
    if (!identity) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (identity.role !== "customer" || !identity.customer_id) return NextResponse.json({ error: "Customer access only." }, { status: 403 });
    const id = typeof body.id === "string" ? body.id : "";
    const action = body.action;
    if (!id || !["confirm","cancel"].includes(String(action))) return NextResponse.json({ error: "Invalid action." }, { status: 400 });
    const status = action === "confirm" ? "customer_confirmed" : "cancelled";
    const allowed = action === "confirm" ? "time_proposed" : "new_request,under_review,time_proposed";
    const result = await db.prepare(
      action === "confirm"
        ? "UPDATE booking_requests SET status=?,customer_confirmed_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=? AND customer_id=? AND status='time_proposed'"
        : "UPDATE booking_requests SET status=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND customer_id=? AND status IN ('new_request','under_review','time_proposed')"
    ).bind(status,id,identity.customer_id).run();
    if ((result as {meta?:{changes?:number}}).meta?.changes === 0) return NextResponse.json({ error: "Request ab is action ke liye available nahi hai." }, { status: 409 });
    return NextResponse.json({ ok: true, status });
  } catch {
    return NextResponse.json({ error: "Request update nahi hui." }, { status: 503 });
  }
}
