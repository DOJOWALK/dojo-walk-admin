import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getAdminCookieName, verifyAdminSession } from "@/lib/auth";

type D1Result = { results?: Record<string, unknown>[] };
type D1Statement = { bind(...values: unknown[]): { all(): Promise<D1Result>; run(): Promise<unknown> }; all(): Promise<D1Result>; run(): Promise<unknown> };
type D1DatabaseLike = { prepare(sql: string): D1Statement };
type Env = { DB: D1DatabaseLike; SESSION_SECRET?: string };

async function getAdminEnv() {
  const { env } = getCloudflareContext();
  const runtime = env as unknown as Env;
  const cookieStore = await cookies();
  const ok = await verifyAdminSession(cookieStore.get(getAdminCookieName())?.value, runtime.SESSION_SECRET);
  return ok ? runtime : null;
}

async function ensureWalkerTable(env: Env) {
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS walkers (
    id TEXT PRIMARY KEY,
    walker_code TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    mobile_number TEXT NOT NULL,
    local_address TEXT NOT NULL,
    permanent_address TEXT NOT NULL,
    aadhaar_received INTEGER NOT NULL DEFAULT 0,
    pan_received INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`).run();
}

export async function GET() {
  const env = await getAdminEnv();
  if (!env) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    await ensureWalkerTable(env);
    const result = await env.DB.prepare("SELECT * FROM walkers ORDER BY created_at DESC").all();
    await env.DB.prepare("CREATE TABLE IF NOT EXISTS walk_assignments (walk_id TEXT PRIMARY KEY REFERENCES walks(id) ON DELETE CASCADE, walker_id TEXT NOT NULL REFERENCES walkers(id), assigned_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)").run();
    const history = await env.DB.prepare("SELECT a.walker_id,w.id AS walk_id,w.booking_id,w.walk_date,w.slot,w.scheduled_time,w.duration_minutes,w.status,c.full_name AS customer_name,c.phone AS customer_phone,d.name AS dog_name FROM walk_assignments a JOIN walks w ON w.id=a.walk_id JOIN bookings b ON b.id=w.booking_id JOIN customers c ON c.id=b.customer_id JOIN dogs d ON d.id=w.dog_id ORDER BY w.walk_date DESC,w.scheduled_time DESC").all();
    return NextResponse.json({ walkers: result.results ?? [], walk_history: history.results ?? [] });
  } catch {
    return NextResponse.json({ error: "Walker records could not be loaded. Please try again." }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  const env = await getAdminEnv();
  if (!env) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  const fullName = typeof body.full_name === "string" ? body.full_name.trim() : "";
  const mobile = typeof body.mobile_number === "string" ? body.mobile_number.trim() : "";
  const localAddress = typeof body.local_address === "string" ? body.local_address.trim() : "";
  const permanentAddress = typeof body.permanent_address === "string" ? body.permanent_address.trim() : "";
  if (fullName.length < 2 || fullName.length > 100 || !/^[+0-9()\-\s]{7,20}$/.test(mobile) || !localAddress || !permanentAddress) {
    return NextResponse.json({ error: "Name, valid mobile number, local address and permanent address are required." }, { status: 400 });
  }
  const id = crypto.randomUUID();
  const walkerCode = "DW-" + id.replace(/-/g, "").slice(0, 6).toUpperCase();
  try {
    await ensureWalkerTable(env);
    await env.DB.prepare("INSERT INTO walkers (id, walker_code, full_name, mobile_number, local_address, permanent_address, aadhaar_received, pan_received) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
      .bind(id, walkerCode, fullName, mobile, localAddress, permanentAddress, body.aadhaar_received === true ? 1 : 0, body.pan_received === true ? 1 : 0).run();
    return NextResponse.json({ ok: true, id, walker_code: walkerCode }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Walker could not be registered. Please try again." }, { status: 503 });
  }
}

export async function PATCH(request: NextRequest) {
  const env = await getAdminEnv();
  if (!env) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  const id = typeof body.id === "string" ? body.id : "";
  if (!id) return NextResponse.json({ error: "Walker ID is required." }, { status: 400 });
  try {
    await ensureWalkerTable(env);
    if (body.action === "status") {
      const status = body.status === "inactive" ? "inactive" : "active";
      await env.DB.prepare("UPDATE walkers SET status=?, updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(status, id).run();
    } else {
      const fullName = typeof body.full_name === "string" ? body.full_name.trim() : "";
      const mobile = typeof body.mobile_number === "string" ? body.mobile_number.trim() : "";
      const localAddress = typeof body.local_address === "string" ? body.local_address.trim() : "";
      const permanentAddress = typeof body.permanent_address === "string" ? body.permanent_address.trim() : "";
      if (fullName.length < 2 || !/^[+0-9()\-\s]{7,20}$/.test(mobile) || !localAddress || !permanentAddress) {
        return NextResponse.json({ error: "Please complete all walker details with a valid mobile number." }, { status: 400 });
      }
      await env.DB.prepare("UPDATE walkers SET full_name=?, mobile_number=?, local_address=?, permanent_address=?, aadhaar_received=?, pan_received=?, updated_at=CURRENT_TIMESTAMP WHERE id=?")
        .bind(fullName, mobile, localAddress, permanentAddress, body.aadhaar_received === true ? 1 : 0, body.pan_received === true ? 1 : 0, id).run();
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Walker record could not be updated." }, { status: 503 });
  }
}
