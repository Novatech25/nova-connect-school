import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.json({ success: false, message: "Token missing" }, { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || serviceRoleKey;

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ success: false, message: "Server misconfigured" }, { status: 500 });
  }

  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/verify-receipt`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: anonKey || "",
        Authorization: `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({ token }),
      cache: "no-store",
    });

    const data = await response.json().catch(() => null);
    return NextResponse.json(data ?? { success: false, message: "Invalid response" }, { status: response.status });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error?.message || "Verification failed" },
      { status: 500 }
    );
  }
}
