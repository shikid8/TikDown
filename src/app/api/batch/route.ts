import { NextRequest, NextResponse } from "next/server";
import { tasksStore, scheduleCleanup } from "@/lib/batchStore";
import { scrapeTikTokVideo, resolveShortUrl } from "@/lib/tiktok/scraper";
import { loadLocalCookies } from "@/lib/tiktok/localCookies";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { sortUrlsByUploadDate, getTimestampFromVideoId, formatUploadDate } from "@/lib/utils";
import { v4 as uuidv4 } from "uuid";
import { downloadQueue } from "@/lib/downloader/queue";

export async function POST(req: NextRequest) {
  // ── Rate Limiting ──────────────────────────────────────────────────────────
  const ip = getClientIp(req);
  // Batch lebih berat: batasi 5 request per jam per IP
  const rl = checkRateLimit(ip, 5, 60 * 60 * 1000);
  if (!rl.allowed) {
    const retryAfterSec = Math.ceil((rl.retryAfterMs ?? 0) / 1000);
    return NextResponse.json(
      { error: `Terlalu banyak request. Coba lagi dalam ${retryAfterSec} detik.` },
      { status: 429, headers: { "Retry-After": String(retryAfterSec) } }
    );
  }

  try {
    const { urls, quality, sortOrder = "oldest" } = await req.json();

    if (!urls || !Array.isArray(urls)) {
      return NextResponse.json({ error: "Invalid urls array" }, { status: 400 });
    }

    // Batasi jumlah URL per request (maksimal 200 URL per batch)
    if (urls.length > 200) {
      return NextResponse.json(
        { error: "Maksimal 200 URL per request batch." },
        { status: 400 }
      );
    }

    const cookies = await loadLocalCookies();

    // Resolusi short URL (jika ada) dan urutkan berdasarkan tanggal upload (default: terlama ke terbaru)
    const resolvedUrls = await Promise.all(
      urls.map((u: string) => resolveShortUrl(u, cookies))
    );
    const sortedUrls = sortUrlsByUploadDate(
      resolvedUrls,
      sortOrder as "oldest" | "newest" | "original"
    );

    const taskId = uuidv4();
    const items = sortedUrls.map((url: string, index: number) => ({
      id: `${index}`,
      url,
      status: "pending" as const,
    }));

    tasksStore.set(taskId, {
      id: taskId,
      isComplete: false,
      items,
    });

    // Start background processing (non-blocking)
    processBatch(taskId, sortedUrls, quality).catch(console.error);

    return NextResponse.json({ taskId });
  } catch (error) {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const taskId = req.nextUrl.searchParams.get("taskId");

  if (!taskId || !tasksStore.has(taskId)) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  const task = tasksStore.get(taskId);
  return NextResponse.json(task);
}

async function processBatch(taskId: string, urls: string[], quality: string) {
  const task = tasksStore.get(taskId);
  if (!task) return;

  const cookies = await loadLocalCookies();
  let completed = 0;

  const promises = urls.map((url, index) => {
    return downloadQueue.add(`batch-${taskId}-${index}`, async () => {
      task.items[index].status = "processing";
      task.items[index].progress = 10;

      try {
        const videoInfo = await scrapeTikTokVideo(url, { cookies, timeout: 30000 });
        task.items[index].progress = 50;

        const targetOption =
          quality === "audio"
            ? videoInfo.downloadOptions.find((o) => o.quality === "audio") ||
              videoInfo.downloadOptions.find((o) => !o.hasWatermark)
            : videoInfo.downloadOptions.find(
                (o) => o.quality === quality && !o.hasWatermark
              ) || videoInfo.downloadOptions.find((o) => !o.hasWatermark);

        if (!targetOption) {
          throw new Error("Kualitas yang diminta tidak tersedia");
        }

        const uploadTs = videoInfo.createTime || getTimestampFromVideoId(videoInfo.id);
        const uploadDate = uploadTs ? formatUploadDate(uploadTs) : undefined;

        task.items[index].status = "success";
        task.items[index].progress = 100;
        task.items[index].data = {
          title: `@${videoInfo.author.username}_${videoInfo.id}`,
          size: targetOption.size,
          downloadUrl: targetOption.url,
          format: quality === "audio" ? "mp3" : "mp4",
          uploadDate,
          uploadTimestamp: uploadTs || undefined,
        };
      } catch (error: any) {
        task.items[index].status = "error";
        task.items[index].message = error.message || "Failed to process";
      } finally {
        completed++;
        if (completed === urls.length) {
          task.isComplete = true;
          // ── Jadwalkan cleanup task dari store setelah 10 menit ────────────
          scheduleCleanup(taskId);
        }
      }
    });
  });

  await Promise.allSettled(promises);
}
