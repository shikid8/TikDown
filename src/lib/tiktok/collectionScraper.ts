import type { TikTokCookie } from "@/types/cookie";

export interface ExtractUrlsOptions {
  cookies?: TikTokCookie[];
  timeout?: number;
}

export async function scrapeCollectionUrls(
  url: string,
  options: ExtractUrlsOptions = {}
): Promise<string[]> {
  const { cookies = [], timeout = 60000 } = options;

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
    ],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

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

    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });

    // Scroll to bottom to load all videos
    // We will scroll until the height doesn't change, or timeout occurs.
    const startTime = Date.now();
    let previousHeight = 0;
    
    while (Date.now() - startTime < timeout) {
      const currentHeight = await page.evaluate(() => document.body.scrollHeight);
      if (currentHeight === previousHeight) {
        // Wait a bit to see if more content loads
        await new Promise((resolve) => setTimeout(resolve, 2000));
        const newHeight = await page.evaluate(() => document.body.scrollHeight);
        if (newHeight === previousHeight) {
          // Reached the bottom
          break;
        }
      }
      previousHeight = currentHeight;
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await new Promise((resolve) => setTimeout(resolve, 1000)); // wait for lazy load
    }

    // Extract all video URLs
    const videoUrls = await page.evaluate(() => {
      const anchors = Array.from(document.querySelectorAll('a'));
      const urls = new Set<string>();
      
      anchors.forEach(a => {
        const href = a.href;
        // Regex to match typical TikTok video URLs (including embedded or normalized ones)
        if (href && href.includes("/video/") && href.includes("tiktok.com")) {
          // Normalize URL by stripping query parameters
          try {
            const urlObj = new URL(href);
            urls.add(`${urlObj.origin}${urlObj.pathname}`);
          } catch {
            urls.add(href.split('?')[0]);
          }
        }
      });
      
      return Array.from(urls);
    });

    return videoUrls;
  } finally {
    await browser.close();
  }
}
