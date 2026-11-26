import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getPortalIdentity, PortalDB } from "@/lib/portal-auth";

type Env = { DB: PortalDB };

export async function GET() {
  try {
    const { env } = getCloudflareContext();
    const identity = await getPortalIdentity((env as unknown as Env).DB);
    if (!identity) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ user: { id: identity.id, name: identity.name, phone: identity.phone, role: identity.role } });
  } catch {
    return NextResponse.json({ error: "Portal session is unavailable." }, { status: 503 });
  }
}
