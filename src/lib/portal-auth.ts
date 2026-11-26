import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const PORTAL_COOKIE_NAME = "dojo_walk_portal";
const PORTAL_SESSION_DAYS = 14;
const PASSWORD_ITERATIONS = 210000;

type D1Rows = { results?: Record<string, unknown>[] };
export type PortalDB = {
  prepare(sql: string): {
    bind(...values: unknown[]): {
      all(): Promise<D1Rows>;
      run(): Promise<unknown>;
    };
    all(): Promise<D1Rows>;
    run(): Promise<unknown>;
  };
};

export type PortalIdentity = {
  id: string;
  name: string;
  phone: string;
  role: "walker" | "customer";
  customer_id: string | null;
  walker_id: string | null;
  session_id: string;
};

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
}

function fromHex(value: string): Uint8Array {
  if (!/^(?:[0-9a-f]{2})+$/i.test(value)) throw new Error("Invalid encoded value.");
  return new Uint8Array(value.match(/.{2}/g)!.map((part) => parseInt(part, 16)));
}

async function digest(value: string): Promise<string> {
  return toHex(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))));
}

export function normalizePortalPhone(value: string): string {
  return value.replace(/[\s()-]/g, "");
}

export async function makePortalPassword(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: PASSWORD_ITERATIONS, hash: "SHA-256" },
    key,
    256
  );
  return { password_hash: toHex(new Uint8Array(bits)), password_salt: toHex(salt), password_iterations: PASSWORD_ITERATIONS };
}

export async function verifyPortalPassword(password: string, saltHex: string, expectedHex: string, iterations: number) {
  if (!Number.isInteger(iterations) || iterations < 100000 || iterations > 1000000) return false;
  try {
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
    const bits = await crypto.subtle.deriveBits(
      { name: "PBKDF2", salt: fromHex(saltHex), iterations, hash: "SHA-256" },
      key,
      256
    );
    const actual = toHex(new Uint8Array(bits));
    if (actual.length !== expectedHex.length) return false;
    let mismatch = 0;
    for (let i = 0; i < actual.length; i++) mismatch |= actual.charCodeAt(i) ^ expectedHex.charCodeAt(i);
    return mismatch === 0;
  } catch {
    return false;
  }
}

export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

export async function getPortalIdentity(db: PortalDB): Promise<PortalIdentity | null> {
  const jar = await cookies();
  const token = jar.get(PORTAL_COOKIE_NAME)?.value;
  if (!token || !/^[0-9a-f]{64}$/i.test(token)) return null;
  const tokenHash = await digest(token);
  const result = await db.prepare(
    "SELECT u.id,u.name,u.phone,u.role,u.customer_id,u.walker_id,s.id AS session_id FROM portal_sessions s JOIN portal_users u ON u.id=s.user_id WHERE s.token_hash=? AND s.revoked_at IS NULL AND datetime(s.expires_at)>datetime('now') AND u.is_active=1 AND ((u.role='customer' AND EXISTS (SELECT 1 FROM customers c WHERE c.id=u.customer_id AND c.status='active')) OR (u.role='walker' AND EXISTS (SELECT 1 FROM walkers w WHERE w.id=u.walker_id AND w.status='active') AND (NOT EXISTS (SELECT 1 FROM walker_employment_profiles ep WHERE ep.walker_id=u.walker_id) OR EXISTS (SELECT 1 FROM walker_employment_profiles ep WHERE ep.walker_id=u.walker_id AND ep.employment_status='active')))) LIMIT 1"
  ).bind(tokenHash).all();
  const row = result.results?.[0];
  if (!row || (row.role !== "walker" && row.role !== "customer")) return null;
  return {
    id: String(row.id),
    name: String(row.name),
    phone: String(row.phone),
    role: row.role,
    customer_id: row.customer_id == null ? null : String(row.customer_id),
    walker_id: row.walker_id == null ? null : String(row.walker_id),
    session_id: String(row.session_id)
  };
}

export async function createPortalSession(db: PortalDB, userId: string) {
  const token = toHex(crypto.getRandomValues(new Uint8Array(32)));
  const expiresAt = new Date(Date.now() + PORTAL_SESSION_DAYS * 86400000).toISOString();
  await db.prepare("INSERT INTO portal_sessions (id,user_id,token_hash,expires_at) VALUES (?,?,?,?)")
    .bind(crypto.randomUUID(), userId, await digest(token), expiresAt).run();
  return { token, expiresAt };
}

export function setPortalCookie(response: NextResponse, token: string) {
  response.cookies.set(PORTAL_COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: PORTAL_SESSION_DAYS * 24 * 60 * 60
  });
}

export function clearPortalCookie(response: NextResponse) {
  response.cookies.set(PORTAL_COOKIE_NAME, "", {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0
  });
}
