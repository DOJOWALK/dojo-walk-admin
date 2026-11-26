import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getAdminCookieName, verifyAdminSession } from "@/lib/auth";
import { PortalDB } from "@/lib/portal-auth";

type Env = { DB: PortalDB; SESSION_SECRET?: string };
async function adminDB() {
  const { env } = getCloudflareContext();
  const runtime = env as unknown as Env;
  const jar = await cookies();
  const valid = await verifyAdminSession(jar.get(getAdminCookieName())?.value, runtime.SESSION_SECRET);
  return valid ? runtime.DB : null;
}
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

export async function GET() {
  const db = await adminDB();
  if (!db) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const result = await db.prepare(
      "SELECT r.*,c.full_name AS customer_name,c.phone AS customer_phone,d.name AS dog_name,d.breed AS dog_breed FROM booking_requests r JOIN customers c ON c.id=r.customer_id JOIN dogs d ON d.id=r.dog_id ORDER BY CASE r.status WHEN 'new_request' THEN 0 WHEN 'under_review' THEN 1 WHEN 'time_proposed' THEN 2 WHEN 'customer_confirmed' THEN 3 ELSE 4 END,r.created_at DESC LIMIT 200"
    ).all();
    return NextResponse.json({ requests: result.results ?? [] });
  } catch {
    return NextResponse.json({ error: "Booking request table is not installed. Apply the reviewed migration first." }, { status: 503 });
  }
}

export async function PATCH(request: NextRequest) {
  const db = await adminDB();
  if (!db) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  const id = typeof body.id === "string" ? body.id : "";
  const action = String(body.action || "");
  const note = typeof body.admin_note === "string" ? body.admin_note.trim().slice(0,1000) : null;
  if (!id || !["review","propose","reject"].includes(action)) return NextResponse.json({ error: "Choose a valid review action." }, { status: 400 });
  try {
    let result;
    if (action === "review") {
      result = await db.prepare("UPDATE booking_requests SET status='under_review',admin_note=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status IN ('new_request','under_review')").bind(note,id).run();
    } else if (action === "reject") {
      result = await db.prepare("UPDATE booking_requests SET status='rejected',admin_note=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status IN ('new_request','under_review','time_proposed')").bind(note,id).run();
    } else {
      const date = typeof body.proposed_date === "string" ? body.proposed_date : "";
      const time = typeof body.proposed_time === "string" ? body.proposed_time : "";
      const price = Number(body.final_price_inr);
      if (!datePattern.test(date) || !timePattern.test(time) || !Number.isInteger(price) || price < 0 || price > 1000000) {
        return NextResponse.json({ error: "Proposed date, time aur final price check karein." }, { status: 400 });
      }
      result = await db.prepare("UPDATE booking_requests SET status='time_proposed',proposed_date=?,proposed_time=?,final_price_inr=?,admin_note=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status IN ('new_request','under_review','time_proposed')").bind(date,time,price,note,id).run();
    }
    if ((result as {meta?:{changes?:number}}).meta?.changes === 0) return NextResponse.json({ error: "Request ab is action ke liye available nahi hai." }, { status: 409 });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Booking request update nahi hui." }, { status: 503 });
  }
}
