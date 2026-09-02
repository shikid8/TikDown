// ─── TikTok Scraper — Puppeteer Stealth + Cookie injection ───────────────────
//
// Menggunakan puppeteer-extra + stealth plugin untuk bypass SlardarWAF TikTok.
// Cookies diinjeksikan dari cookies.json ke browser headless.
// Tanpa stealth: TikTok returns WAF challenge (1485 bytes)
// Dengan stealth: browser terlihat seperti Chrome asli, WAF dilalui
//
import type { TikTokCookie } from "@/types/cookie";
import type { TikTokVideoInfo, DownloadOption } from "@/types/tiktok";

export interface ScraperOptions {
  cookies?: TikTokCookie[];
  timeout?: number;
}

export async function scrapeTikTokVideo(
  url: string,
  options: ScraperOptions = {}
): Promise<TikTokVideoInfo> {
  const { cookies = [], timeout = 60000 } = options;

  // Resolve short URLs
  const resolvedUrl = await resolveShortUrl(url, cookies);
  const videoId = extractVideoId(resolvedUrl);

  console.info(`[Scraper] URL: ${resolvedUrl} | VideoID: ${videoId}`);

  // ── STRATEGI UTAMA: Puppeteer Stealth + Cookies ───────────────────────────
  try {
    const result = await scrapeWithStealthBrowser(resolvedUrl, cookies, timeout);
    console.info("[Scraper] ✅ Stealth browser berhasil");
    return result;
  } catch (e) {
    console.warn("[Scraper] Stealth browser gagal:", (e as Error).message);
  }

  // ── FALLBACK: HTTP API dengan cookies (mungkin diblok WAF) ─────────────────
  if (videoId) {
    try {
      const result = await scrapeViaHttp(resolvedUrl, videoId, cookies, timeout);
      console.info("[Scraper] ✅ HTTP API berhasil");
      return result;
    } catch (e) {
      console.warn("[Scraper] HTTP API gagal:", (e as Error).message);
    }
  }

  // ── LAST RESORT: oEmbed (tanpa URL download) ─────────────────────────────
  console.warn("[Scraper] ⚠️ oEmbed fallback — coba perbarui cookies");
  return scrapeWithOembed(resolvedUrl, cookies, videoId ?? "unknown");
}

// ─── Puppeteer Stealth (bypass WAF) ──────────────────────────────────────────

async function scrapeWithStealthBrowser(
  url: string,
  cookies: TikTokCookie[],
  timeout: number
): Promise<TikTokVideoInfo> {
  let puppeteerExtra: any;
  try {
    puppeteerExtra = (await import("puppeteer-extra")).default;
  } catch (e) {
    console.error("[Scraper] Gagal import puppeteer-extra:", e);
    throw new Error(
      "puppeteer-extra tidak terinstall. Jalankan: npm install puppeteer-extra puppeteer-extra-plugin-stealth --legacy-peer-deps"
    );
  }

  // Aktifkan stealth plugin
  try {
    const StealthPlugin = (await import("puppeteer-extra-plugin-stealth")).default;
    puppeteerExtra.use(StealthPlugin());
    console.info("[Scraper] Stealth plugin berhasil diaktifkan");
  } catch (e) {
    console.warn("[Scraper] Stealth plugin tidak tersedia:", (e as Error).message);
  }

  const browser = await puppeteerExtra.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-blink-features=AutomationControlled",
      "--disable-web-security",
      "--window-size=1280,800",
    ],
  });

  const page = await browser.newPage();

  try {
    await page.setViewport({ width: 1280, height: 800 });
    await page.setExtraHTTPHeaders({
      "Accept-Language": "en-US,en;q=0.9",
    });

    // Inject cookies from cookies.json
    if (cookies.length > 0) {
      await page.setCookie(
        ...cookies.map((c) => ({
          name: c.name,
          value: c.value,
          domain: c.domain?.replace(/^\.www\./, ".") || ".tiktok.com",
          path: c.path || "/",
          expires: c.expires,
          httpOnly: Boolean(c.httpOnly),
          secure: Boolean(c.secure),
          sameSite: (c.sameSite as "Strict" | "Lax" | "None") || "None",
        }))
      );
    }

    let videoData: TikTokVideoInfo | null = null;

    // Intercept TikTok API responses
    const capturePromise = new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, 8000);

      page.on("response", async (response: import("puppeteer").HTTPResponse) => {
        if (videoData) return;
        const resUrl = response.url();
        const isVideoApi =
          resUrl.includes("/api/item/detail/") ||
          resUrl.includes("aweme/v1/feed") ||
          resUrl.includes("aweme/v1/aweme/detail");

        if (isVideoApi && response.status() === 200) {
          try {
            const json = await response.json();
            const item =
              json?.itemInfo?.itemStruct ??
              json?.aweme_list?.[0] ??
              json?.aweme_detail;
            if (item) {
              videoData = parseItem(item, url);
              clearTimeout(timer);
              resolve();
            }
          } catch {}
        }
      });
    });

    // Navigate to TikTok video
    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout,
    });

    await capturePromise;

    // Fallback: extract HTML and parse universally
    if (!videoData) {
      const html = (await page.evaluate(() => document.documentElement.outerHTML)) as string;
      console.info(`[Scraper] Page HTML length: ${html.length} bytes`);

      if (html.length > 10000) {
        // Universal Parse: application/json
        const jsonScriptMatches = html.matchAll(/<script[^>]+type="application\/json"[^>]*>([\s\S]*?)<\/script>/g);
        for (const m of jsonScriptMatches) {
          if (!m[1]?.includes("itemStruct") && !m[1]?.includes("aweme_id")) continue;
          try {
            const parsed = JSON.parse(m[1]);
            const v = parseNextData(parsed, url) ?? parseSigiState(parsed, url);
            if (v) {
              videoData = v;
              break;
            }
          } catch {}
        }

        if (!videoData) {
          // Universal Parse: __UNIVERSAL_DATA_FOR_REHYDRATION__
          const universalMatches = html.match(/<script[^>]*id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>([\s\S]*?)<\/script>/);
          if (universalMatches?.[1]) {
            try {
              const parsed = JSON.parse(universalMatches[1]);
              const defaultScope = parsed?.["__DEFAULT_SCOPE__"];
              const webappVideoDetail = defaultScope?.["webapp.video-detail"];
              const itemInfo = webappVideoDetail?.itemInfo?.itemStruct;
              if (itemInfo) {
                videoData = parseItem(itemInfo, url);
              } else {
                // look globally
                const jsonStr = JSON.stringify(parsed);
                const itemMatch = jsonStr.match(/"itemStruct":(\{.*?\})/);
                if (itemMatch?.[1]) {
                  const item = JSON.parse(itemMatch[1] + "}");
                  if (item.id || item.desc) videoData = parseItem(item, url);
                }
              }
            } catch (e) {
              console.warn("Universal data parsing failed:", e);
            }
          }
        }

        if (!videoData) {
          // Universal Parse: SIGI_STATE
          const sigiPatterns = [
            /window\['SIGI_STATE'\]\s*=\s*(\{[\s\S]*?\});\s*window\[/,
            /window\.SIGI_STATE\s*=\s*(\{[\s\S]*?\});\s*(?:window|var|let|const)/,
            /"SIGI_STATE"\s*:\s*(\{[\s\S]*?\})\s*[,}]/,
          ];
          for (const pat of sigiPatterns) {
            const m = html.match(pat);
            if (m?.[1]) {
              try {
                videoData = parseSigiState(JSON.parse(m[1]), url);
                if (videoData) break;
              } catch {}
            }
          }
        }
        
        if (!videoData) {
           // Debug: log script ids to terminal to see what TikTok uses
           const scriptIds = [...html.matchAll(/<script[^>]*id="([^"]+)"/g)].map(m => m[1]);
           console.info(`[Scraper] Found script IDs: ${scriptIds.join(", ")}`);
           throw new Error("HTML cukup besar, tetapi format JSON video tidak ditemukan.");
        }
      } else {
        throw new Error(`Halaman masih kecil (${html.length} bytes) — WAF mungkin memblok headless browser.`);
      }
    }

    return videoData;
  } finally {
    await browser.close();
  }
}

// ─── HTTP Fallback (akan diblok WAF, tapi dicoba dulu) ───────────────────────

async function scrapeViaHttp(
  url: string,
  videoId: string,
  cookies: TikTokCookie[],
  timeout: number
): Promise<TikTokVideoInfo> {
  const axios = (await import("axios")).default;
  const cookieHeader = buildCookieHeader(cookies);
  const headers = buildHeaders(cookieHeader);

  const endpoints = [
    `https://www.tiktok.com/api/item/detail/?itemId=${videoId}&aid=1988`,
    `https://api16-normal-c-useast1a.tiktokv.com/aweme/v1/feed/?aweme_id=${videoId}&version_code=262036`,
  ];

  for (const endpoint of endpoints) {
    try {
      const res = await axios.get(endpoint, {
        headers,
        timeout,
        decompress: true,
        validateStatus: (s) => s < 500,
      });

      const data = res.data;
      if (!data || typeof data !== "object" || Buffer.isBuffer(data)) continue;
      if ("0" in data && Object.keys(data).every((k) => !isNaN(Number(k)))) continue;

      const item = data?.itemInfo?.itemStruct ?? data?.aweme_list?.[0] ?? data?.aweme_detail;
      if (item) return parseItem(item, url);
    } catch {}
  }

  throw new Error("HTTP API: semua endpoint gagal");
}

// ─── oEmbed Fallback ──────────────────────────────────────────────────────────

async function scrapeWithOembed(
  url: string,
  cookies: TikTokCookie[],
  videoId: string
): Promise<TikTokVideoInfo> {
  const axios = (await import("axios")).default;
  const res = await axios.get("https://www.tiktok.com/oembed", {
    params: { url },
    headers: buildHeaders(buildCookieHeader(cookies)),
    timeout: 15000,
  });
  const d = res.data;
  return {
    id: videoId,
    url,
    title: d.title ?? "TikTok Video",
    author: {
      id: "",
      username: d.author_unique_id ?? "unknown",
      nickname: d.author_name ?? "Unknown",
      avatar: d.thumbnail_url ?? "",
      verified: false,
    },
    thumbnail: d.thumbnail_url ?? "",
    duration: 0,
    stats: { plays: 0, likes: 0, comments: 0, shares: 0 },
    downloadOptions: [],
    fetchedAt: Date.now(),
  };
}

// ─── Parsers ──────────────────────────────────────────────────────────────────

function parseItem(item: Record<string, unknown>, originalUrl: string): TikTokVideoInfo {
  const author = (item.author as Record<string, unknown>) ?? {};
  const video = (item.video as Record<string, unknown>) ?? {};
  const stats = ((item.stats ?? item.statistics ?? item.statistics) as Record<string, unknown>) ?? {};
  const music = item.music as Record<string, unknown> | undefined;

  const downloadOptions: DownloadOption[] = [];

  const getUrl = (addr: unknown): string => {
    if (!addr) return "";
    if (typeof addr === "string") return addr;
    const a = addr as Record<string, unknown>;
    const list = a.url_list as string[] | undefined;
    return list?.[0] ?? "";
  };

  // No-watermark: downloadAddr (web) or download_addr (mobile)
  const noWmUrl = getUrl(video.downloadAddr ?? video.download_addr) ||
    getUrl(video.playAddr ?? video.play_addr);
  if (noWmUrl) {
    downloadOptions.push({
      quality: "1080p",
      format: "mp4",
      url: noWmUrl,
      hasWatermark: false,
      bitrate: video.bitrate as number | undefined,
    });
  }

  // Play URL (may have watermark)
  const playUrl = getUrl(video.playAddr ?? video.play_addr);
  if (playUrl && playUrl !== noWmUrl) {
    downloadOptions.push({ quality: "720p", format: "mp4", url: playUrl, hasWatermark: true });
  }

  const thumbnail = getUrl(video.originCover ?? video.cover ?? video.origin_cover) ||
    getUrl(video.dynamicCover ?? video.dynamic_cover);

  return {
    id: String(item.id ?? item.aweme_id ?? ""),
    url: originalUrl,
    title: String(item.desc ?? "TikTok Video"),
    description: String(item.desc ?? ""),
    author: {
      id: String(author.id ?? author.uid ?? ""),
      username: String(author.uniqueId ?? author.unique_id ?? ""),
      nickname: String(author.nickname ?? ""),
      avatar: getUrl(author.avatarLarger ?? author.avatarThumb ?? author.avatar_thumb),
      verified: Boolean(author.verified ?? author.verification_type),
    },
    thumbnail,
    duration: Number(video.duration ?? 0),
    width: Number(video.width ?? 0) || undefined,
    height: Number(video.height ?? 0) || undefined,
    stats: {
      plays: Number(stats.playCount ?? stats.play_count ?? 0),
      likes: Number(stats.diggCount ?? stats.digg_count ?? 0),
      comments: Number(stats.commentCount ?? stats.comment_count ?? 0),
      shares: Number(stats.shareCount ?? stats.share_count ?? 0),
    },
    music: music ? {
      id: String(music.id ?? ""),
      title: String(music.title ?? ""),
      author: String(music.authorName ?? music.author ?? ""),
      coverUrl: getUrl(music.coverThumb ?? music.cover_thumb),
    } : undefined,
    downloadOptions,
    fetchedAt: Date.now(),
  };
}

function parseNextData(data: Record<string, unknown>, url: string): TikTokVideoInfo | null {
  try {
    const props = (data?.props as Record<string, unknown>)?.pageProps as Record<string, unknown>;
    const item =
      (props?.itemInfo as Record<string, unknown>)?.itemStruct ??
      (props?.videoData as Record<string, unknown>)?.itemStruct ??
      props?.videoData;
    if (item) return parseItem(item as Record<string, unknown>, url);
  } catch {}
  return null;
}

function parseSigiState(data: Record<string, unknown>, url: string): TikTokVideoInfo | null {
  try {
    const itemModule = data?.ItemModule as Record<string, unknown> | undefined;
    if (!itemModule) return null;
    const videoId = Object.keys(itemModule)[0];
    if (!videoId) return null;
    const item = itemModule[videoId] as Record<string, unknown>;
    
    // In SIGI_STATE, author data is separated in UserModule
    const userModule = data?.UserModule as Record<string, unknown> | undefined;
    const authorId = String(item.author ?? "");
    if (userModule && authorId && userModule[authorId]) {
      item.author = userModule[authorId];
    }
    
    return parseItem(item, url);
  } catch {}
  return null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildCookieHeader(cookies: TikTokCookie[]): string {
  return cookies.map((c) => `${c.name}=${c.value}`).join("; ");
}

function buildHeaders(cookieHeader: string) {
  return {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    Referer: "https://www.tiktok.com/",
    Origin: "https://www.tiktok.com",
    Cookie: cookieHeader,
    Accept: "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-origin",
  };
}

function extractVideoId(url: string): string | null {
  const m = url.match(/tiktok\.com\/@[\w.-]+\/video\/(\d+)/);
  return m?.[1] ?? null;
}

async function resolveShortUrl(url: string, cookies: TikTokCookie[]): Promise<string> {
  if (!url.includes("vm.tiktok.com") && !url.includes("vt.tiktok.com")) return url;
  try {
    const axios = (await import("axios")).default;
    const res = await axios.get(url, {
      maxRedirects: 10,
      validateStatus: () => true,
      headers: { "User-Agent": "Mozilla/5.0 Chrome/124.0.0.0", Cookie: buildCookieHeader(cookies) },
    });
    return (res.request as { res?: { responseUrl?: string } })?.res?.responseUrl ?? url;
  } catch {
    return url;
  }
}
