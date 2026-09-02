// ─── TikTok Response Parser ───────────────────────────────────────────────────
import type { TikTokVideoInfo, DownloadOption } from "@/types/tiktok";

type ParseMode = "api" | "next" | "sigi";

/**
 * Parse TikTok's raw response data into our unified TikTokVideoInfo format.
 */
export function parseTikTokData(
  raw: Record<string, unknown>,
  mode: ParseMode = "api"
): TikTokVideoInfo | null {
  try {
    switch (mode) {
      case "api":
        return parseApiData(raw);
      case "next":
        return parseNextData(raw);
      case "sigi":
        return parseSigiData(raw);
      default:
        return null;
    }
  } catch (error) {
    console.error("[Parser] Failed to parse TikTok data:", error);
    return null;
  }
}

function parseApiData(raw: Record<string, unknown>): TikTokVideoInfo | null {
  // Handle /api/item/detail/ response
  const item =
    (raw?.itemInfo as Record<string, unknown>)?.itemStruct ??
    (raw as Record<string, unknown>)?.aweme_detail;
  if (!item) return null;

  return buildVideoInfo(item as Record<string, unknown>);
}

function parseNextData(raw: Record<string, unknown>): TikTokVideoInfo | null {
  // Handle __NEXT_DATA__ structure
  const props = raw?.props as Record<string, unknown>;
  const pageProps = props?.pageProps as Record<string, unknown>;
  const itemInfo =
    (pageProps?.itemInfo as Record<string, unknown>)?.itemStruct ??
    (pageProps as Record<string, unknown>)?.videoData;

  if (!itemInfo) return null;
  return buildVideoInfo(itemInfo as Record<string, unknown>);
}

function parseSigiData(raw: Record<string, unknown>): TikTokVideoInfo | null {
  // Handle SIGI_STATE structure
  const itemModule = raw?.ItemModule as Record<string, unknown>;
  if (!itemModule) return null;

  const firstKey = Object.keys(itemModule)[0];
  const item = itemModule[firstKey] as Record<string, unknown>;
  if (!item) return null;

  return buildVideoInfo(item);
}

function buildVideoInfo(item: Record<string, unknown>): TikTokVideoInfo {
  const author = item.author as Record<string, unknown>;
  const video = item.video as Record<string, unknown>;
  const stats = (item.stats ?? item.statistics) as Record<string, unknown>;
  const music = item.music as Record<string, unknown>;

  const downloadOptions: DownloadOption[] = [];

  // No-watermark download URL
  const noWatermarkUrl =
    (video?.downloadAddr as string) ??
    (video?.playAddr as string) ??
    "";

  if (noWatermarkUrl) {
    downloadOptions.push({
      quality: "1080p",
      format: "mp4",
      url: noWatermarkUrl,
      hasWatermark: false,
      size: parseInt(String(video?.videoQuality ?? "0")) || undefined,
    });
  }

  // Watermark version
  const watermarkUrl = (video?.playAddr as string) ?? "";
  if (watermarkUrl && watermarkUrl !== noWatermarkUrl) {
    downloadOptions.push({
      quality: "720p",
      format: "mp4",
      url: watermarkUrl,
      hasWatermark: true,
    });
  }

  return {
    id: String(item.id ?? ""),
    url: `https://www.tiktok.com/@${author?.uniqueId ?? "user"}/video/${item.id}`,
    title: String(item.desc ?? "TikTok Video"),
    description: String(item.desc ?? ""),
    author: {
      id: String(author?.id ?? ""),
      username: String(author?.uniqueId ?? author?.unique_id ?? ""),
      nickname: String(author?.nickname ?? ""),
      avatar:
        String(author?.avatarThumb ?? author?.avatar_thumb ?? ""),
      verified: Boolean(author?.verified),
      followerCount: parseInt(String(author?.followerCount ?? "0")) || 0,
    },
    thumbnail:
      String(
        (video?.cover as string) ??
          (video?.originCover as string) ??
          ""
      ),
    coverUrl: String((video?.dynamicCover as string) ?? ""),
    duration: parseInt(String(video?.duration ?? "0")) || 0,
    width: parseInt(String(video?.width ?? "0")) || undefined,
    height: parseInt(String(video?.height ?? "0")) || undefined,
    stats: {
      plays: parseInt(String(stats?.playCount ?? stats?.play_count ?? "0")) || 0,
      likes: parseInt(String(stats?.diggCount ?? stats?.digg_count ?? "0")) || 0,
      comments: parseInt(String(stats?.commentCount ?? stats?.comment_count ?? "0")) || 0,
      shares: parseInt(String(stats?.shareCount ?? stats?.share_count ?? "0")) || 0,
    },
    music: music
      ? {
          id: String(music.id ?? ""),
          title: String(music.title ?? ""),
          author: String(music.authorName ?? music.author ?? ""),
          coverUrl: String(music.coverThumb ?? ""),
        }
      : undefined,
    downloadOptions,
    fetchedAt: Date.now(),
  };
}
