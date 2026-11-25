import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getAdminCookieName, verifyAdminSession } from "@/lib/auth";

type Statement = { bind(...values: unknown[]): Statement; all(): Promise<{ results?: Array<Record<string, unknown>> }> };
type DBLike = { prepare(sql: string): Statement };
type Env = { DB: DBLike; SESSION_SECRET?: string };

async function adminEnv() {
  const { env } = getCloudflareContext();
  const runtime = env as unknown as Env;
  const jar = await cookies();
  return await verifyAdminSession(jar.get(getAdminCookieName())?.value, runtime.SESSION_SECRET) ? runtime : null;
}

export async function GET() {
  const env = await adminEnv();
  if (!env) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
  try {
    const [counts, walks, slots, dues, payments, expenses, recentBookings, recentPayments] = await Promise.all([
      env.DB.prepare("SELECT (SELECT COUNT(*) FROM customers) AS customers, (SELECT COUNT(*) FROM dogs) AS dogs, (SELECT COUNT(*) FROM bookings WHERE status='active') AS active, (SELECT COUNT(*) FROM bookings WHERE status='paused') AS paused, (SELECT COUNT(*) FROM bookings WHERE status='active' AND end_date IS NOT NULL AND end_date BETWEEN ? AND date(?, '+7 days')) AS ending_soon").bind(today, today).all(),
      env.DB.prepare("SELECT COUNT(*) AS total, SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END) AS completed, SUM(CASE WHEN status='scheduled' THEN 1 ELSE 0 END) AS scheduled, SUM(CASE WHEN status='missed' THEN 1 ELSE 0 END) AS missed FROM walks WHERE walk_date=? AND status!='cancelled'").bind(today).all(),
      env.DB.prepare("SELECT slot, COUNT(*) AS total, SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END) AS completed, SUM(CASE WHEN status='scheduled' THEN 1 ELSE 0 END) AS scheduled FROM walks WHERE walk_date=? AND status!='cancelled' GROUP BY slot").bind(today).all(),
      env.DB.prepare("SELECT COALESCE(SUM(MAX(accrued-paid,0)),0) AS total, SUM(CASE WHEN MAX(accrued-paid,0)>0 THEN 1 ELSE 0 END) AS bookings_due FROM (SELECT b.id, COALESCE((SELECT COUNT(*) FROM walks w WHERE w.booking_id=b.id AND w.status='completed' AND w.walk_date>=COALESCE(b.billing_start_date,b.start_date)),0)*b.price_per_walk_inr AS accrued, COALESCE((SELECT SUM(p.amount_inr) FROM payments p WHERE p.booking_id=b.id AND p.payment_date>=COALESCE(b.billing_start_date,b.start_date)),0) AS paid FROM bookings b WHERE b.status NOT IN ('cancelled'))").all(),
      env.DB.prepare("SELECT COALESCE(SUM(amount_inr),0) AS total, COUNT(*) AS count FROM payments WHERE payment_date=?").bind(today).all(),
      env.DB.prepare("SELECT COALESCE(SUM(amount_inr),0) AS total, COUNT(*) AS count FROM expenses WHERE expense_date=?").bind(today).all(),
      env.DB.prepare("SELECT b.id,b.created_at,c.full_name AS customer_name,d.name AS dog_name,b.status FROM bookings b JOIN customers c ON c.id=b.customer_id JOIN dogs d ON d.id=b.dog_id ORDER BY b.created_at DESC LIMIT 5").all(),
      env.DB.prepare("SELECT p.id,p.payment_date,p.amount_inr,c.full_name AS customer_name FROM payments p JOIN customers c ON c.id=p.customer_id ORDER BY p.payment_date DESC,p.created_at DESC LIMIT 5").all()
    ]);
    return NextResponse.json({
      date: today,
      counts: counts.results?.[0] ?? {},
      walks: walks.results?.[0] ?? {},
      slots: slots.results ?? [],
      dues: dues.results?.[0] ?? {},
      payments: payments.results?.[0] ?? {},
      expenses: expenses.results?.[0] ?? {},
      recent_bookings: recentBookings.results ?? [],
      recent_payments: recentPayments.results ?? []
    });
  } catch {
    return NextResponse.json({ error: "Dashboard data could not be loaded. Please check the D1 database and migrations." }, { status: 503 });
  }
}
