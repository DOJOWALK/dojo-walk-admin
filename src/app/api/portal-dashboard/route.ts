import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getPortalIdentity, PortalDB } from "@/lib/portal-auth";

type Env = { DB: PortalDB };

export async function GET() {
  const { env } = getCloudflareContext();
  const db = (env as unknown as Env).DB;
  try {
    const identity = await getPortalIdentity(db);
    if (!identity) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
    const result = identity.role === "walker"
      ? await db.prepare(
        "SELECT w.id,w.walk_date,w.slot,w.scheduled_time,w.duration_minutes,CASE WHEN w.status='scheduled' AND w.started_at IS NOT NULL AND w.completed_at IS NULL THEN 'in_progress' ELSE w.status END AS status,w.started_at,w.completed_at,d.name AS dog_name,d.breed,c.full_name AS customer_name,c.phone AS customer_phone,c.address AS customer_address,c.area AS customer_area FROM walk_assignments a JOIN walks w ON w.id=a.walk_id JOIN bookings b ON b.id=w.booking_id JOIN customers c ON c.id=b.customer_id JOIN dogs d ON d.id=w.dog_id WHERE a.walker_id=? AND w.status NOT IN ('cancelled','missed') ORDER BY CASE WHEN w.walk_date>=? THEN 0 ELSE 1 END,w.walk_date,w.scheduled_time LIMIT 100"
      ).bind(identity.walker_id, today).all()
      : await db.prepare(
        "SELECT w.id,w.walk_date,w.slot,w.scheduled_time,w.duration_minutes,CASE WHEN w.status='scheduled' AND w.started_at IS NOT NULL AND w.completed_at IS NULL THEN 'in_progress' ELSE w.status END AS status,w.started_at,w.completed_at,d.name AS dog_name,d.breed,wr.full_name AS walker_name FROM walks w JOIN bookings b ON b.id=w.booking_id JOIN dogs d ON d.id=w.dog_id LEFT JOIN walk_assignments a ON a.walk_id=w.id LEFT JOIN walkers wr ON wr.id=a.walker_id WHERE b.customer_id=? AND w.status NOT IN ('cancelled','missed') ORDER BY CASE WHEN w.walk_date>=? THEN 0 ELSE 1 END,w.walk_date,w.scheduled_time LIMIT 100"
      ).bind(identity.customer_id, today).all();
    return NextResponse.json({ user: { id: identity.id, name: identity.name, role: identity.role }, today, walks: result.results ?? [] });
  } catch {
    return NextResponse.json({ error: "Dashboard could not be loaded." }, { status: 503 });
  }
}
