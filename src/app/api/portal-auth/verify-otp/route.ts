import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createPortalSession, isSameOrigin, PortalDB, setPortalCookie } from "@/lib/portal-auth";

type Env = { DB: PortalDB & { batch(statements: unknown[]): Promise<unknown[]> }; MSG91_AUTHKEY?: string; OTP_PEPPER?: string };

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Request origin is not allowed." }, { status: 403 });
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  const role = body.role === "walker" || body.role === "customer" ? body.role : null;
  const phone = typeof body.phone === "string" ? normalizeOtpPhone(body.phone) : "";
  const challengeId = typeof body.challengeId === "string" ? body.challengeId : "";
  const code = typeof body.code === "string" ? body.code.trim() : "";
  if (!role || !/^\+?[0-9]{10,15}$/.test(phone) || !/^[0-9]{6}$/.test(code) || !/^[0-9a-f-]{36}$/i.test(challengeId)) {
    return NextResponse.json({ error: "OTP details sahi enter karein." }, { status: 400 });
  }

  const { env } = getCloudflareContext();
  const config = env as unknown as Env;
  if (!config.OTP_PEPPER || !config.MSG91_AUTHKEY) return NextResponse.json({ error: "MSG91 OTP service configure nahi hai." }, { status: 503 });
  const db = config.DB;

  try {
    const result = await db.prepare(
      "SELECT id,account_id,code_hash,expires_at,attempts FROM portal_otp_challenges WHERE id=? AND role=? AND phone_normalized=? AND consumed_at IS NULL LIMIT 1"
    ).bind(challengeId, role, phone).all();
    const challenge = result.results?.[0];
    if (!challenge || new Date(String(challenge.expires_at)).getTime() <= Date.now() || Number(challenge.attempts) >= 5) {
      return NextResponse.json({ error: "OTP expire ho gaya hai. Naya OTP mangwayein." }, { status: 400 });
    }
    const expected = await hashOtp(config.OTP_PEPPER, challengeId, code);
    if (!constantTimeEqual(expected, String(challenge.code_hash))) {
      await db.prepare("UPDATE portal_otp_challenges SET attempts=attempts+1 WHERE id=? AND attempts<5").bind(challengeId).run();
      return NextResponse.json({ error: "OTP galat hai. Dobara check karein." }, { status: 401 });
    }

    const verifyUrl = new URL("https://control.msg91.com/api/v5/otp/verify");
    verifyUrl.searchParams.set("otp", code);
    verifyUrl.searchParams.set("mobile", phone.replace(/^\+/, ""));
    const msg91Response = await fetch(verifyUrl, { headers: { authkey: config.MSG91_AUTHKEY } });
    const msg91Result = await msg91Response.json().catch(() => null) as { type?: string } | null;
    if (!msg91Response.ok || msg91Result?.type !== "success") {
      await db.prepare("UPDATE portal_otp_challenges SET attempts=attempts+1 WHERE id=? AND attempts<5").bind(challengeId).run();
      return NextResponse.json({ error: "MSG91 OTP verify nahi hua. OTP dobara check karein." }, { status: 401 });
    }

    const consumed = await db.prepare("UPDATE portal_otp_challenges SET consumed_at=datetime('now') WHERE id=? AND consumed_at IS NULL AND attempts<5 AND datetime(expires_at)>datetime('now') RETURNING id").bind(challengeId).all();
    if (!consumed.results?.length) {
      return NextResponse.json({ error: "OTP pehle use ho chuka hai ya expire ho gaya. Naya OTP mangwayein." }, { status: 409 });
    }
    let portalUser: Record<string, unknown> | undefined;
    let status = "";
    if (role === "walker") {
      const walker = await db.prepare(
        "SELECT w.id,w.status,ep.employment_status FROM walkers w LEFT JOIN walker_employment_profiles ep ON ep.walker_id=w.id WHERE w.id=? LIMIT 1"
      ).bind(String(challenge.account_id)).all();
      const row = walker.results?.[0];
      if (!row) return NextResponse.json({ error: "Walker record nahi mila. Admin se sampark karein." }, { status: 404 });
      const currentWalkerPhone = await db.prepare(
        "SELECT id FROM (SELECT id,replace(replace(replace(replace(replace(mobile_number,' ',''),'-',''),'(',''),')',''),'+','') AS clean_phone FROM walkers) WHERE CASE WHEN substr(clean_phone,1,2)='91' THEN substr(clean_phone,3) WHEN substr(clean_phone,1,1)='0' THEN substr(clean_phone,2) ELSE clean_phone END=? AND id=? LIMIT 1"
      ).bind(phone.replace(/^\+91/, ""), String(challenge.account_id)).all();
      if (!currentWalkerPhone.results?.length) {
        return NextResponse.json({ error: "Walker mobile number record change hua hai. Admin se dobara verify karwayein." }, { status: 409 });
      }
      status = String(row.employment_status || row.status || "active").toLowerCase();
      if (status !== "active" || String(row.status).toLowerCase() !== "active") {
        return NextResponse.json({ error: statusMessage(status, String(row.status)) }, { status: 403 });
      }
      const found = await db.prepare("SELECT id FROM portal_users WHERE role='walker' AND walker_id=? AND is_active=1 LIMIT 1").bind(String(challenge.account_id)).all();
      portalUser = found.results?.[0];
    } else {
      if (String(challenge.account_id).startsWith("registration:")) {
        const registrationId = String(challenge.account_id).slice("registration:".length);
        const pending = await db.prepare("SELECT id,phone_normalized,full_name,address,area FROM portal_customer_registrations WHERE id=? AND phone_normalized=? AND datetime(expires_at)>datetime('now') LIMIT 1")
          .bind(registrationId, phone).all();
        const registration = pending.results?.[0];
        if (!registration) return NextResponse.json({ error: "Registration details expire ho gaye. Dobara register karke OTP mangwayein." }, { status: 400 });

        const phoneDigits = phone.replace(/^\+91/, "");
        const matches = await findCustomersByPhone(db, phoneDigits);
        if (matches.length > 1) return NextResponse.json({ error: "Is number par multiple customer records mile. Admin support se sampark karein." }, { status: 409 });
        let customerId: string;
        let customerName: string;
        let customerPhone: string;
        if (matches.length === 1) {
          const matched = matches[0];
          if (String(matched.status).toLowerCase() !== "active") return NextResponse.json({ error: "Existing customer record inactive hai. Admin support se sampark karein." }, { status: 403 });
          customerId = String(matched.id);
          customerName = String(matched.full_name);
          customerPhone = String(matched.phone);
        } else {
          customerId = crypto.randomUUID();
          customerName = String(registration.full_name);
          customerPhone = phone;
        }
        const linked = await db.prepare("SELECT id,is_active FROM portal_users WHERE role='customer' AND customer_id=? LIMIT 1").bind(customerId).all();
        const linkedUser = linked.results?.[0];
        const phoneConflict = await db.prepare("SELECT id FROM portal_users WHERE role='customer' AND phone_normalized=? AND (? IS NULL OR id<>?) LIMIT 1")
          .bind(phone, linkedUser ? String(linkedUser.id) : null, linkedUser ? String(linkedUser.id) : null).all();
        if (phoneConflict.results?.length) return NextResponse.json({ error: "Is mobile number se doosra portal account linked hai. Admin support se sampark karein." }, { status: 409 });
        if (linkedUser) {
          if (Number(linkedUser.is_active) !== 1) return NextResponse.json({ error: "Customer portal account disabled hai. Admin support se sampark karein." }, { status: 403 });
          await db.prepare("UPDATE portal_users SET name=?,phone=?,phone_normalized=?,updated_at=CURRENT_TIMESTAMP WHERE id=?")
            .bind(customerName, customerPhone, phone, String(linkedUser.id)).run();
          portalUser = linkedUser;
        } else {
          const portalUserId = crypto.randomUUID();
          const placeholderHash = toHex(crypto.getRandomValues(new Uint8Array(32)));
          const placeholderSalt = toHex(crypto.getRandomValues(new Uint8Array(16)));
          const statements = matches.length === 0 ? [
            db.prepare("INSERT INTO customers (id,full_name,phone,address,area,booking_source,status) VALUES (?,?,?,?,?,'phone','active')")
              .bind(customerId, customerName, customerPhone, String(registration.address), registration.area == null ? null : String(registration.area)),
            db.prepare("INSERT INTO portal_users (id,name,phone,phone_normalized,role,customer_id,walker_id,password_hash,password_salt,password_iterations,is_active) VALUES (?,?,?,?,'customer',?,NULL,?,?,210000,1)")
              .bind(portalUserId, customerName, customerPhone, phone, customerId, placeholderHash, placeholderSalt)
          ] : [
            db.prepare("INSERT INTO portal_users (id,name,phone,phone_normalized,role,customer_id,walker_id,password_hash,password_salt,password_iterations,is_active) VALUES (?,?,?,?,'customer',?,NULL,?,?,210000,1)")
              .bind(portalUserId, customerName, customerPhone, phone, customerId, placeholderHash, placeholderSalt)
          ];
          try {
            await db.batch(statements);
          } catch {
            return NextResponse.json({ error: "Customer account create/link nahi ho paya. Admin support se sampark karein." }, { status: 409 });
          }
          portalUser = { id: portalUserId };
        }
        await db.prepare("DELETE FROM portal_customer_registrations WHERE id=?").bind(registrationId).run();
      } else {
        const customer = await db.prepare("SELECT id,full_name,phone,status FROM customers WHERE id=? LIMIT 1").bind(String(challenge.account_id)).all();
        const row = customer.results?.[0];
        if (!row || String(row.status).toLowerCase() !== "active") {
          return NextResponse.json({ error: "Customer account active nahi hai. Admin support se sampark karein." }, { status: 403 });
        }
        const currentMatches = await findCustomersByPhone(db, phone.replace(/^\+91/, ""));
        if (currentMatches.length !== 1 || String(currentMatches[0].id) !== String(challenge.account_id)) {
          return NextResponse.json({ error: "Customer mobile record change hua hai ya duplicate match mila. Admin support se sampark karein." }, { status: 409 });
        }
        const found = await db.prepare("SELECT id,is_active FROM portal_users WHERE role='customer' AND customer_id=? LIMIT 1").bind(String(challenge.account_id)).all();
        const existing = found.results?.[0];
        const conflict = await db.prepare("SELECT id FROM portal_users WHERE role='customer' AND phone_normalized=? AND (? IS NULL OR id<>?) LIMIT 1")
          .bind(phone, existing ? String(existing.id) : null, existing ? String(existing.id) : null).all();
        if (conflict.results?.length) return NextResponse.json({ error: "Is mobile number se doosra portal account linked hai. Admin support se sampark karein." }, { status: 409 });
        if (existing) {
          if (Number(existing.is_active) !== 1) return NextResponse.json({ error: "Customer portal account disabled hai. Admin support se sampark karein." }, { status: 403 });
          await db.prepare("UPDATE portal_users SET name=?,phone=?,phone_normalized=?,updated_at=CURRENT_TIMESTAMP WHERE id=?")
            .bind(String(row.full_name), String(row.phone), phone, String(existing.id)).run();
          portalUser = existing;
        } else {
          const portalUserId = crypto.randomUUID();
          const placeholderHash = toHex(crypto.getRandomValues(new Uint8Array(32)));
          const placeholderSalt = toHex(crypto.getRandomValues(new Uint8Array(16)));
          await db.prepare("INSERT INTO portal_users (id,name,phone,phone_normalized,role,customer_id,walker_id,password_hash,password_salt,password_iterations,is_active) VALUES (?,?,?,?,'customer',?,NULL,?,?,210000,1)")
            .bind(portalUserId, String(row.full_name), String(row.phone), phone, String(row.id), placeholderHash, placeholderSalt).run();
          portalUser = { id: portalUserId };
        }
      }
    }
    if (!portalUser) {
      return NextResponse.json({ error: "Walker portal account abhi Admin ne activate nahi kiya. Admin se sampark karein." }, { status: 403 });
    }

    const session = await createPortalSession(db, String(portalUser.id));
    const response = NextResponse.json({ ok: true, role });
    setPortalCookie(response, session.token);
    return response;
  } catch {
    return NextResponse.json({ error: "OTP verification temporarily unavailable." }, { status: 503 });
  }
}

async function findCustomersByPhone(db: PortalDB, phoneDigits: string) {
  const expression = "CASE WHEN substr(clean_phone,1,2)='91' THEN substr(clean_phone,3) WHEN substr(clean_phone,1,1)='0' THEN substr(clean_phone,2) ELSE clean_phone END";
  const result = await db.prepare(
    "SELECT id,full_name,phone,status FROM (SELECT id,full_name,phone,status,replace(replace(replace(replace(replace(phone,' ',''),'-',''),'(',''),')',''),'+','') AS clean_phone FROM customers) WHERE " + expression + "=? LIMIT 2"
  ).bind(phoneDigits).all();
  return result.results || [];
}

function toHex(bytes: Uint8Array) {
  return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
}

function statusMessage(employment: string, walkerStatus: string) {
  const state = employment !== "active" ? employment : walkerStatus.toLowerCase();
  if (state === "suspended") return "Aapka Walker account Suspended hai. Admin se sampark karein.";
  if (state === "on_leave") return "Aapka Walker account abhi On Leave hai. Admin se sampark karein.";
  if (state === "exited") return "Aapka Walker account band (Exited) hai. Admin se sampark karein.";
  if (state === "pending") return "Aapka Walker account abhi Pending approval mein hai. Admin se sampark karein.";
  return "Aapka Walker account active nahi hai. Admin se sampark karein.";
}

function normalizeOtpPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 10) return "+91" + digits;
  if (digits.length === 11 && digits.startsWith("0")) return "+91" + digits.slice(1);
  if (digits.length === 12 && digits.startsWith("91")) return "+" + digits;
  if (digits.length >= 10 && digits.length <= 15) return "+" + digits;
  return "";
}

function constantTimeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function hashOtp(pepper: string, id: string, code: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(pepper), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(id + ":" + code));
  return Array.from(new Uint8Array(signature), (b) => b.toString(16).padStart(2, "0")).join("");
}
