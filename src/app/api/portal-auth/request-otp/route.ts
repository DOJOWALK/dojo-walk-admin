import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { isSameOrigin, PortalDB } from "@/lib/portal-auth";

type Env = { DB: PortalDB; MSG91_AUTHKEY?: string; MSG91_OTP_TEMPLATE_ID?: string; OTP_PEPPER?: string };

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Request origin is not allowed." }, { status: 403 });
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }

  const role = body.role === "walker" || body.role === "customer" ? body.role : null;
  const phone = typeof body.phone === "string" ? body.phone.trim() : "";
  const normalized = normalizeOtpPhone(phone);
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
      const phoneDigits = normalized.replace(/^\+91/, "");
      const phoneExpr = "CASE WHEN substr(clean_phone,1,2)='91' THEN substr(clean_phone,3) WHEN substr(clean_phone,1,1)='0' THEN substr(clean_phone,2) ELSE clean_phone END";
      const result = await db.prepare(
        "SELECT id,full_name AS name,phone,status FROM (SELECT id,full_name,phone,status,replace(replace(replace(replace(replace(phone,' ',''),'-',''),'(',''),')',''),'+','') AS clean_phone FROM customers) WHERE " + phoneExpr + "=? LIMIT 2"
      ).bind(phoneDigits).all();
      const rows = result.results || [];
      if (rows.length > 1) {
        return NextResponse.json({ error: "Is number par multiple customer records mile. Galat account link hone se bachane ke liye Admin support se sampark karein." }, { status: 409 });
      }
      if (rows.length === 1) {
        const customer = rows[0];
        if (String(customer.status).toLowerCase() !== "active") {
          return NextResponse.json({ error: "Is number ka existing customer record inactive hai. Admin support se sampark karein." }, { status: 403 });
        }
        const conflicting = await db.prepare("SELECT id FROM portal_users WHERE role='customer' AND phone_normalized=? AND customer_id<>? LIMIT 1").bind(normalized, String(customer.id)).all();
        if (conflicting.results?.length) {
          return NextResponse.json({ error: "Is mobile number se doosra portal account linked hai. Admin support se sampark karein." }, { status: 409 });
        }
        account = customer;
      } else {
        const existingPortal = await db.prepare("SELECT id FROM portal_users WHERE role='customer' AND phone_normalized=? LIMIT 1").bind(normalized).all();
        if (existingPortal.results?.length) {
          return NextResponse.json({ error: "Is mobile number ka portal link pehle se maujood hai. Admin support se sampark karein." }, { status: 409 });
        }
        const fullName = typeof body.full_name === "string" ? body.full_name.trim() : "";
        const address = typeof body.address === "string" ? body.address.trim() : "";
        const area = typeof body.area === "string" ? body.area.trim() : "";
        if (fullName.length < 2 || fullName.length > 100 || address.length < 5 || address.length > 500 || area.length > 100) {
          return NextResponse.json({ error: "Naye customer ke liye naam aur poora address bharna zaroori hai." }, { status: 400 });
        }
        await db.prepare("DELETE FROM portal_customer_registrations WHERE phone_normalized=? OR datetime(expires_at)<=datetime('now')").bind(normalized).run();
        const registrationId = crypto.randomUUID();
        await db.prepare("INSERT INTO portal_customer_registrations (id,phone_normalized,full_name,address,area,expires_at) VALUES (?,?,?,?,?,?)")
          .bind(registrationId, normalized, fullName, address, area || null, new Date(Date.now() + 15 * 60 * 1000).toISOString()).run();
        account = { id: "registration:" + registrationId, phone: normalized, name: fullName };
      }
    }

    if (!config.MSG91_AUTHKEY || !config.MSG91_OTP_TEMPLATE_ID || !config.OTP_PEPPER) {
      return NextResponse.json({ error: "MSG91 OTP service abhi configure nahi hai. Admin se sampark karein." }, { status: 503 });
    }

    const accountId = String(account.id);
    const phoneToText = normalized;
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

    const sendUrl = new URL("https://control.msg91.com/api/v5/otp");
    sendUrl.searchParams.set("template_id", config.MSG91_OTP_TEMPLATE_ID);
    sendUrl.searchParams.set("mobile", phoneToText.replace(/^\+/, ""));
    sendUrl.searchParams.set("otp", code);
    sendUrl.searchParams.set("otp_length", "6");
    sendUrl.searchParams.set("otp_expiry", "5");
    sendUrl.searchParams.set("realTimeResponse", "1");
    const smsResponse = await fetch(sendUrl, {
      method: "POST",
      headers: { authkey: config.MSG91_AUTHKEY, "Content-Type": "application/json" },
      body: JSON.stringify({})
    });
    const smsResult = await smsResponse.json().catch(() => null) as { type?: string; request_id?: string } | null;
    if (!smsResponse.ok || smsResult?.type !== "success") {
      await db.prepare("DELETE FROM portal_otp_challenges WHERE id=?").bind(challengeId).run();
      return NextResponse.json({ error: "MSG91 OTP SMS send nahi ho paya. MSG91 balance, Authkey aur approved template check karein." }, { status: 502 });
    }
    return NextResponse.json({ ok: true, challengeId, expiresInSeconds: 300 });
  } catch {
    return NextResponse.json({ error: "OTP service temporarily unavailable." }, { status: 503 });
  }
}

function normalizeOtpPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 10) return "+91" + digits;
  if (digits.length === 11 && digits.startsWith("0")) return "+91" + digits.slice(1);
  if (digits.length === 12 && digits.startsWith("91")) return "+" + digits;
  if (digits.length >= 10 && digits.length <= 15) return "+" + digits;
  return "";
}

async function hashOtp(pepper: string, id: string, code: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(pepper), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(id + ":" + code));
  return Array.from(new Uint8Array(signature), (b) => b.toString(16).padStart(2, "0")).join("");
}
