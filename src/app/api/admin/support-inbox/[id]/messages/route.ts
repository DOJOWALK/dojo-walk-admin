import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getAdminCookieName, verifyAdminSession } from "@/lib/auth";
import { PortalDB } from "@/lib/portal-auth";

type Env = { DB: PortalDB; SESSION_SECRET?: string };

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { env } = getCloudflareContext();
  const runtime = env as unknown as Env;
  const jar = await cookies();
  if (!await verifyAdminSession(jar.get(getAdminCookieName())?.value, runtime.SESSION_SECRET)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  try {
    const found = await runtime.DB.prepare("SELECT id FROM chat_conversations WHERE id=? AND conversation_type='support'").bind(id).all();
    if (!found.results?.length) return NextResponse.json({ error: "Support conversation not found." }, { status: 404 });
    const messages = await runtime.DB.prepare(
      "SELECT id,sender_role,sender_id,message_text,photo_r2_key,photo_mime_type,photo_size_bytes,created_at,read_at FROM chat_messages WHERE conversation_id=? ORDER BY created_at,id LIMIT 200"
    ).bind(id).all();
    await runtime.DB.prepare("UPDATE chat_messages SET read_at=CURRENT_TIMESTAMP WHERE conversation_id=? AND sender_role<>'admin' AND read_at IS NULL").bind(id).run();
    return NextResponse.json({ messages: messages.results ?? [] });
  } catch {
    return NextResponse.json({ error: "Support messages could not be loaded." }, { status: 503 });
  }
}
