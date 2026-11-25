import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getAdminCookieName, verifyAdminSession } from "@/lib/auth";

type Statement = { bind(...values: unknown[]): Statement; all(): Promise<{results?: unknown[]}>; run(): Promise<unknown> };
type DBLike = { prepare(sql: string): Statement; batch(statements: Statement[]): Promise<unknown[]> };
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
  if (!env) return NextResponse.json({error:"Unauthorized"},{status:401});
  try {
    const result = await env.DB.prepare(
      "SELECT p.*, c.full_name AS customer_name, d.name AS dog_name FROM payments p JOIN customers c ON c.id=p.customer_id LEFT JOIN bookings b ON b.id=p.booking_id LEFT JOIN dogs d ON d.id=b.dog_id ORDER BY p.payment_date DESC, p.created_at DESC"
    ).all();
    return NextResponse.json({payments:result.results ?? []});
  } catch {
    return NextResponse.json({error:"Payments are not available. Check D1 setup."},{status:503});
  }
}

export async function POST(request: NextRequest) {
  const env = await adminEnv();
  if (!env) return NextResponse.json({error:"Unauthorized"},{status:401});
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return NextResponse.json({error:"Invalid request."},{status:400}); }
  const bookingId = typeof body.booking_id === "string" ? body.booking_id : "";
  const amount = Number(body.amount_inr);
  const method = ["cash","upi","bank","other"].includes(String(body.payment_method)) ? String(body.payment_method) : "upi";
  const date = typeof body.payment_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.payment_date) ? body.payment_date : new Date().toISOString().slice(0,10);
  const note = typeof body.reference_note === "string" ? body.reference_note.trim().slice(0,250) : "";
  if (!bookingId || !Number.isSafeInteger(amount) || amount <= 0 || amount > 10000000) return NextResponse.json({error:"Select a booking and enter a valid payment amount."},{status:400});
  try {
    const result = await env.DB.prepare(
      "SELECT b.id,b.customer_id,b.price_per_walk_inr,COALESCE((SELECT COUNT(*) FROM walks w WHERE w.booking_id=b.id AND w.status='completed' AND w.walk_date>=COALESCE(b.billing_start_date,b.start_date)),0) AS completed_walks,COALESCE((SELECT SUM(p.amount_inr) FROM payments p WHERE p.booking_id=b.id AND p.payment_date>=COALESCE(b.billing_start_date,b.start_date)),0) AS paid_inr FROM bookings b WHERE b.id=? AND b.status!='cancelled'"
    ).bind(bookingId).all();
    const booking = result.results?.[0] as {id:string;customer_id:string;price_per_walk_inr:number;completed_walks:number;paid_inr:number} | undefined;
    if (!booking) return NextResponse.json({error:"Booking not found or cancelled."},{status:404});
    const due = Math.max(0, booking.completed_walks * booking.price_per_walk_inr - booking.paid_inr);
    if (amount > due) return NextResponse.json({error:`Amount exceeds the completed-walk balance of ₹${due}.`},{status:400});
    const paymentId = crypto.randomUUID();
    await env.DB.prepare("INSERT INTO payments (id,customer_id,booking_id,amount_inr,payment_date,payment_method,reference_note) VALUES (?,?,?,?,?,?,?)").bind(paymentId,booking.customer_id,bookingId,amount,date,method,note || null).run();
    return NextResponse.json({ok:true,id:paymentId,received_inr:amount,balance_inr:due-amount},{status:201});
  } catch {
    return NextResponse.json({error:"Payment could not be saved. Apply migration 0004 and retry."},{status:503});
  }
}