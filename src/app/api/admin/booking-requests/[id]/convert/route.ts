import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getAdminCookieName, verifyAdminSession } from "@/lib/auth";

type Rows = { results?: Array<Record<string, unknown>> };
type Statement = {
  bind(...values: unknown[]): Statement;
  all(): Promise<Rows>;
  run(): Promise<{ meta?: { changes?: number } }>;
};
type DB = {
  prepare(sql: string): Statement;
  batch(statements: Statement[]): Promise<Array<{ meta?: { changes?: number } }>>;
};
type Env = { DB: DB; SESSION_SECRET?: string };

async function adminDB(): Promise<DB | null> {
  const { env } = getCloudflareContext();
  const runtime = env as unknown as Env;
  const jar = await cookies();
  const valid = await verifyAdminSession(jar.get(getAdminCookieName())?.value, runtime.SESSION_SECRET);
  return valid ? runtime.DB : null;
}

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const db = await adminDB();
  if (!db) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  if (!id || id.length > 100) return NextResponse.json({ error: "Invalid booking request." }, { status: 400 });

  try {
    const found = await db.prepare(
      "SELECT id,service_type,status,booking_id,proposed_date,proposed_time,final_price_inr,duration_minutes FROM booking_requests WHERE id=?"
    ).bind(id).all();
    const requestRow = found.results?.[0];
    if (!requestRow) return NextResponse.json({ error: "Booking request not found." }, { status: 404 });
    if (requestRow.status === "converted" && requestRow.booking_id) {
      return NextResponse.json({ ok: true, already_converted: true, booking_id: String(requestRow.booking_id) });
    }
    if (requestRow.status !== "customer_confirmed") {
      return NextResponse.json({ error: "Customer confirmation is required before conversion." }, { status: 409 });
    }
    if (requestRow.service_type !== "single_walk") {
      return NextResponse.json({ error: "Recurring services need a confirmed end date and walk schedule before automatic conversion. Keep this request for manual setup." }, { status: 422 });
    }
    if (typeof requestRow.proposed_date !== "string" || !/^\\d{4}-\\d{2}-\\d{2}$/.test(requestRow.proposed_date) ||
        typeof requestRow.proposed_time !== "string" || !/^(?:[01]\\d|2[0-3]):[0-5]\\d$/.test(requestRow.proposed_time) ||
        requestRow.final_price_inr === null || requestRow.final_price_inr === undefined ||
        !Number.isInteger(Number(requestRow.final_price_inr)) || Number(requestRow.final_price_inr) < 0 ||
        ![20,30,45,60].includes(Number(requestRow.duration_minutes))) {
      return NextResponse.json({ error: "Confirmed date, time and final price are required." }, { status: 409 });
    }

    // Stable IDs make retries safe. D1 batch executes these statements atomically.
    const bookingId = "br_" + id;
    const walkId = "brw_" + id;
    const insertBooking = db.prepare(
      `INSERT OR IGNORE INTO bookings
       (id,customer_id,dog_id,plan_type,start_date,end_date,start_slot,morning_time,evening_time,
        walks_per_day,walk_duration_minutes,price_inr,sunday_extra_enabled,booking_source,
        advance_received_inr,notes,price_per_walk_inr,billing_start_date)
       SELECT ?,r.customer_id,r.dog_id,'single_walk',r.proposed_date,r.proposed_date,
        CASE WHEN CAST(substr(r.proposed_time,1,2) AS INTEGER)<12 THEN 'morning' ELSE 'evening' END,
        CASE WHEN CAST(substr(r.proposed_time,1,2) AS INTEGER)<12 THEN r.proposed_time ELSE NULL END,
        CASE WHEN CAST(substr(r.proposed_time,1,2) AS INTEGER)>=12 THEN r.proposed_time ELSE NULL END,
        1,r.duration_minutes,0,0,'other',0,
        'Pickup: ' || r.pickup_address ||
          CASE WHEN r.instructions IS NOT NULL AND length(trim(r.instructions))>0 THEN char(10) || 'Instructions: ' || r.instructions ELSE '' END ||
          CASE WHEN r.admin_note IS NOT NULL AND length(trim(r.admin_note))>0 THEN char(10) || 'Admin note: ' || r.admin_note ELSE '' END,
        r.final_price_inr,r.proposed_date
       FROM booking_requests r
       WHERE r.id=? AND r.status='customer_confirmed' AND r.booking_id IS NULL
        AND r.service_type='single_walk' AND r.final_price_inr IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM bookings b WHERE b.dog_id=r.dog_id AND b.status='active')`
    ).bind(bookingId, id);
    const insertWalk = db.prepare(
      `INSERT OR IGNORE INTO walks
       (id,booking_id,dog_id,walk_date,slot,scheduled_time,duration_minutes,status)
       SELECT ?,b.id,b.dog_id,b.start_date,b.start_slot,
        CASE WHEN b.start_slot='morning' THEN b.morning_time ELSE b.evening_time END,
        b.walk_duration_minutes,'scheduled'
       FROM bookings b JOIN booking_requests r ON r.id=?
       WHERE b.id=? AND r.status='customer_confirmed' AND r.booking_id IS NULL`
    ).bind(walkId, id, bookingId);
    const markConverted = db.prepare(
      "UPDATE booking_requests SET status='converted',booking_id=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='customer_confirmed' AND booking_id IS NULL AND EXISTS (SELECT 1 FROM bookings b JOIN walks w ON w.booking_id=b.id WHERE b.id=? AND w.id=?)"
    ).bind(bookingId, id, bookingId, walkId);

    await db.batch([insertBooking, insertWalk, markConverted]);

    const finalState = await db.prepare("SELECT status,booking_id FROM booking_requests WHERE id=?").bind(id).all();
    const result = finalState.results?.[0];
    if (result?.status === "converted" && result.booking_id) {
      return NextResponse.json({ ok: true, booking_id: String(result.booking_id), walk_id: walkId });
    }
    const active = await db.prepare(
      "SELECT id FROM bookings WHERE dog_id=(SELECT dog_id FROM booking_requests WHERE id=?) AND status='active' AND id<>?"
    ).bind(id, bookingId).all();
    if (active.results?.length) {
      return NextResponse.json({ error: "Is dog ka ek active booking pehle se hai. Existing booking review karke hi convert karein." }, { status: 409 });
    }
    return NextResponse.json({ error: "Request state changed. Refresh Booking Requests and try again." }, { status: 409 });
  } catch {
    return NextResponse.json({ error: "Booking conversion nahi ho paya. Database migration aur existing booking schema check karein." }, { status: 503 });
  }
}
