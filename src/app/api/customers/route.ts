import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getAdminCookieName, verifyAdminSession } from "@/lib/auth";

type D1Result = { results?: unknown[] };
type D1DatabaseLike = { prepare(sql: string): { all(): Promise<D1Result>; bind(...values: unknown[]): { all(): Promise<D1Result>; run(): Promise<unknown> } } };
type Env = { DB: D1DatabaseLike; SESSION_SECRET?: string };

async function getAdminEnv() {
  const { env } = getCloudflareContext();
  const runtime = env as unknown as Env;
  const cookieStore = await cookies();
  const ok = await verifyAdminSession(cookieStore.get(getAdminCookieName())?.value, runtime.SESSION_SECRET);
  return ok ? runtime : null;
}

export async function GET() {
  const env = await getAdminEnv();
  if (!env) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const result = await env.DB.prepare(
      "SELECT c.*, (SELECT COUNT(*) FROM dogs d WHERE d.customer_id = c.id) AS dog_count FROM customers c ORDER BY c.created_at DESC"
    ).all();
    return NextResponse.json({ customers: result.results ?? [] });
  } catch {
    return NextResponse.json({ error: "Customer list is not available. Check D1 setup." }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  const env = await getAdminEnv();
  if (!env) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const fullName = typeof body.full_name === "string" ? body.full_name.trim() : "";
  const phone = typeof body.phone === "string" ? body.phone.trim() : "";
  const whatsapp = typeof body.whatsapp_phone === "string" ? body.whatsapp_phone.trim() : "";
  const source = ["whatsapp", "phone", "walk_in", "other"].includes(String(body.booking_source)) ? String(body.booking_source) : "whatsapp";
  if (fullName.length < 2 || fullName.length > 100 || !/^[+0-9()\-\s]{7,20}$/.test(phone)) {
    return NextResponse.json({ error: "Name and a valid phone number are required." }, { status: 400 });
  }
  const id = crypto.randomUUID();
  try {
    await env.DB.prepare(
      "INSERT INTO customers (id, full_name, phone, whatsapp_phone, address, area, notes, booking_source) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    ).bind(
      id, fullName, phone, whatsapp || null,
      typeof body.address === "string" ? body.address.trim() : null,
      typeof body.area === "string" ? body.area.trim() : null,
      typeof body.notes === "string" ? body.notes.trim() : null,
      source
    ).run();
    return NextResponse.json({ ok: true, id }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Customer could not be saved. Check database setup." }, { status: 503 });
  }
}

export async function PATCH(request: NextRequest) {
  const env = await getAdminEnv();
  if (!env) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  const id = typeof body.id === "string" ? body.id : "";
  const fullName = typeof body.full_name === "string" ? body.full_name.trim() : "";
  const phone = typeof body.phone === "string" ? body.phone.trim() : "";
  const whatsapp = typeof body.whatsapp_phone === "string" ? body.whatsapp_phone.trim() : "";
  const city = typeof body.city === "string" ? body.city.trim() : "";
  const state = typeof body.state === "string" ? body.state.trim() : "";
  const pincode = typeof body.pincode === "string" ? body.pincode.trim() : "";
  const flatTower = typeof body.flat_tower === "string" ? body.flat_tower.trim() : "";
  const society = typeof body.society === "string" ? body.society.trim() : "";
  const locality = typeof body.locality === "string" ? body.locality.trim() : "";
  const notes = typeof body.notes === "string" ? body.notes.trim().slice(0, 1000) : "";
  if (!id || fullName.length < 2 || fullName.length > 100 || !/^[+0-9()\\-\\s]{7,20}$/.test(phone)) {
    return NextResponse.json({ error: "Name and a valid mobile number are required." }, { status: 400 });
  }
  if (pincode && !/^\d{6}$/.test(pincode)) {
    return NextResponse.json({ error: "PIN code must contain six digits." }, { status: 400 });
  }
  const address = [flatTower, society].filter(Boolean).join(", ");
  const area = [locality, city, state, pincode].filter(Boolean).join(", ");
  try {
    const exists = await env.DB.prepare("SELECT id FROM customers WHERE id=?").bind(id).all();
    if (!exists.results?.length) return NextResponse.json({ error: "Customer not found." }, { status: 404 });
    await env.DB.prepare("UPDATE customers SET full_name=?,phone=?,whatsapp_phone=?,address=?,area=?,flat_tower=?,society=?,locality=?,city=?,state=?,pincode=?,notes=?,updated_at=CURRENT_TIMESTAMP WHERE id=?")
      .bind(fullName, phone, whatsapp || null, address || null, area || null, flatTower || null, society || null, locality || null, city, state, pincode, notes || null, id).run();
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Customer details could not be updated. Please try again." }, { status: 503 });
  }
}
