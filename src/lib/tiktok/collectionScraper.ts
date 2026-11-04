import type { TikTokCookie } from "@/types/cookie";
import { getChromeExecutablePath } from "@/lib/puppeteerConfig";

export interface ExtractUrlsOptions {
  cookies?: TikTokCookie[];
  timeout?: number;
  maxUrls?: number;
}

export async function scrapeCollectionUrls(
  url: string,
  options: ExtractUrlsOptions = {}
): Promise<string[]> {
  const { cookies = [], timeout = 90000, maxUrls = 150 } = options;

  let puppeteerExtra: any;
  try {
    puppeteerExtra = (await import("puppeteer-extra")).default;
    const StealthPlugin = (await import("puppeteer-extra-plugin-stealth")).default;
    puppeteerExtra.use(StealthPlugin());
  } catch (e) {
    throw new Error("puppeteer-extra tidak tersedia.");
  }

  const executablePath = getChromeExecutablePath();
  if (executablePath) {
    console.info(`[CollectionScraper] Menggunakan Chrome sistem: ${executablePath}`);
  }

  const browser = await puppeteerExtra.launch({
    headless: true,
    ...(executablePath ? { executablePath } : {}),
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-blink-features=AutomationControlled",
      "--window-size=1280,900",
    ],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });

    // PENTING: User-Agent asli agar TikTok tidak memblok panggilan AJAX API berikutnya
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    );

    await page.setExtraHTTPHeaders({
      "Accept-Language": "en-US,en;q=0.9,id;q=0.8",
    });

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

    const usernameMatch = url.match(/@([a-zA-Z0-9_.-]+)/);
    const targetUsername = usernameMatch ? usernameMatch[1] : "video";

    const capturedMap = new Map<string, string>(); // videoId -> fullUrl

    // ── 1. Intercept Network API Response (Target Feed TikTok) ────────────────
    page.on("response", async (response: import("puppeteer").HTTPResponse) => {
      const resUrl = response.url();
      const isTargetFeed =
        (resUrl.includes("/post/item_list") ||
          resUrl.includes("/playlist/item_list") ||
          resUrl.includes("/collection/item_list") ||
          resUrl.includes("/user/playlist") ||
          resUrl.includes("/mix/item_list") ||
          resUrl.includes("aweme/v1/feed")) &&
        !resUrl.includes("explore");

      if (isTargetFeed && response.status() === 200) {
        try {
          const text = await response.text();
          // Ekstrak semua video ID dari JSON response
          const idMatches = text.matchAll(/"(?:id|aweme_id)":"?(\d{18,20})"?/g);
          for (const m of idMatches) {
            const vidId = m[1];
            if (!capturedMap.has(vidId)) {
              capturedMap.set(
                vidId,
                `https://www.tiktok.com/@${targetUsername}/video/${vidId}`
              );
            }
          }
        } catch {}
      }
    });

    console.info(`[CollectionScraper] Navigating to: ${url}`);
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 35000 });
    await new Promise((r) => setTimeout(r, 3000));

    // Helper untuk mengekstrak URL dari elemen DOM <a>
    const collectFromDOM = async () => {
      const domLinks = await page.evaluate(() => {
        const anchors = Array.from(document.querySelectorAll("a"));
        const links: { id: string; url: string }[] = [];
        anchors.forEach((a) => {
          const href = a.href;
          if (href && href.includes("/video/")) {
            const m = href.match(/\/video\/(\d{18,20})/);
            if (m) {
              try {
                const urlObj = new URL(href);
                links.push({
                  id: m[1],
                  url: `${urlObj.origin}${urlObj.pathname}`,
                });
              } catch {
                links.push({ id: m[1], url: href.split("?")[0] });
              }
            }
          }
        });
        return links;
      });

      domLinks.forEach((item: { id: string; url: string }) => {
        if (!capturedMap.has(item.id)) {
          capturedMap.set(item.id, item.url);
        }
      });
    };

    // Ambil data awal dari DOM
    await collectFromDOM();
    console.info(`[CollectionScraper] Initial captured URLs: ${capturedMap.size}`);

    // ── 2. Scroll Loop: Bypass Modal & Trigger Infinite Pagination ────────────
    const startTime = Date.now();
    let consecutiveNoNew = 0;
    let lastCount = capturedMap.size;
    const maxScrollRounds = 30; // Mendukung hingga ~300+ video

    for (let round = 0; round < maxScrollRounds; round++) {
      if (capturedMap.size >= maxUrls) {
        console.info(`[CollectionScraper] Max URLs (${maxUrls}) reached.`);
        break;
      }

      if (Date.now() - startTime > timeout) {
        console.info(`[CollectionScraper] Timeout reached (${timeout}ms).`);
        break;
      }

      // Hapus / tutup modal login TikTok yang mengunci overflow
      await page.evaluate(() => {
        document.body.style.overflow = "auto";
        document.documentElement.style.overflow = "auto";

        const closeSelectors = [
          '[data-e2e="modal-close-icon"]',
          '[class*="ButtonClose"]',
          '[aria-label="Close"]',
          'button[class*="close"]',
        ];
        closeSelectors.forEach((sel) => {
          document.querySelectorAll(sel).forEach((el) => (el as HTMLElement).click());
        });

        const modalContainers = document.querySelectorAll(
          '[id*="login-modal"], div[class*="modal"], div[aria-modal="true"], div[class*="DivModalContainer"]'
        );
        modalContainers.forEach((m) => m.remove());
      });

      // Scroll ke paling bawah halaman
      await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight);
      });

      // Putar mouse wheel untuk memicu event observer TikTok
      await page.mouse.move(640, 450);
      await page.mouse.wheel({ deltaY: 2500 });

      // Beri waktu bagi AJAX API TikTok untuk mengembalikan batch video baru
      await new Promise((r) => setTimeout(r, 2600));

      // Kumpulkan dari DOM yang baru di-render
      await collectFromDOM();

      console.info(
        `[CollectionScraper] Round ${round + 1} - Total Video: ${capturedMap.size}`
      );

      if (capturedMap.size > lastCount) {
        lastCount = capturedMap.size;
        consecutiveNoNew = 0;
      } else {
        consecutiveNoNew++;
        // Coba scroll tambahan jika belum ada hasil
        await page.mouse.wheel({ deltaY: 3000 });
        await new Promise((r) => setTimeout(r, 1500));
        await collectFromDOM();

        if (consecutiveNoNew >= 3) {
          console.info(
            `[CollectionScraper] Koleksi selesai atau tidak ada video baru lagi.`
          );
          break;
        }
      }
    }

    return Array.from(capturedMap.values());
  } finally {
    await browser.close();
  }
}
