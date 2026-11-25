import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getAdminCookieName, verifyAdminSession } from "@/lib/auth";

type Result = { results?: unknown[] };
type DBLike = { prepare(sql: string): { all(): Promise<Result>; bind(...values: unknown[]): { all(): Promise<Result>; run(): Promise<unknown> } } };
type Env = { DB: DBLike; SESSION_SECRET?: string };

async function adminEnv() {
  const { env } = getCloudflareContext();
  const runtime = env as unknown as Env;
  const jar = await cookies();
  const valid = await verifyAdminSession(jar.get(getAdminCookieName())?.value, runtime.SESSION_SECRET);
  return valid ? runtime : null;
}

export async function GET() {
  const env = await adminEnv();
  if (!env) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const result = await env.DB.prepare(
      "SELECT d.*, c.full_name AS customer_name, c.phone AS customer_phone FROM dogs d JOIN customers c ON c.id = d.customer_id ORDER BY d.created_at DESC"
    ).all();
    return NextResponse.json({ dogs: result.results ?? [] });
  } catch {
    return NextResponse.json({ error: "Dog list is not available. Check D1 setup." }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  const env = await adminEnv();
  if (!env) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  const customerId = typeof body.customer_id === "string" ? body.customer_id : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!customerId || name.length < 1 || name.length > 80) return NextResponse.json({ error: "Select a customer and enter the dog's name." }, { status: 400 });
  const id = crypto.randomUUID();
  try {
    const owner = await env.DB.prepare("SELECT id FROM customers WHERE id = ?").bind(customerId).all();
    if (!owner.results?.length) return NextResponse.json({ error: "Customer not found." }, { status: 404 });
    await env.DB.prepare(
      "INSERT INTO dogs (id, customer_id, name, breed, age_text, size, temperament, medical_notes, emergency_notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ).bind(id, customerId, name, body.breed || null, body.age_text || null, body.size || null, body.temperament || null, body.medical_notes || null, body.emergency_notes || null).run();
    return NextResponse.json({ ok: true, id }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Dog could not be saved. Check database setup." }, { status: 503 });
  }
}
 
export async function PATCH(request: NextRequest) {
  const env = await adminEnv();
  if (!env) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  const id = typeof body.id === "string" ? body.id : "";
  const customerId = typeof body.customer_id === "string" ? body.customer_id : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const breed = typeof body.breed === "string" ? body.breed.trim() : "";
  const age = typeof body.age_text === "string" ? body.age_text.trim() : "";
  const size = String(body.size || "");
  const gender = String(body.gender || "");
  const temperament = String(body.temperament || "");
  if (!id || !customerId || !name || name.length > 80) return NextResponse.json({ error: "Dog name is required." }, { status: 400 });
  if (size && !["Small","Medium","Large","Extra Large"].includes(size)) return NextResponse.json({ error: "Choose a valid dog size." }, { status: 400 });
  if (gender && !["Male","Female"].includes(gender)) return NextResponse.json({ error: "Choose a valid gender." }, { status: 400 });
  if (temperament && !["Friendly","Shy","Energetic","Calm","Anxious","Reactive","Other"].includes(temperament)) return NextResponse.json({ error: "Choose a valid temperament." }, { status: 400 });
  try {
    const found = await env.DB.prepare("SELECT id FROM dogs WHERE id=? AND customer_id=?").bind(id, customerId).all();
    if (!found.results?.length) return NextResponse.json({ error: "Dog not found for this customer." }, { status: 404 });
    await env.DB.prepare("UPDATE dogs SET name=?,breed=?,age_text=?,size=?,gender=?,temperament=?,medical_notes=?,emergency_notes=? WHERE id=? AND customer_id=?")
      .bind(name, breed || null, age || null, size || null, gender || null, temperament || null,
        typeof body.medical_notes === "string" ? body.medical_notes.trim() || null : null,
        typeof body.emergency_notes === "string" ? body.emergency_notes.trim() || null : null, id, customerId).run();
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Dog details could not be updated. Please try again." }, { status: 503 });
  }
}
