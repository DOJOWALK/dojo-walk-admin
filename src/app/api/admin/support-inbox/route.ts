import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getAdminCookieName, verifyAdminSession } from "@/lib/auth";
import { isSameOrigin, PortalDB } from "@/lib/portal-auth";

type Env = { DB: PortalDB; SESSION_SECRET?: string };

async function adminDB() {
  const { env } = getCloudflareContext();
  const runtime = env as unknown as Env;
  const jar = await cookies();
  const ok = await verifyAdminSession(jar.get(getAdminCookieName())?.value, runtime.SESSION_SECRET);
  return ok ? runtime.DB : null;
}

export async function GET(request: NextRequest) {
  const db = await adminDB();
  if (!db) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const status = request.nextUrl.searchParams.get("status");
  const filter = status === "closed" ? "closed" : status === "all" ? null : "open";
  try {
    const result = await db.prepare(
      `SELECT c.id,c.status,c.customer_id,c.walker_id,c.created_at,c.updated_at,
        cu.full_name AS customer_name,cu.phone AS customer_phone,
        w.full_name AS walker_name,w.mobile_number AS walker_phone,
        (SELECT m.message_text FROM chat_messages m WHERE m.conversation_id=c.id ORDER BY m.created_at DESC,m.id DESC LIMIT 1) AS last_message,
        (SELECT m.created_at FROM chat_messages m WHERE m.conversation_id=c.id ORDER BY m.created_at DESC,m.id DESC LIMIT 1) AS last_message_at,
        (SELECT COUNT(*) FROM chat_messages m WHERE m.conversation_id=c.id AND m.sender_role<>'admin' AND m.read_at IS NULL) AS unread_count
       FROM chat_conversations c
       LEFT JOIN customers cu ON cu.id=c.customer_id
       LEFT JOIN walkers w ON w.id=c.walker_id
       WHERE c.conversation_type='support' ${filter ? "AND c.status=?" : ""}
       ORDER BY c.updated_at DESC LIMIT 200`
    );
    const rows = filter ? await result.bind(filter).all() : await result.all();
    return NextResponse.json({ conversations: rows.results ?? [] });
  } catch {
    return NextResponse.json({ error: "Support inbox is unavailable. Apply the reviewed chat migration first." }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Request origin is not allowed." }, { status: 403 });
  const db = await adminDB();
  if (!db) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  const id = typeof body.conversation_id === "string" ? body.conversation_id : "";
  const message = typeof body.message_text === "string" ? body.message_text.trim() : "";
  if (!id || !message || message.length > 4000) return NextResponse.json({ error: "Conversation and a 1–4000 character message are required." }, { status: 400 });
  if (body.photo || body.photo_r2_key || body.video || body.attachment) {
    return NextResponse.json({ error: "Photo upload requires private R2 setup. Video is not supported." }, { status: 501 });
  }
  try {
    const found = await db.prepare("SELECT id FROM chat_conversations WHERE id=? AND conversation_type='support' AND status='open'").bind(id).all();
    if (!found.results?.length) return NextResponse.json({ error: "Open support conversation not found." }, { status: 404 });
    await db.prepare("INSERT INTO chat_messages (id,conversation_id,sender_role,sender_id,message_text) VALUES (?,?,'admin','admin',?)")
      .bind(crypto.randomUUID(), id, message).run();
    await db.prepare("UPDATE chat_conversations SET updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(id).run();
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Support reply could not be sent." }, { status: 503 });
  }
}

export async function PATCH(request: NextRequest) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Request origin is not allowed." }, { status: 403 });
  const db = await adminDB();
  if (!db) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  const id = typeof body.conversation_id === "string" ? body.conversation_id : "";
  const status = body.status === "closed" ? "closed" : body.status === "open" ? "open" : "";
  if (!id || !status) return NextResponse.json({ error: "Choose a valid conversation status." }, { status: 400 });
  try {
    const result = await db.prepare("UPDATE chat_conversations SET status=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND conversation_type='support'")
      .bind(status, id).run();
    if ((result as { meta?: { changes?: number } }).meta?.changes === 0) return NextResponse.json({ error: "Support conversation not found." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Support conversation could not be updated." }, { status: 503 });
  }
}
