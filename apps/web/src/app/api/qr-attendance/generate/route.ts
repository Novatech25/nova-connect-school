import { NextRequest, NextResponse } from "next/server";
import { generateQrCodeSchema } from "@novaconnect/core/schemas";
import { getSupabaseServerClient } from "@novaconnect/data/client/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export async function POST(request: NextRequest) {
  try {
    const supabase = await getSupabaseServerClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const body: unknown = await request.json();
    const input = generateQrCodeSchema.parse(body);

    console.log('[QR GENERATE] Session from cookies:', session ? 'YES' : 'NO', session?.user?.id);

    let authUser = session?.user;
    let accessToken = session?.access_token;

    // If no user from session, try Authorization header
    if (!authUser) {
      const authHeader = request.headers.get("authorization") || "";
      console.log('[QR GENERATE] Auth header:', authHeader ? 'Present (' + authHeader.substring(0, 50) + '...)' : 'NOT PRESENT');
      const tokenFromHeader = authHeader.startsWith("Bearer ")
        ? authHeader.slice(7)
        : "";

      console.log('[QR GENERATE] Token from header:', tokenFromHeader ? tokenFromHeader.substring(0, 50) + '...' : 'NO TOKEN');
      if (tokenFromHeader) {
        try {
          const [rawHeader, rawPayload] = tokenFromHeader.split('.');
          if (rawHeader && rawPayload) {
            const decodePart = (value: string) =>
              Buffer.from(value.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8');
            const headerJson = JSON.parse(decodePart(rawHeader));
            const payloadJson = JSON.parse(decodePart(rawPayload));
            console.log('[QR GENERATE] Token summary:', {
              alg: headerJson.alg,
              kid: headerJson.kid,
              iss: payloadJson.iss,
              aud: payloadJson.aud,
              sub: payloadJson.sub,
              exp: payloadJson.exp,
              role: payloadJson.role,
            });
          }
        } catch (decodeError) {
          console.log('[QR GENERATE] Token decode failed:', decodeError);
        }
      }

      if (tokenFromHeader) {
        const { data: { user: headerUser }, error: headerError } = await supabase.auth.getUser(tokenFromHeader);
        if (headerError) {
          console.log('[QR GENERATE] Token lookup failed:', headerError.message);
        }
        if (headerUser) {
          authUser = headerUser;
          accessToken = tokenFromHeader;
        }
      }
    }

    if (!authUser) {
      console.log('[QR GENERATE] AUTH FAILED - No user found');
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    console.log('[QR GENERATE] AUTH SUCCESS for user:', authUser.id);

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json(
        { error: "Supabase URL or Anon Key is missing" },
        { status: 500 }
      );
    }

    // Use the user's access token for the edge function call
    const response = await fetch(`${supabaseUrl}/functions/v1/generate-qr-code`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
        apikey: supabaseAnonKey,
      },
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.log("[QR GENERATE] Function error response:", {
        status: response.status,
        statusText: response.statusText,
        body: errorText,
      });
      let parsedError = errorText;
      try {
        parsedError = JSON.parse(errorText)?.error || errorText;
      } catch {
        // keep raw text
      }
      return NextResponse.json(
        { error: parsedError || "Failed to generate QR code" },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data, { status: 200 });
  } catch (error: any) {
    if (error?.name === "ZodError") {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error?.message || "Failed to generate QR code" },
      { status: 500 }
    );
  }
}
