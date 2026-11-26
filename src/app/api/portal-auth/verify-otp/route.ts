import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createPortalSession, isSameOrigin, normalizePortalPhone, PortalDB, setPortalCookie } from "@/lib/portal-auth";

type Env = { DB: PortalDB; OTP_PEPPER?: string };

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Request origin is not allowed." }, { status: 403 });
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  const role = body.role === "walker" || body.role === "customer" ? body.role : null;
  const phone = typeof body.phone === "string" ? normalizePortalPhone(body.phone) : "";
  const challengeId = typeof body.challengeId === "string" ? body.challengeId : "";
  const code = typeof body.code === "string" ? body.code.trim() : "";
  if (!role || !/^\+?[0-9]{10,15}$/.test(phone) || !/^[0-9]{6}$/.test(code) || !/^[0-9a-f-]{36}$/i.test(challengeId)) {
    return NextResponse.json({ error: "OTP details sahi enter karein." }, { status: 400 });
  }

  const { env } = getCloudflareContext();
  const config = env as unknown as Env;
  if (!config.OTP_PEPPER) return NextResponse.json({ error: "OTP service configure nahi hai." }, { status: 503 });
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

    await db.prepare("UPDATE portal_otp_challenges SET consumed_at=datetime('now') WHERE id=? AND consumed_at IS NULL").bind(challengeId).run();
    let portalUser: Record<string, unknown> | undefined;
    let status = "";
    if (role === "walker") {
      const walker = await db.prepare(
        "SELECT w.id,w.status,ep.employment_status FROM walkers w LEFT JOIN walker_employment_profiles ep ON ep.walker_id=w.id WHERE w.id=? LIMIT 1"
      ).bind(String(challenge.account_id)).all();
      const row = walker.results?.[0];
      if (!row) return NextResponse.json({ error: "Walker record nahi mila. Admin se sampark karein." }, { status: 404 });
      status = String(row.employment_status || row.status || "active").toLowerCase();
      if (status !== "active" || String(row.status).toLowerCase() !== "active") {
        return NextResponse.json({ error: statusMessage(status, String(row.status)) }, { status: 403 });
      }
      const found = await db.prepare("SELECT id FROM portal_users WHERE role='walker' AND walker_id=? AND is_active=1 LIMIT 1").bind(String(challenge.account_id)).all();
      portalUser = found.results?.[0];
    } else {
      const customer = await db.prepare("SELECT id,status FROM customers WHERE id=? LIMIT 1").bind(String(challenge.account_id)).all();
      const row = customer.results?.[0];
      if (!row || String(row.status).toLowerCase() !== "active") {
        return NextResponse.json({ error: "Customer account active nahi hai. Admin support se sampark karein." }, { status: 403 });
      }
      const found = await db.prepare("SELECT id FROM portal_users WHERE role='customer' AND customer_id=? AND is_active=1 LIMIT 1").bind(String(challenge.account_id)).all();
      portalUser = found.results?.[0];
    }
    if (!portalUser) {
      return NextResponse.json({ error: role === "walker" ? "Aapka Walker portal account abhi Admin ne activate nahi kiya. Admin se sampark karein." : "Customer portal account abhi linked nahi hai. Support se sampark karein." }, { status: 403 });
    }

    const session = await createPortalSession(db, String(portalUser.id));
    const response = NextResponse.json({ ok: true, role });
    setPortalCookie(response, session.token);
    return response;
  } catch {
    return NextResponse.json({ error: "OTP verification temporarily unavailable." }, { status: 503 });
  }
}

function statusMessage(employment: string, walkerStatus: string) {
  const state = employment !== "active" ? employment : walkerStatus.toLowerCase();
  if (state === "suspended") return "Aapka Walker account Suspended hai. Admin se sampark karein.";
  if (state === "on_leave") return "Aapka Walker account abhi On Leave hai. Admin se sampark karein.";
  if (state === "exited") return "Aapka Walker account band (Exited) hai. Admin se sampark karein.";
  if (state === "pending") return "Aapka Walker account abhi Pending approval mein hai. Admin se sampark karein.";
  return "Aapka Walker account active nahi hai. Admin se sampark karein.";
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
