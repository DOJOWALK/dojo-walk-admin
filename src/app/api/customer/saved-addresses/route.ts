import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getPortalIdentity, isSameOrigin, PortalDB } from "@/lib/portal-auth";

type Env = { DB: PortalDB };

export async function GET() {
  const { env } = getCloudflareContext();
  const db = (env as unknown as Env).DB;
  try {
    const identity = await getPortalIdentity(db);
    if (!identity) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (identity.role !== "customer" || !identity.customer_id) return NextResponse.json({ error: "Customer access only." }, { status: 403 });
    const result = await db.prepare("SELECT id,label,address,latitude,longitude FROM customer_saved_addresses WHERE customer_id=? ORDER BY CASE label WHEN 'home' THEN 0 WHEN 'work' THEN 1 ELSE 2 END").bind(identity.customer_id).all();
    return NextResponse.json({ addresses: result.results ?? [] });
  } catch {
    return NextResponse.json({ error: "Saved addresses are unavailable until the reviewed migration is installed." }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Request origin is not allowed." }, { status: 403 });
  const { env } = getCloudflareContext();
  const db = (env as unknown as Env).DB;
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  try {
    const identity = await getPortalIdentity(db);
    if (!identity) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (identity.role !== "customer" || !identity.customer_id) return NextResponse.json({ error: "Customer access only." }, { status: 403 });
    const label = ["home","work","other"].includes(String(body.label)) ? String(body.label) : "";
    const address = typeof body.address === "string" ? body.address.trim().slice(0,500) : "";
    const latitude = body.latitude === null || body.latitude === undefined || body.latitude === "" ? null : Number(body.latitude);
    const longitude = body.longitude === null || body.longitude === undefined || body.longitude === "" ? null : Number(body.longitude);
    if (!label || address.length < 5 || ((latitude === null) !== (longitude === null)) ||
      (latitude !== null && (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude! < -180 || longitude! > 180))) {
      return NextResponse.json({ error: "Label, valid address and optional valid GPS coordinates are required." }, { status: 400 });
    }
    const id = crypto.randomUUID();
    await db.prepare("INSERT INTO customer_saved_addresses (id,customer_id,label,address,latitude,longitude) VALUES (?,?,?,?,?,?) ON CONFLICT(customer_id,label) DO UPDATE SET address=excluded.address,latitude=excluded.latitude,longitude=excluded.longitude,updated_at=CURRENT_TIMESTAMP")
      .bind(id,identity.customer_id,label,address,latitude,longitude).run();
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Address could not be saved." }, { status: 503 });
  }
}
