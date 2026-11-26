import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getPortalIdentity, isSameOrigin, PortalDB } from "@/lib/portal-auth";

type Env = { DB: PortalDB };

export async function GET() {
  const { env } = getCloudflareContext();
  const db = (env as unknown as Env).DB;
  try {
    const identity = await getPortalIdentity(db);
    if (!identity) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const column = identity.role === "customer" ? "customer_id" : "walker_id";
    const result = await db.prepare(
      `SELECT c.id,c.conversation_type,c.walk_id,c.status,c.updated_at,
        (SELECT m.message_text FROM chat_messages m WHERE m.conversation_id=c.id ORDER BY m.created_at DESC,m.id DESC LIMIT 1) AS last_message,
        (SELECT m.created_at FROM chat_messages m WHERE m.conversation_id=c.id ORDER BY m.created_at DESC,m.id DESC LIMIT 1) AS last_message_at
       FROM chat_conversations c WHERE c.${column}=? ORDER BY c.updated_at DESC LIMIT 100`
    ).bind(identity.role === "customer" ? identity.customer_id : identity.walker_id).all();
    return NextResponse.json({ conversations: result.results ?? [] });
  } catch {
    return NextResponse.json({ error: "Chat is not available yet. Check the chat database migration." }, { status: 503 });
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

    if (body.conversation_type === "support") {
      const participant = identity.role === "customer" ? { customer_id: identity.customer_id, walker_id: null } : { customer_id: null, walker_id: identity.walker_id };
      await db.prepare(
        "INSERT OR IGNORE INTO chat_conversations (id,conversation_type,customer_id,walker_id) VALUES (?,'support',?,?)"
      ).bind(crypto.randomUUID(), participant.customer_id, participant.walker_id).run();
      const existing = await db.prepare(
        "SELECT id FROM chat_conversations WHERE conversation_type='support' AND status='open' AND customer_id IS ? AND walker_id IS ? LIMIT 1"
      ).bind(participant.customer_id, participant.walker_id).all();
      const row = existing.results?.[0];
      if (!row) return NextResponse.json({ error: "Support conversation could not be opened." }, { status: 503 });
      return NextResponse.json({ ok: true, conversation_id: String(row.id) });
    }

    const walkId = typeof body.walk_id === "string" ? body.walk_id : "";
    if (!walkId) return NextResponse.json({ error: "Walk ID is required." }, { status: 400 });
    const access = identity.role === "customer"
      ? await db.prepare("SELECT w.id,b.customer_id,a.walker_id FROM walks w JOIN bookings b ON b.id=w.booking_id JOIN walk_assignments a ON a.walk_id=w.id WHERE w.id=? AND b.customer_id=? AND w.status NOT IN ('cancelled','missed')").bind(walkId, identity.customer_id).all()
      : await db.prepare("SELECT w.id,b.customer_id,a.walker_id FROM walks w JOIN bookings b ON b.id=w.booking_id JOIN walk_assignments a ON a.walk_id=w.id WHERE w.id=? AND a.walker_id=? AND w.status NOT IN ('cancelled','missed')").bind(walkId, identity.walker_id).all();
    const walk = access.results?.[0];
    if (!walk) return NextResponse.json({ error: "This walk is not available to your account." }, { status: 404 });
    await db.prepare(
      "INSERT OR IGNORE INTO chat_conversations (id,conversation_type,walk_id,customer_id,walker_id) VALUES (?,'walk',?,?,?)"
    ).bind(crypto.randomUUID(), walkId, String(walk.customer_id), String(walk.walker_id)).run();
    const existing = await db.prepare("SELECT id FROM chat_conversations WHERE walk_id=? AND conversation_type='walk' LIMIT 1").bind(walkId).all();
    const row = existing.results?.[0];
    if (!row) return NextResponse.json({ error: "Walk chat could not be opened." }, { status: 503 });
    return NextResponse.json({ ok: true, conversation_id: String(row.id) });
  } catch {
    return NextResponse.json({ error: "Conversation could not be opened." }, { status: 503 });
  }
}
