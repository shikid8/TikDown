// ─── useDownload Hook ─────────────────────────────────────────────────────────
"use client";

import { useState, useCallback } from "react";
import { toast } from "sonner";
import { useDownloadStore } from "@/store/downloadStore";
import { isValidTikTokUrl } from "@/lib/utils";
import type { TikTokVideoInfo, VideoQuality, DownloadFormat } from "@/types/tiktok";

export function useDownload() {
  const [isFetching, setIsFetching] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const {
    currentVideo,
    setCurrentVideo,
    addTask,
    updateTask,
    setIsLoading,
  } = useDownloadStore();

  /**
   * Fetch video info from TikTok URL
   */
  const fetchVideoInfo = useCallback(async (url: string): Promise<TikTokVideoInfo | null> => {
    if (!isValidTikTokUrl(url)) {
      toast.error("URL TikTok tidak valid. Pastikan URL berasal dari tiktok.com");
      return null;
    }

    setIsFetching(true);
    setIsLoading(true);

    try {
      const res = await fetch("/api/fetch-info", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      const data = await res.json();

      if (!data.success) {
        toast.error(data.error ?? "Gagal mengambil info video.");
        return null;
      }

      setCurrentVideo(data.data);
      toast.success("Info video berhasil diambil!");
      return data.data as TikTokVideoInfo;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Terjadi kesalahan.";
      toast.error(message);
      return null;
    } finally {
      setIsFetching(false);
      setIsLoading(false);
    }
  }, [setCurrentVideo, setIsLoading]);

  /**
   * Trigger video download
   */
  const downloadVideo = useCallback(
    async (
      videoUrl: string,
      title: string,
      quality: VideoQuality | "audio" = "1080p",
      format: DownloadFormat = "mp4"
    ) => {
      const taskId = addTask(videoUrl, quality, format);
      setIsDownloading(true);

      updateTask(taskId, { status: "downloading", progress: 10 });

      try {
        const params = new URLSearchParams({
          url: videoUrl,
          title,
          format,
        });

        // Trigger browser download via anchor
        const downloadUrl = `/api/download?${params.toString()}`;
        const a = document.createElement("a");
        a.href = downloadUrl;
        a.download = `${title}.${format}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        updateTask(taskId, { status: "done", progress: 100, completedAt: Date.now() });
        toast.success(`Download dimulai: ${title}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Gagal memulai download.";
        updateTask(taskId, { status: "failed", error: message });
        toast.error(message);
      } finally {
        setIsDownloading(false);
      }
    },
    [addTask, updateTask]
  );

  return {
    currentVideo,
    isFetching,
    isDownloading,
    fetchVideoInfo,
    downloadVideo,
  };
}
