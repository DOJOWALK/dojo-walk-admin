import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getAdminCookieName, verifyAdminSession } from "@/lib/auth";

type Result = { results?: unknown[] };
type DBLike = { prepare(sql: string): { bind(...values: unknown[]): { all(): Promise<Result>; run(): Promise<unknown> } } };
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