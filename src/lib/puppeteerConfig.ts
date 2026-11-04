import fs from "fs";

/**
 * Mencari path executable Google Chrome / Chromium di sistem operasi.
 * Memungkinkan Puppeteer langsung jalan di lokal tanpa error 'Could not find Chrome',
 * serta tetap kompatibel penuh untuk cloud hosting (Render/Linux/Docker).
 */
export function getChromeExecutablePath(): string | undefined {
  // 1. Prioritas utama: Environment variable manual jika diset
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    if (fs.existsSync(process.env.PUPPETEER_EXECUTABLE_PATH)) {
      return process.env.PUPPETEER_EXECUTABLE_PATH;
    }
  }

  // 2. Windows paths (Chrome / Edge Chromium)
  if (process.platform === "win32") {
    const winPaths = [
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
      "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
      process.env.LOCALAPPDATA
        ? `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`
        : "",
      "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
      "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    ].filter(Boolean);

    for (const p of winPaths) {
      if (fs.existsSync(p)) return p;
    }
  }

  // 3. Linux paths (Render / Ubuntu / Debian / Docker)
  if (process.platform === "linux") {
    const linuxPaths = [
      "/usr/bin/google-chrome-stable",
      "/usr/bin/google-chrome",
      "/usr/bin/chromium",
      "/usr/bin/chromium-browser",
    ];
    for (const p of linuxPaths) {
      if (fs.existsSync(p)) return p;
    }
  }

  // 4. macOS paths
  if (process.platform === "darwin") {
    const macPaths = [
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "/Applications/Chromium.app/Contents/MacOS/Chromium",
    ];
    for (const p of macPaths) {
      if (fs.existsSync(p)) return p;
    }
  }

  // 5. Default: undefined (Puppeteer menggunakan Chrome bawaan di .cache/puppeteer)
  return undefined;
}
