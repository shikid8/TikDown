import type { TikTokCookie } from "@/types/cookie";

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

  const browser = await puppeteerExtra.launch({
    headless: true,
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

    const capturedUrls = new Set<string>();

    // ── 1. Intercept Network API TikTok (item_list / feed) ───────────────────
    page.on("response", async (response: import("puppeteer").HTTPResponse) => {
      const resUrl = response.url();
      const isItemList =
        resUrl.includes("/item_list") ||
        resUrl.includes("aweme/v1/feed") ||
        resUrl.includes("/api/post/item_list") ||
        resUrl.includes("/api/collection/item_list");

      if (isItemList && response.status() === 200) {
        try {
          const json = await response.json();
          const list = json?.itemList || json?.items || json?.aweme_list || [];
          if (Array.isArray(list)) {
            for (const item of list) {
              const id = item?.id || item?.aweme_id;
              const author =
                item?.author?.uniqueId ||
                item?.author?.unique_id ||
                "video";
              if (id) {
                capturedUrls.add(`https://www.tiktok.com/@${author}/video/${id}`);
              }
            }
          }
        } catch {}
      }
    });

    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 35000 });

    // Helper untuk mengekstrak URL dari elemen DOM <a>
    const collectFromDOM = async () => {
      const domUrls = await page.evaluate(() => {
        const anchors = Array.from(document.querySelectorAll("a"));
        const links: string[] = [];
        anchors.forEach((a) => {
          const href = a.href;
          if (href && href.includes("/video/") && href.includes("tiktok.com")) {
            try {
              const urlObj = new URL(href);
              links.push(`${urlObj.origin}${urlObj.pathname}`);
            } catch {
              links.push(href.split("?")[0]);
            }
          }
        });
        return links;
      });
      domUrls.forEach((u: string) => capturedUrls.add(u));
    };

    // Ambil batch pertama dari DOM
    await collectFromDOM();

    // ── 2. Scroll Loop dengan Bypass Modal Login & Real Mouse Wheel ──────────
    const startTime = Date.now();
    let consecutiveNoNewData = 0;
    let lastCount = capturedUrls.size;

    while (Date.now() - startTime < timeout && capturedUrls.size < maxUrls) {
      // Hilangkan / tutup modal login TikTok yang mengunci halaman
      await page.evaluate(() => {
        // Unlock scroll body
        document.body.style.overflow = "auto";
        document.documentElement.style.overflow = "auto";

        // Tutup modal jika ada tombol close
        const closeSelectors = [
          '[data-e2e="modal-close-icon"]',
          '[class*="ButtonClose"]',
          '[aria-label="Close"]',
          'button[class*="close"]',
        ];
        closeSelectors.forEach((sel) => {
          document.querySelectorAll(sel).forEach((el) => (el as HTMLElement).click());
        });

        // Hapus container modal overlay login jika masih ada
        const modalContainers = document.querySelectorAll(
          '[id*="login-modal"], div[class*="DivModalContainer"], div[class*="login-modal"], div[aria-modal="true"]'
        );
        modalContainers.forEach((m) => m.remove());
      });

      // Simulasi pergerakan mouse dan putaran roda (mouse wheel) ke bawah
      await page.mouse.move(640, 450);
      await page.mouse.wheel({ deltaY: 1500 });

      // Fallback scroll window ke dasar
      await page.evaluate(() => {
        window.scrollBy(0, 1500);
      });

      // Beri jeda agar request AJAX TikTok selesai dimuat
      await new Promise((r) => setTimeout(r, 1500));

      // Kumpulkan URL baru dari DOM
      await collectFromDOM();

      if (capturedUrls.size > lastCount) {
        lastCount = capturedUrls.size;
        consecutiveNoNewData = 0;
      } else {
        consecutiveNoNewData++;
        // Coba scroll lebih jauh
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await new Promise((r) => setTimeout(r, 1000));
        await collectFromDOM();

        // Jika 4x percobaan berturut-turut tidak ada URL baru dan tinggi stabil, berarti sudah mencapai akhir
        if (consecutiveNoNewData >= 4) {
          break;
        }
      }
    }

    return Array.from(capturedUrls);
  } finally {
    await browser.close();
  }
}
