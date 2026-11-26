import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { isSameOrigin, normalizePortalPhone, PortalDB } from "@/lib/portal-auth";

type SmsBinding = { fetch(request: Request): Promise<Response> };
type Env = { DB: PortalDB; SMS_OTP?: SmsBinding; OTP_PEPPER?: string };

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Request origin is not allowed." }, { status: 403 });
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }

  const role = body.role === "walker" || body.role === "customer" ? body.role : null;
  const phone = typeof body.phone === "string" ? body.phone.trim() : "";
  const normalized = normalizePortalPhone(phone);
  if (!role || !/^\+?[0-9]{10,15}$/.test(normalized)) {
    return NextResponse.json({ error: "Sahi mobile number enter karein." }, { status: 400 });
  }

  const { env } = getCloudflareContext();
  const config = env as unknown as Env;
  const db = config.DB;
  try {
    let account: Record<string, unknown> | undefined;
    if (role === "walker") {
      const result = await db.prepare(
        "SELECT id, mobile_number AS phone FROM walkers WHERE replace(replace(replace(replace(replace(mobile_number,' ',''),'-',''),'(',''),')',''),'+91','')=? LIMIT 2"
      ).bind(normalized.replace(/^\+91/, "")).all();
      const rows = result.results || [];
      if (rows.length !== 1) {
        return NextResponse.json({ error: "Yeh mobile number Dojo Walk mein Walker ke roop mein registered nahi hai. Admin se sampark karein." }, { status: 404 });
      }
      account = rows[0];
    } else {
      const result = await db.prepare(
        "SELECT id, phone FROM customers WHERE replace(replace(replace(replace(replace(phone,' ',''),'-',''),'(',''),')',''),'+91','')=? LIMIT 2"
      ).bind(normalized.replace(/^\+91/, "")).all();
      const rows = result.results || [];
      if (rows.length !== 1) {
        return NextResponse.json({ error: rows.length > 1 ? "Is number par multiple customer records mile. Admin support se sampark karein." : "Yeh mobile number registered customer record se match nahi hua. Pehle customer registration complete karein." }, { status: 404 });
      }
      account = rows[0];
    }

    if (!config.SMS_OTP || !config.OTP_PEPPER) {
      return NextResponse.json({ error: "OTP SMS service abhi configure nahi hai. Admin se sampark karein." }, { status: 503 });
    }

    const accountId = String(account.id);
    const phoneToText = String(account.phone || "");
    const limit = await db.prepare(
      "SELECT sends, window_started_at FROM portal_otp_send_limits WHERE role=? AND phone_normalized=?"
    ).bind(role, normalized).all();
    const limitRow = limit.results?.[0];
    if (limitRow && new Date(String(limitRow.window_started_at) + "Z").getTime() > Date.now() - 15 * 60 * 1000 && Number(limitRow.sends) >= 3) {
      return NextResponse.json({ error: "OTP limit poori ho gayi. 15 minute baad dobara try karein." }, { status: 429 });
    }

    const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1000000).padStart(6, "0");
    await db.prepare("UPDATE portal_otp_challenges SET consumed_at=datetime('now') WHERE role=? AND phone_normalized=? AND consumed_at IS NULL").bind(role, normalized).run();
    const challengeId = crypto.randomUUID();
    const codeHash = await hashOtp(config.OTP_PEPPER, challengeId, code);
    await db.prepare(
      "INSERT INTO portal_otp_challenges (id,role,phone_normalized,account_id,code_hash,expires_at) VALUES (?,?,?,?,?,?)"
    ).bind(challengeId, role, normalized, accountId, codeHash, new Date(Date.now() + 5 * 60 * 1000).toISOString()).run();
    await db.prepare(
      "INSERT INTO portal_otp_send_limits (role,phone_normalized,window_started_at,sends) VALUES (?,?,datetime('now'),1) ON CONFLICT(role,phone_normalized) DO UPDATE SET sends=CASE WHEN datetime(window_started_at)<=datetime('now','-15 minutes') THEN 1 ELSE sends+1 END,window_started_at=CASE WHEN datetime(window_started_at)<=datetime('now','-15 minutes') THEN datetime('now') ELSE window_started_at END"
    ).bind(role, normalized).run();

    const smsResponse = await config.SMS_OTP.fetch(new Request("https://sms-otp.internal/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to: phoneToText, code, role, expires_in_minutes: 5, template: "dojo_walk_login_otp" })
    }));
    if (!smsResponse.ok) {
      await db.prepare("DELETE FROM portal_otp_challenges WHERE id=?").bind(challengeId).run();
      return NextResponse.json({ error: "OTP SMS deliver nahi ho paya. Thodi der baad try karein." }, { status: 502 });
    }
    return NextResponse.json({ ok: true, challengeId, expiresInSeconds: 300 });
  } catch {
    return NextResponse.json({ error: "OTP service temporarily unavailable." }, { status: 503 });
  }
}

async function hashOtp(pepper: string, id: string, code: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(pepper), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(id + ":" + code));
  return Array.from(new Uint8Array(signature), (b) => b.toString(16).padStart(2, "0")).join("");
}
