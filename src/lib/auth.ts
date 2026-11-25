const COOKIE_NAME = "dojo_walk_admin";
const SESSION_HOURS = 8;

function toHex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

async function signature(value: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return toHex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value)));
}

export function getAdminCookieName() {
  return COOKIE_NAME;
}

export function checkAdminPassword(candidate: string, configured: string | undefined): boolean {
  if (!configured || configured.length < 12) return false;
  return safeEqual(candidate, configured);
}

export async function createAdminSession(secret: string | undefined): Promise<string> {
  if (!secret || secret.length < 32) throw new Error("SESSION_SECRET must be at least 32 characters.");
  const expiresAt = Date.now() + SESSION_HOURS * 60 * 60 * 1000;
  const payload = String(expiresAt);
  return `${payload}.${await signature(payload, secret)}`;
}

export async function verifyAdminSession(token: string | undefined, secret: string | undefined): Promise<boolean> {
  if (!token || !secret || secret.length < 32) return false;
  const [expiresAt, suppliedSignature, extra] = token.split(".");
  if (!expiresAt || !suppliedSignature || extra) return false;
  const expiry = Number(expiresAt);
  if (!Number.isSafeInteger(expiry) || expiry <= Date.now()) return false;
  const expected = await signature(expiresAt, secret);
  return safeEqual(suppliedSignature, expected);
}