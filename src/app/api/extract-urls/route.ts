import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { scrapeCollectionUrls } from "@/lib/tiktok/collectionScraper";
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

    let cookies: TikTokCookie[] = await loadLocalCookies();
    
    if (cookies.length === 0) {
      const sessionCookie = req.cookies.get("tk_session");
      if (sessionCookie?.value) {
        try {
          cookies = JSON.parse(sessionCookie.value) as TikTokCookie[];
        } catch {}
      }
    }

    // Ekstrak dengan timeout 60 detik (default)
    const videoUrls = await scrapeCollectionUrls(url, { cookies, timeout: 60000 });

    return NextResponse.json({
      success: true,
      urls: videoUrls,
    });
  } catch (error) {
    console.error("[API /extract-urls] Error:", error);
    const message = error instanceof Error ? error.message : "Terjadi kesalahan saat mengekstrak URL.";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
