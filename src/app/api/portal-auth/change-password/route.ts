import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import {
  createPortalSession, getPortalIdentity, isSameOrigin, makePortalPassword,
  PortalDB, setPortalCookie, verifyPortalPassword
} from "@/lib/portal-auth";

type Env = { DB: PortalDB };

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Request origin is not allowed." }, { status: 403 });
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  const currentPassword = typeof body.current_password === "string" ? body.current_password : "";
  const newPassword = typeof body.new_password === "string" ? body.new_password : "";
  if (newPassword.length < 12 || newPassword.length > 128) {
    return NextResponse.json({ error: "New password must be 12–128 characters." }, { status: 400 });
  }

  const { env } = getCloudflareContext();
  const db = (env as unknown as Env).DB;
  try {
    const identity = await getPortalIdentity(db);
    if (!identity) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const found = await db.prepare("SELECT password_hash,password_salt,password_iterations FROM portal_users WHERE id=? AND is_active=1")
      .bind(identity.id).all();
    const user = found.results?.[0];
    if (!user || !await verifyPortalPassword(currentPassword, String(user.password_salt), String(user.password_hash), Number(user.password_iterations))) {
      return NextResponse.json({ error: "Current password is incorrect." }, { status: 401 });
    }
    const password = await makePortalPassword(newPassword);
    await db.prepare("UPDATE portal_users SET password_hash=?,password_salt=?,password_iterations=?,updated_at=CURRENT_TIMESTAMP WHERE id=?")
      .bind(password.password_hash, password.password_salt, password.password_iterations, identity.id).run();
    await db.prepare("UPDATE portal_sessions SET revoked_at=CURRENT_TIMESTAMP WHERE user_id=? AND revoked_at IS NULL")
      .bind(identity.id).run();
    const session = await createPortalSession(db, identity.id);
    const response = NextResponse.json({ ok: true });
    setPortalCookie(response, session.token);
    return response;
  } catch {
    return NextResponse.json({ error: "Password could not be changed." }, { status: 503 });
  }
}
