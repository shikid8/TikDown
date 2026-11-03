// ─── API: POST /api/fetch-info ────────────────────────────────────────────────
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { scrapeTikTokVideo } from "@/lib/tiktok/scraper";
import { loadLocalCookies } from "@/lib/tiktok/localCookies";
import { decryptPayload } from "@/lib/cryptoCookie";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import type { TikTokCookie } from "@/types/cookie";

const RequestSchema = z.object({
  url: z.string().url("URL tidak valid").refine(
    (url) => url.includes("tiktok.com"),
    { message: "URL harus dari tiktok.com" }
  ),
});

export async function POST(req: NextRequest) {
  // ── Rate Limiting ──────────────────────────────────────────────────────────
  const ip = getClientIp(req);
  const rl = checkRateLimit(ip); // default: 20 req / jam dari env
  if (!rl.allowed) {
    const retryAfterSec = Math.ceil((rl.retryAfterMs ?? 0) / 1000);
    return NextResponse.json(
      { success: false, error: `Terlalu banyak request. Coba lagi dalam ${retryAfterSec} detik.` },
      { status: 429, headers: { "Retry-After": String(retryAfterSec) } }
    );
  }

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

    // ── Prioritas 2: Fallback ke session cookie browser (terenkripsi) ───────
    if (cookies.length === 0) {
      const sessionCookie = req.cookies.get("tk_session");
      if (sessionCookie?.value) {
        try {
          const decrypted = decryptPayload(sessionCookie.value);
          cookies = JSON.parse(decrypted) as TikTokCookie[];
          cookieSource = "browser-session";
        } catch (e) {
          console.warn("[API /fetch-info] Gagal mendekripsi session cookies:", (e as Error).message);
        }
      }
    }

    if (cookies.length === 0) {
      console.warn("[API /fetch-info] Tidak ada cookies tersedia — scraping tanpa autentikasi");
      cookieSource = "none";
    } else {
      console.info(`[API /fetch-info] Menggunakan cookies dari: ${cookieSource} (${cookies.length} cookies)`);
    }

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
