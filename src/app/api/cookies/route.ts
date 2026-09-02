// ─── API: POST /api/cookies ───────────────────────────────────────────────────
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { parseCookies, validateCookies, filterTikTokCookies } from "@/lib/tiktok/cookies";
import type { CookieFormat } from "@/types/cookie";

const RequestSchema = z.object({
  cookies: z.string().min(1, "Cookies tidak boleh kosong"),
  format: z.enum(["netscape", "json", "header"]),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = RequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: parsed.error.errors.map((e) => e.message).join(", "),
        },
        { status: 400 }
      );
    }

    const { cookies: rawCookies, format } = parsed.data;

    // Parse cookies
    let parsedCookies;
    try {
      parsedCookies = parseCookies(rawCookies, format as CookieFormat);
    } catch (parseError) {
      return NextResponse.json(
        {
          success: false,
          error: `Gagal mem-parse cookies: ${(parseError as Error).message}`,
        },
        { status: 400 }
      );
    }

    // Filter TikTok cookies only
    const tiktokCookies = filterTikTokCookies(parsedCookies);

    // Validate cookies
    const validation = validateCookies(tiktokCookies);
    if (!validation.isValid) {
      return NextResponse.json(
        { success: false, error: validation.message },
        { status: 400 }
      );
    }

    const sessionId = `sess_${Date.now()}`;

    // In production: encrypt and store in a server-side cache/session
    // For now: return the session ID and let client store in memory
    const response = NextResponse.json({
      success: true,
      message: validation.message,
      sessionId,
      cookieCount: tiktokCookies.length,
    });

    // Store cookies in a secure HttpOnly cookie for the session
    // Note: In production, use encrypted storage
    response.cookies.set("tk_session", JSON.stringify(tiktokCookies), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("[API /cookies] Error:", error);
    return NextResponse.json(
      { success: false, error: "Terjadi kesalahan server." },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  const response = NextResponse.json({
    success: true,
    message: "Cookies berhasil dihapus.",
  });
  response.cookies.delete("tk_session");
  return response;
}
