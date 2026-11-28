import { NextResponse } from "next/server";

// Walker and Customer portals use mobile OTP only. Admin authentication is separate.
export async function POST() {
  return NextResponse.json(
    { error: "Portal accounts use mobile OTP login. Password changes are not available." },
    { status: 410 }
  );
}
