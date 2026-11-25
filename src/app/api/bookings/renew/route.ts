import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getAdminCookieName, verifyAdminSession } from "@/lib/auth";

export async function POST() {
  const { env } = getCloudflareContext();
  const runtime = env as unknown as { SESSION_SECRET?: string };
  const jar = await cookies();
  const valid = await verifyAdminSession(jar.get(getAdminCookieName())?.value, runtime.SESSION_SECRET);
  if (!valid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(
    { error: "Monthly and temporary plans have been discontinued. Create a per-walk booking instead." },
    { status: 410 }
  );
}
