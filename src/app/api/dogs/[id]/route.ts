import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getAdminCookieName, verifyAdminSession } from "@/lib/auth";

type Result = { results?: Array<Record<string, unknown>> };
type DBLike = { prepare(sql: string): { all(): Promise<Result>; bind(...values: unknown[]): { all(): Promise<Result> } } };
type Env = { DB: DBLike; SESSION_SECRET?: string };

async function adminEnv() {
  const { env } = getCloudflareContext();
  const runtime = env as unknown as Env;
  const jar = await cookies();
  const valid = await verifyAdminSession(jar.get(getAdminCookieName())?.value, runtime.SESSION_SECRET);
  return valid ? runtime : null;
}

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const env = await adminEnv();
  if (!env) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await context.params;
  try {
    const dogResult = await env.DB.prepare(
      "SELECT d.*,c.full_name AS customer_name,c.phone AS customer_phone,c.whatsapp_phone,c.flat_tower,c.society,c.locality,c.city,c.state,c.pincode,c.address,c.area FROM dogs d JOIN customers c ON c.id=d.customer_id WHERE d.id=?"
    ).bind(id).all();
    const dog = dogResult.results?.[0];
    if (!dog) return NextResponse.json({ error: "Dog not found." }, { status: 404 });
    const bookings = await env.DB.prepare(
      "SELECT b.*,COALESCE((SELECT COUNT(*) FROM walks w WHERE w.booking_id=b.id AND w.status='completed' AND w.walk_date>=COALESCE(b.billing_start_date,b.start_date)),0) AS completed_walks,COALESCE((SELECT COUNT(*) FROM walks w WHERE w.booking_id=b.id AND w.status='completed' AND w.walk_date>=COALESCE(b.billing_start_date,b.start_date)),0)*b.price_per_walk_inr AS accrued_inr,COALESCE((SELECT SUM(p.amount_inr) FROM payments p WHERE p.booking_id=b.id AND p.payment_date>=COALESCE(b.billing_start_date,b.start_date)),0) AS paid_inr,MAX(0,COALESCE((SELECT COUNT(*) FROM walks w WHERE w.booking_id=b.id AND w.status='completed' AND w.walk_date>=COALESCE(b.billing_start_date,b.start_date)),0)*b.price_per_walk_inr-COALESCE((SELECT SUM(p.amount_inr) FROM payments p WHERE p.booking_id=b.id AND p.payment_date>=COALESCE(b.billing_start_date,b.start_date)),0)) AS due_inr FROM bookings b WHERE b.dog_id=? ORDER BY b.start_date DESC"
    ).bind(id).all();
    const walks = await env.DB.prepare(
      "SELECT w.*,b.walk_duration_minutes,b.price_per_walk_inr FROM walks w JOIN bookings b ON b.id=w.booking_id WHERE w.dog_id=? ORDER BY w.walk_date DESC,CASE w.slot WHEN 'morning' THEN 0 ELSE 1 END LIMIT 100"
    ).bind(id).all();
    return NextResponse.json({ dog, bookings: bookings.results ?? [], walks: walks.results ?? [] });
  } catch {
    return NextResponse.json({ error: "Dog profile could not be loaded. Check D1 setup." }, { status: 503 });
  }
}
