// ─── TikTok Video & Author Types ─────────────────────────────────────────────

export interface TikTokAuthor {
  id: string;
  username: string;
  nickname: string;
  avatar: string;
  verified: boolean;
  followerCount?: number;
}

export interface TikTokStats {
  plays: number;
  likes: number;
  comments: number;
  shares: number;
  bookmarks?: number;
}

export type VideoQuality = "360p" | "540p" | "720p" | "1080p";
export type DownloadFormat = "mp4" | "mp3" | "webm";

export interface DownloadOption {
  quality: VideoQuality | "audio";
  format: DownloadFormat;
  url: string;
  size?: number; // bytes
  hasWatermark: boolean;
  bitrate?: number;
}

export interface TikTokVideoInfo {
  id: string;
  url: string;
  title: string;
  description?: string;
  author: TikTokAuthor;
  thumbnail: string;
  coverUrl?: string;
  duration: number; // seconds
  width?: number;
  height?: number;
  stats: TikTokStats;
  music?: {
    id: string;
    title: string;
    author: string;
    coverUrl?: string;
  };
  downloadOptions: DownloadOption[];
  fetchedAt: number; // timestamp
}

// ─── API Response Wrappers ────────────────────────────────────────────────────

export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
}

export interface ApiErrorResponse {
  success: false;
  error: string;
  code?: string;
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

// ─── Fetch Info Request ───────────────────────────────────────────────────────

export interface FetchInfoRequest {
  url: string;
}

export interface FetchInfoResponse extends TikTokVideoInfo {}
