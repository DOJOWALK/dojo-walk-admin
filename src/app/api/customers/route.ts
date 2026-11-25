import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getAdminCookieName, verifyAdminSession } from "@/lib/auth";

type Env = { DB: D1Database; SESSION_SECRET?: string };

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