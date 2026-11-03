// ─── Utility Functions ────────────────────────────────────────────────────────
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge Tailwind classes safely */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format number with K/M/B suffix */
export function formatCount(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

/** Format seconds to MM:SS */
export function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/** Format bytes to human-readable size */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/** Sanitize filename for download */
export function sanitizeFilename(name: string): string {
  return name
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "_")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 100);
}

/** Extract TikTok video ID from URL */
export function extractVideoId(url: string): string | null {
  if (/^\d{15,22}$/.test(url.trim())) return url.trim();

  const patterns = [
    /tiktok\.com\/@[\w.]+\/video\/(\d+)/,
    /tiktok\.com\/v\/(\d+)/,
    /vm\.tiktok\.com\/(\w+)/,
    /vt\.tiktok\.com\/(\w+)/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match?.[1]) return match[1];
  }
  return null;
}

/**
 * Extract upload timestamp (in seconds) from TikTok Snowflake video ID or URL.
 * TikTok video IDs are 64-bit integers where the upper 32 bits represent Unix timestamp in seconds.
 */
export function getTimestampFromVideoId(input: string): number | null {
  const videoId = extractVideoId(input) || input.trim();
  if (!/^\d{15,22}$/.test(videoId)) return null;
  try {
    const ts = Number(BigInt(videoId) >> BigInt(32));
    // Sanity check: valid Unix timestamp between 2016 and 2038
    if (ts > 1451606400 && ts < 2147483647) {
      return ts;
    }
  } catch {}
  return null;
}

/**
 * Get Date object from TikTok video ID or URL
 */
export function getVideoUploadDate(input: string): Date | null {
  const ts = getTimestampFromVideoId(input);
  return ts ? new Date(ts * 1000) : null;
}

/**
 * Format timestamp or Date to human-readable date string (e.g. "5 Apr 2024")
 */
export function formatUploadDate(val: number | Date): string {
  const d = typeof val === "number" ? new Date(val > 10000000000 ? val : val * 1000) : val;
  if (isNaN(d.getTime())) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(d);
}

/**
 * Sort list of TikTok video URLs based on their upload date.
 * - "oldest": Terlama ke terbaru (ascending)
 * - "newest": Terbaru ke terlama (descending)
 * - "original": Tetap sesuai urutan input
 */
export function sortUrlsByUploadDate(
  urls: string[],
  order: "oldest" | "newest" | "original" = "oldest"
): string[] {
  if (order === "original") return [...urls];

  return [...urls].sort((a, b) => {
    const tsA = getTimestampFromVideoId(a) ?? (order === "oldest" ? Infinity : -Infinity);
    const tsB = getTimestampFromVideoId(b) ?? (order === "oldest" ? Infinity : -Infinity);

    if (order === "oldest") {
      return tsA - tsB;
    } else {
      return tsB - tsA;
    }
  });
}

/** Validate TikTok URL */
export function isValidTikTokUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.hostname.includes("tiktok.com") ||
      parsed.hostname.includes("vm.tiktok.com") ||
      parsed.hostname.includes("vt.tiktok.com")
    );
  } catch {
    return false;
  }
}

/** Generate a unique task ID */
export function generateTaskId(): string {
  return `task_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/** Sleep helper */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Format relative time (e.g. "2 minutes ago") */
export function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days = Math.floor(diff / 86_400_000);

  if (days > 0) return `${days} hari lalu`;
  if (hours > 0) return `${hours} jam lalu`;
  if (minutes > 0) return `${minutes} menit lalu`;
  return "Baru saja";
}
