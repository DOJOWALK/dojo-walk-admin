import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getPortalIdentity, isSameOrigin, PortalDB } from "@/lib/portal-auth";

type Env = { DB: PortalDB };

async function canAccess(db: PortalDB, conversationId: string, identity: NonNullable<Awaited<ReturnType<typeof getPortalIdentity>>>) {
  const result = await db.prepare(
    "SELECT c.id FROM chat_conversations c WHERE c.id=? AND c.status='open' AND ((c.conversation_type='support' AND ((c.customer_id=? AND ?='customer') OR (c.walker_id=? AND ?='walker'))) OR (c.conversation_type='walk' AND ((c.customer_id=? AND ?='customer' AND EXISTS (SELECT 1 FROM walk_assignments a WHERE a.walk_id=c.walk_id AND a.walker_id=c.walker_id)) OR (c.walker_id=? AND ?='walker' AND EXISTS (SELECT 1 FROM walk_assignments a WHERE a.walk_id=c.walk_id AND a.walker_id=?))))) LIMIT 1"
  ).bind(
    conversationId,
    identity.customer_id, identity.role,
    identity.walker_id, identity.role,
    identity.customer_id, identity.role,
    identity.walker_id, identity.role, identity.walker_id
  ).all();
  return !!result.results?.length;
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { env } = getCloudflareContext();
  const db = (env as unknown as Env).DB;
  try {
    const identity = await getPortalIdentity(db);
    if (!identity) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;
    if (!await canAccess(db, id, identity)) return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
    const messages = await db.prepare(
      "SELECT id,sender_role,sender_id,message_text,photo_r2_key,photo_mime_type,photo_size_bytes,created_at FROM chat_messages WHERE conversation_id=? ORDER BY created_at DESC,id DESC LIMIT 100"
    ).bind(id).all();
    await db.prepare(
      "UPDATE chat_messages SET read_at=CURRENT_TIMESTAMP WHERE conversation_id=? AND sender_id<>? AND read_at IS NULL"
    ).bind(id, identity.id).run();
    return NextResponse.json({ messages: (messages.results ?? []).reverse() });
  } catch {
    return NextResponse.json({ error: "Messages could not be loaded." }, { status: 503 });
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Request origin is not allowed." }, { status: 403 });
  const { env } = getCloudflareContext();
  const db = (env as unknown as Env).DB;
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  if (body.photo || body.photo_r2_key || body.video || body.attachment) {
    return NextResponse.json({ error: "Photo upload will be enabled after private R2 storage is configured. Video is not supported." }, { status: 501 });
  }
  const message = typeof body.message_text === "string" ? body.message_text.trim() : "";
  if (!message || message.length > 4000) return NextResponse.json({ error: "Message must contain 1–4000 characters." }, { status: 400 });
  try {
    const identity = await getPortalIdentity(db);
    if (!identity) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;
    if (!await canAccess(db, id, identity)) return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
    const messageId = crypto.randomUUID();
    await db.prepare(
      "INSERT INTO chat_messages (id,conversation_id,sender_role,sender_id,message_text) VALUES (?,?,?,?,?)"
    ).bind(messageId, id, identity.role, identity.id, message).run();
    await db.prepare("UPDATE chat_conversations SET updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(id).run();
    return NextResponse.json({ ok: true, message_id: messageId }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Message could not be sent." }, { status: 503 });
  }
}
