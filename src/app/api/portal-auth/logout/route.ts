import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { clearPortalCookie, getPortalIdentity, isSameOrigin, PortalDB } from "@/lib/portal-auth";

type Env = { DB: PortalDB };

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Request origin is not allowed." }, { status: 403 });
  const { env } = getCloudflareContext();
  const db = (env as unknown as Env).DB;
  try {
    const identity = await getPortalIdentity(db);
    if (identity) await db.prepare("UPDATE portal_sessions SET revoked_at=CURRENT_TIMESTAMP WHERE id=? AND revoked_at IS NULL").bind(identity.session_id).run();
    const response = NextResponse.json({ ok: true });
    clearPortalCookie(response);
    return response;
  } catch {
    return NextResponse.json({ error: "Could not end the portal session." }, { status: 503 });
  }
}
