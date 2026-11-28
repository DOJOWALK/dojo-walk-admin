import { NextResponse } from "next/server";

// Portal sign-in is OTP-only. Admin authentication is a separate route and is unaffected.
export async function POST() {
  return NextResponse.json(
    { error: "Portal login ab OTP ke through hota hai. Mobile number par OTP mangwayein." },
    { status: 410 }
  );
}
