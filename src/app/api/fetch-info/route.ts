// ─── API: POST /api/fetch-info ────────────────────────────────────────────────
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { scrapeTikTokVideo } from "@/lib/tiktok/scraper";
import { loadLocalCookies } from "@/lib/tiktok/localCookies";
import type { TikTokCookie } from "@/types/cookie";

const RequestSchema = z.object({
  url: z.string().url("URL tidak valid").refine(
    (url) => url.includes("tiktok.com"),
    { message: "URL harus dari tiktok.com" }
  ),
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

    const { url } = parsed.data;

    // ── Prioritas 1: Baca dari file lokal cookies.json ──────────────────────
    let cookies: TikTokCookie[] = await loadLocalCookies();
    let cookieSource = "local-file";

    // ── Prioritas 2: Fallback ke session cookie browser (dari UI) ───────────
    if (cookies.length === 0) {
      const sessionCookie = req.cookies.get("tk_session");
      if (sessionCookie?.value) {
        try {
          cookies = JSON.parse(sessionCookie.value) as TikTokCookie[];
          cookieSource = "browser-session";
        } catch {
          console.warn("[API /fetch-info] Failed to parse session cookies");
        }
      }
    }

    if (cookies.length === 0) {
      console.warn("[API /fetch-info] Tidak ada cookies tersedia — scraping tanpa autentikasi");
      cookieSource = "none";
    } else {
      console.info(`[API /fetch-info] Menggunakan cookies dari: ${cookieSource} (${cookies.length} cookies)`);
    }

    // Scrape video info
    const videoInfo = await scrapeTikTokVideo(url, { cookies, timeout: 30000 });

    return NextResponse.json({
      success: true,
      data: videoInfo,
      meta: { cookieSource, cookieCount: cookies.length },
    });
  } catch (error) {
    console.error("[API /fetch-info] Error:", error);
    const message = error instanceof Error ? error.message : "Terjadi kesalahan saat mengambil info video.";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

// ── GET: Cek status cookies lokal ────────────────────────────────────────────
export async function GET() {
  const cookies = await loadLocalCookies();
  const hasCookies = cookies.length > 0;
  const hasSessionId = cookies.some((c) => c.name === "sessionid");

  return NextResponse.json({
    success: true,
    source: "local-file",
    cookieCount: cookies.length,
    hasSessionId,
    isReady: hasCookies && hasSessionId,
    cookieNames: cookies.map((c) => c.name),
    filePath: process.env.COOKIES_FILE || "./cookies.json",
  });
}
