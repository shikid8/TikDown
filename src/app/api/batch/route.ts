import { NextRequest, NextResponse } from "next/server";
import { downloadQueue } from "@/lib/downloader/queue";
import { scrapeTikTokVideo } from "@/lib/tiktok/scraper";
import { loadLocalCookies } from "@/lib/tiktok/localCookies";
import { v4 as uuidv4 } from "uuid";

// Simple in-memory task store for polling
// In production with Vercel, you'd want Redis or a database.
const tasksStore = new Map<string, any>();

export async function POST(req: NextRequest) {
  try {
    const { urls, quality } = await req.json();

    if (!urls || !Array.isArray(urls)) {
      return NextResponse.json({ error: "Invalid urls array" }, { status: 400 });
    }

    const taskId = uuidv4();
    const items = urls.map((url: string, index: number) => ({
      id: `${index}`,
      url,
      status: "pending",
    }));

    tasksStore.set(taskId, {
      id: taskId,
      isComplete: false,
      items,
    });

    // Start background processing
    processBatch(taskId, urls, quality).catch(console.error);

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
      // Update status to processing
      task.items[index].status = "processing";
      task.items[index].progress = 10;
      
      try {
        // Fetch metadata
        const videoInfo = await scrapeTikTokVideo(url, { cookies, timeout: 30000 });
        task.items[index].progress = 50;
        
        // Find the download option
        const targetOption = quality === "audio" 
          ? videoInfo.downloadOptions.find(o => o.quality === "audio") || videoInfo.downloadOptions.find(o => !o.hasWatermark)
          : videoInfo.downloadOptions.find(o => o.quality === quality && !o.hasWatermark) || videoInfo.downloadOptions.find(o => !o.hasWatermark);

        if (!targetOption) {
          throw new Error("Kualitas yang diminta tidak tersedia");
        }

        task.items[index].status = "success";
        task.items[index].progress = 100;
        task.items[index].data = {
          title: `@${videoInfo.author.username}_${videoInfo.id}`,
          size: targetOption.size,
          downloadUrl: targetOption.url,
          format: quality === "audio" ? "mp3" : "mp4"
        };
      } catch (error: any) {
        task.items[index].status = "error";
        task.items[index].message = error.message || "Failed to process";
      } finally {
        completed++;
        if (completed === urls.length) {
          task.isComplete = true;
        }
      }
    });
  });

  await Promise.allSettled(promises);
}
