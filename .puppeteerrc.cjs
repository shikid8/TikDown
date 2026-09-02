const { join } = require("path");

/**
 * Konfigurasi Puppeteer — simpan cache Chrome di dalam folder proyek
 * agar tidak hilang antara build dan runtime di Render/cloud server.
 * @type {import("puppeteer").Configuration}
 */
module.exports = {
  cacheDirectory: join(__dirname, ".cache", "puppeteer"),
};
