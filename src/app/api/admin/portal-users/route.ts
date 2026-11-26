import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getAdminCookieName, verifyAdminSession } from "@/lib/auth";
import { makePortalPassword, normalizePortalPhone, PortalDB } from "@/lib/portal-auth";

type Env = { DB: PortalDB; SESSION_SECRET?: string };

async function adminDB() {
  const { env } = getCloudflareContext();
  const runtime = env as unknown as Env;
  const jar = await cookies();
  const ok = await verifyAdminSession(jar.get(getAdminCookieName())?.value, runtime.SESSION_SECRET);
  return ok ? runtime.DB : null;
}

export async function GET() {
  const db = await adminDB();
  if (!db) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const result = await db.prepare(
      "SELECT id,name,phone,role,customer_id,walker_id,is_active,created_at,updated_at FROM portal_users ORDER BY created_at DESC"
    ).all();
    return NextResponse.json({ accounts: result.results ?? [] });
  } catch {
    return NextResponse.json({ error: "Portal account tables are not installed yet. Apply the reviewed database migration first." }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  const db = await adminDB();
  if (!db) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  const role = body.role === "walker" || body.role === "customer" ? body.role : null;
  const entityId = typeof body.entity_id === "string" ? body.entity_id.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!role || !entityId || password.length < 12 || password.length > 128) {
    return NextResponse.json({ error: "Choose a customer or walker, and set a 12–128 character temporary password." }, { status: 400 });
  }

  try {
    const source = role === "customer"
      ? await db.prepare("SELECT id,full_name AS name,phone,status FROM customers WHERE id=?").bind(entityId).all()
      : await db.prepare("SELECT id,full_name AS name,mobile_number AS phone,status FROM walkers WHERE id=?").bind(entityId).all();
    const entity = source.results?.[0];
    if (!entity || entity.status !== "active") return NextResponse.json({ error: "Select an existing active record." }, { status: 404 });
    const phone = String(entity.phone || "");
    const normalized = normalizePortalPhone(phone);
    if (!/^[+0-9]{7,15}$/.test(normalized)) {
      return NextResponse.json({ error: "The linked record needs a valid phone number before portal access can be enabled." }, { status: 400 });
    }
    const passwordData = await makePortalPassword(password);
    const id = crypto.randomUUID();
    await db.prepare(
      "INSERT INTO portal_users (id,name,phone,phone_normalized,role,customer_id,walker_id,password_hash,password_salt,password_iterations) VALUES (?,?,?,?,?,?,?,?,?,?)"
    ).bind(
      id, String(entity.name), phone, normalized, role,
      role === "customer" ? entityId : null,
      role === "walker" ? entityId : null,
      passwordData.password_hash, passwordData.password_salt, passwordData.password_iterations
    ).run();
    return NextResponse.json({ ok: true, id, role }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Account could not be created. It may already exist for this record or phone number." }, { status: 409 });
  }
}

export async function PATCH(request: NextRequest) {
  const db = await adminDB();
  if (!db) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  const id = typeof body.id === "string" ? body.id : "";
  const action = body.action;
  if (!id || !["enable", "disable", "reset_password"].includes(String(action))) {
    return NextResponse.json({ error: "Choose a valid account action." }, { status: 400 });
  }
  try {
    if (action === "reset_password") {
      const password = typeof body.password === "string" ? body.password : "";
      if (password.length < 12 || password.length > 128) return NextResponse.json({ error: "Temporary password must be 12–128 characters." }, { status: 400 });
      const passwordData = await makePortalPassword(password);
      const result = await db.prepare(
        "UPDATE portal_users SET password_hash=?,password_salt=?,password_iterations=?,updated_at=CURRENT_TIMESTAMP WHERE id=?"
      ).bind(passwordData.password_hash, passwordData.password_salt, passwordData.password_iterations, id).run();
      if ((result as { meta?: { changes?: number } }).meta?.changes === 0) return NextResponse.json({ error: "Account not found." }, { status: 404 });
      await db.prepare("UPDATE portal_sessions SET revoked_at=CURRENT_TIMESTAMP WHERE user_id=? AND revoked_at IS NULL").bind(id).run();
    } else {
      const active = action === "enable" ? 1 : 0;
      const result = await db.prepare("UPDATE portal_users SET is_active=?,updated_at=CURRENT_TIMESTAMP WHERE id=?")
        .bind(active, id).run();
      if ((result as { meta?: { changes?: number } }).meta?.changes === 0) return NextResponse.json({ error: "Account not found." }, { status: 404 });
      if (!active) await db.prepare("UPDATE portal_sessions SET revoked_at=CURRENT_TIMESTAMP WHERE user_id=? AND revoked_at IS NULL").bind(id).run();
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Portal account could not be updated." }, { status: 503 });
  }
}
