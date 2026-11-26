import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import {
  createPortalSession,
  isSameOrigin,
  normalizePortalPhone,
  PortalDB,
  setPortalCookie,
  verifyPortalPassword
} from "@/lib/portal-auth";

type Env = { DB: PortalDB };

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Request origin is not allowed." }, { status: 403 });
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }

  const role = body.role === "walker" || body.role === "customer" ? body.role : null;
  const phone = typeof body.phone === "string" ? body.phone.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const normalized = normalizePortalPhone(phone);
  if (!role || !/^[+0-9]{7,15}$/.test(normalized) || password.length < 1 || password.length > 128) {
    return NextResponse.json({ error: "Enter a valid phone number, password and account type." }, { status: 400 });
  }

  const { env } = getCloudflareContext();
  const db = (env as unknown as Env).DB;
  const attemptKey = role + ":" + normalized;
  try {
    const attempts = await db.prepare("SELECT locked_until FROM portal_login_attempts WHERE phone_normalized=?")
      .bind(attemptKey).all();
    const lockedUntil = attempts.results?.[0]?.locked_until;
    if (lockedUntil && new Date(String(lockedUntil)).getTime() > Date.now()) {
      return NextResponse.json({ error: "Too many attempts. Please try again after 15 minutes." }, { status: 429 });
    }

    const found = await db.prepare(
      "SELECT u.id,u.password_hash,u.password_salt,u.password_iterations FROM portal_users u LEFT JOIN customers c ON c.id=u.customer_id LEFT JOIN walkers w ON w.id=u.walker_id WHERE u.role=? AND u.phone_normalized=? AND u.is_active=1 AND ((u.role='customer' AND c.status='active') OR (u.role='walker' AND w.status='active')) LIMIT 1"
    ).bind(role, normalized).all();
    const user = found.results?.[0];
    const valid = !!user && await verifyPortalPassword(
      password,
      String(user.password_salt),
      String(user.password_hash),
      Number(user.password_iterations)
    );

    if (!valid) {
      await db.prepare(
        "INSERT INTO portal_login_attempts (phone_normalized,window_started_at,attempts) VALUES (?,datetime('now'),1) ON CONFLICT(phone_normalized) DO UPDATE SET attempts=CASE WHEN datetime(portal_login_attempts.window_started_at)<=datetime('now','-15 minutes') THEN 1 ELSE portal_login_attempts.attempts+1 END,window_started_at=CASE WHEN datetime(portal_login_attempts.window_started_at)<=datetime('now','-15 minutes') THEN datetime('now') ELSE portal_login_attempts.window_started_at END,locked_until=CASE WHEN datetime(portal_login_attempts.window_started_at)<=datetime('now','-15 minutes') THEN NULL WHEN portal_login_attempts.attempts+1>=5 THEN datetime('now','+15 minutes') ELSE portal_login_attempts.locked_until END"
      ).bind(attemptKey).run();
      const latest = await db.prepare("SELECT locked_until FROM portal_login_attempts WHERE phone_normalized=?").bind(attemptKey).all();
      const locked = latest.results?.[0]?.locked_until;
      if (locked && new Date(String(locked)).getTime() > Date.now()) {
        return NextResponse.json({ error: "Too many attempts. Please try again after 15 minutes." }, { status: 429 });
      }
      return NextResponse.json({ error: "Phone number or password is incorrect." }, { status: 401 });
    }

    await db.prepare("DELETE FROM portal_login_attempts WHERE phone_normalized=?").bind(attemptKey).run();
    const session = await createPortalSession(db, String(user.id));
    const response = NextResponse.json({ ok: true, role });
    setPortalCookie(response, session.token);
    return response;
  } catch {
    return NextResponse.json({ error: "Portal login is temporarily unavailable." }, { status: 503 });
  }
}
