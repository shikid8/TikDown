declare module "puppeteer-extra" {
  import type { Browser, LaunchOptions } from "puppeteer";

  interface PuppeteerExtra {
    use(plugin: unknown): this;
    launch(options?: LaunchOptions): Promise<Browser>;
  }

  const puppeteerExtra: PuppeteerExtra;
  export default puppeteerExtra;
}

declare module "puppeteer-extra-plugin-stealth" {
  function StealthPlugin(): unknown;
  export default StealthPlugin;
}
