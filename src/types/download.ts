// ─── Download Task & Queue Types ─────────────────────────────────────────────

import type { VideoQuality, DownloadFormat } from "./tiktok";

export type DownloadStatus =
  | "pending"
  | "fetching"
  | "downloading"
  | "processing"
  | "done"
  | "failed"
  | "cancelled";

export interface DownloadTask {
  id: string;
  url: string;
  quality: VideoQuality | "audio";
  format: DownloadFormat;
  status: DownloadStatus;
  progress: number; // 0-100
  error?: string;
  videoTitle?: string;
  thumbnail?: string;
  fileSize?: number;
  downloadedSize?: number;
  createdAt: number;
  completedAt?: number;
}

export interface BatchDownloadRequest {
  urls: string[];
  quality?: VideoQuality | "audio";
  format?: DownloadFormat;
}

export interface BatchDownloadResult {
  url: string;
  status: "success" | "failed";
  taskId?: string;
  error?: string;
}

// ─── Download History ─────────────────────────────────────────────────────────

export interface DownloadHistoryItem {
  id: string;
  taskId: string;
  url: string;
  videoTitle: string;
  thumbnail: string;
  quality: VideoQuality | "audio";
  format: DownloadFormat;
  fileSize?: number;
  completedAt: number;
}
