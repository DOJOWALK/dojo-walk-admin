import { NextResponse } from "next/server";
import { getAdminCookieName } from "@/lib/auth";

export async function POST() {
  const response = NextResponse.redirect(new URL("/login", process.env.APP_URL || "https://dojo-walk-admin.invalid"), 303);
  response.cookies.set(getAdminCookieName(), "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 0
  });
  return response;
}