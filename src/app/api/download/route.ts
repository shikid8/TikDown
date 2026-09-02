// ─── API: GET /api/download ───────────────────────────────────────────────────
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sanitizeFilename } from "@/lib/utils";
import { loadLocalCookies } from "@/lib/tiktok/localCookies";
import type { TikTokCookie } from "@/types/cookie";

const QuerySchema = z.object({
  url: z.string().url("URL video tidak valid"),
  title: z.string().optional().default("tiktok_video"),
  format: z.enum(["mp4", "mp3", "webm"]).default("mp4"),
});

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const query = QuerySchema.safeParse({
      url: searchParams.get("url"),
      title: searchParams.get("title") ?? undefined,
      format: searchParams.get("format") ?? undefined,
    });

    if (!query.success) {
      return NextResponse.json(
        {
          success: false,
          error: query.error.errors.map((e) => e.message).join(", "),
        },
        { status: 400 }
      );
    }

    const { url: videoUrl, title, format } = query.data;

    // ── Prioritas 1: Baca dari file lokal cookies.json ──────────────────────
    let cookies: TikTokCookie[] = await loadLocalCookies();

    // ── Prioritas 2: Fallback ke session cookie browser ─────────────────────
    if (cookies.length === 0) {
      const sessionCookie = req.cookies.get("tk_session");
      if (sessionCookie?.value) {
        try {
          cookies = JSON.parse(sessionCookie.value) as TikTokCookie[];
        } catch {}
      }
    }

    // Build cookie header string
    const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join("; ");

    // Fetch the video stream from TikTok
    const axios = (await import("axios")).default;
    const videoResponse = await axios.get(videoUrl, {
      responseType: "stream",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Referer": "https://www.tiktok.com/",
        "Origin": "https://www.tiktok.com",
        "Cookie": cookieHeader,
        "Range": "bytes=0-",
        "Accept": "video/webm,video/ogg,video/*;q=0.9,application/ogg;q=0.7,audio/*;q=0.6,*/*;q=0.5",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "identity",
        "sec-fetch-dest": "video",
        "sec-fetch-mode": "no-cors",
        "sec-fetch-site": "cross-site",
      },
      timeout: 60000,
      maxRedirects: 10,
    });

    const contentType = format === "mp3" ? "audio/mpeg" : "video/mp4";
    const filename = `${sanitizeFilename(title)}.${format}`;

    // Stream response to client
    const { Readable } = await import("stream");
    const nodeStream = videoResponse.data as NodeJS.ReadableStream;
    const webStream = Readable.toWeb(nodeStream as import("stream").Readable);

    return new Response(webStream as ReadableStream, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(videoResponse.headers["content-length"] ?? ""),
        "Accept-Ranges": "bytes",
        "Cache-Control": "no-cache",
      },
    });
  } catch (error) {
    console.error("[API /download] Error:", error);
    const message =
      error instanceof Error ? error.message : "Gagal mengunduh video.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

