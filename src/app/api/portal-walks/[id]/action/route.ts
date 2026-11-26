import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getPortalIdentity, isSameOrigin, PortalDB } from "@/lib/portal-auth";

type Env = { DB: PortalDB };

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Request origin is not allowed." }, { status: 403 });
  const { env } = getCloudflareContext();
  const db = (env as unknown as Env).DB;
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  const action = body.action === "start" || body.action === "complete" ? body.action : null;
  if (!action) return NextResponse.json({ error: "Choose start or complete." }, { status: 400 });

  try {
    const identity = await getPortalIdentity(db);
    if (!identity) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (identity.role !== "walker" || !identity.walker_id) return NextResponse.json({ error: "Only the assigned Walker can update this walk." }, { status: 403 });
    const { id } = await params;
    const found = await db.prepare(
      "SELECT w.id,w.walk_date,w.status,w.started_at,w.completed_at FROM walks w JOIN walk_assignments a ON a.walk_id=w.id WHERE w.id=? AND a.walker_id=? LIMIT 1"
    ).bind(id, identity.walker_id).all();
    const walk = found.results?.[0];
    if (!walk) return NextResponse.json({ error: "Walk not found for this Walker." }, { status: 404 });
    if (String(walk.status) !== "scheduled" || walk.completed_at) {
      return NextResponse.json({ error: "This walk can no longer be started or completed." }, { status: 409 });
    }

    if (action === "start") {
      const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
      if (String(walk.walk_date) !== today) return NextResponse.json({ error: "Walk ko sirf scheduled date par start kar sakte hain." }, { status: 409 });
      if (walk.started_at) return NextResponse.json({ ok: true, status: "in_progress" });
      const started = await db.prepare("UPDATE walks SET started_at=CURRENT_TIMESTAMP WHERE id=? AND status='scheduled' AND started_at IS NULL")
        .bind(id).run();
      if ((started as { meta?: { changes?: number } }).meta?.changes === 0) return NextResponse.json({ error: "Walk start state changed. Refresh and try again." }, { status: 409 });
      await db.prepare("INSERT INTO walk_events (id,walk_id,actor_role,actor_user_id,event_type) VALUES (?,?, 'walker',?,'started')")
        .bind(crypto.randomUUID(), id, identity.id).run();
      return NextResponse.json({ ok: true, status: "in_progress" });
    }

    if (!walk.started_at) return NextResponse.json({ error: "Walk pehle start karein." }, { status: 409 });
    const completed = await db.prepare("UPDATE walks SET status='completed',completed_at=CURRENT_TIMESTAMP WHERE id=? AND status='scheduled' AND started_at IS NOT NULL AND completed_at IS NULL")
      .bind(id).run();
    if ((completed as { meta?: { changes?: number } }).meta?.changes === 0) return NextResponse.json({ error: "Walk completion state changed. Refresh and try again." }, { status: 409 });
    await db.prepare("INSERT INTO walk_events (id,walk_id,actor_role,actor_user_id,event_type) VALUES (?,?, 'walker',?,'completed')")
      .bind(crypto.randomUUID(), id, identity.id).run();
    return NextResponse.json({ ok: true, status: "completed" });
  } catch {
    return NextResponse.json({ error: "Walk status could not be updated." }, { status: 503 });
  }
}
