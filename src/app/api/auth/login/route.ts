import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { checkAdminPassword, createAdminSession, getAdminCookieName } from "@/lib/auth";

export async function POST(request: NextRequest) {
  let body: { password?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const password = typeof body.password === "string" ? body.password : "";
  const env = getCloudflareContext().env as { ADMIN_PASSWORD?: string; SESSION_SECRET?: string };
  if (!checkAdminPassword(password, env.ADMIN_PASSWORD)) {
    return NextResponse.json({ error: "Password is incorrect." }, { status: 401 });
  }

  try {
    const token = await createAdminSession(env.SESSION_SECRET);
    const response = NextResponse.json({ ok: true });
    response.cookies.set(getAdminCookieName(), token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 8 * 60 * 60
    });
    return response;
  } catch {
    return NextResponse.json({ error: "Admin session is not configured yet." }, { status: 503 });
  }
}