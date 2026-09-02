// ─── Local Cookies File Reader ────────────────────────────────────────────────
// Membaca cookies dari file lokal (cookies.json) di server side.
// Ini adalah pendekatan yang LEBIH SIMPEL daripada UI-based cookie input.
// File path dikonfigurasi via COOKIES_FILE di .env.local

import fs from "fs";
import path from "path";
import type { TikTokCookie } from "@/types/cookie";
import { filterTikTokCookies, validateCookies } from "./cookies";

/**
 * Baca cookies dari file lokal yang dikonfigurasi via COOKIES_FILE env variable.
 * Secara default membaca dari ./cookies.json di root project.
 *
 * Format file yang didukung:
 * 1. JSON Array: [ {name, value, domain, path, ...} ]
 * 2. Netscape format (text dengan tab-separated values)
 * 3. Header string: "name=value; name2=value2"
 */
export async function loadLocalCookies(): Promise<TikTokCookie[]> {
  // ── Prioritas 1: Environment variable (untuk server cloud seperti Render) ──
  const cookiesEnv = process.env.TIKTOK_COOKIES_JSON;
  if (cookiesEnv) {
    try {
      const parsed = JSON.parse(cookiesEnv);
      const cookies = Array.isArray(parsed) ? parsed : [];
      const filtered = filterTikTokCookies(cookies);
      if (filtered.length > 0) {
        console.info(`[LocalCookies] ✅ ${filtered.length} cookies dimuat dari TIKTOK_COOKIES_JSON env`);
        return filtered;
      }
    } catch (e) {
      console.warn("[LocalCookies] Gagal parse TIKTOK_COOKIES_JSON:", (e as Error).message);
    }
  }

  // ── Prioritas 2: File lokal cookies.json ──
  const cookiesPath = process.env.COOKIES_FILE || "./cookies.json";
  const absolutePath = path.resolve(process.cwd(), cookiesPath);

  if (!fs.existsSync(absolutePath)) {
    console.info(`[LocalCookies] File tidak ditemukan: ${absolutePath}`);
    return [];
  }

  try {
    const raw = fs.readFileSync(absolutePath, "utf-8").trim();

    // Deteksi format otomatis
    const cookies = autoDetectAndParse(raw);
    const filtered = filterTikTokCookies(cookies);

    if (filtered.length === 0) {
      console.warn("[LocalCookies] Tidak ada cookies TikTok yang valid ditemukan di file.");
      return [];
    }

    const validation = validateCookies(filtered);
    if (!validation.isValid) {
      console.warn(`[LocalCookies] Validasi gagal: ${validation.message}`);
      // Tetap return cookies meskipun validasi gagal — biarkan scraper coba
      return filtered;
    }

    console.info(`[LocalCookies] ✅ ${filtered.length} cookies dimuat dari ${cookiesPath}`);
    return filtered;
  } catch (error) {
    console.error(`[LocalCookies] Gagal membaca file cookies: ${(error as Error).message}`);
    return [];
  }
}

/**
 * Deteksi format cookies secara otomatis dan parse
 */
function autoDetectAndParse(raw: string): TikTokCookie[] {
  // Coba JSON array terlebih dahulu
  if (raw.startsWith("[")) {
    return parseJsonFormat(raw);
  }

  // Coba Netscape format (baris dengan tab)
  if (raw.includes("\t") || raw.startsWith("#")) {
    return parseNetscapeFormat(raw);
  }

  // Fallback: header string format
  return parseHeaderFormat(raw);
}

/**
 * Parse JSON array format:
 * [ {name, value, domain, path, secure, httpOnly, sameSite, expires?} ]
 */
function parseJsonFormat(raw: string): TikTokCookie[] {
  const parsed = JSON.parse(raw);

  if (!Array.isArray(parsed)) {
    throw new Error("Format JSON harus berupa array: [{name, value, ...}]");
  }

  return parsed
    .filter((c) => c && typeof c.name === "string" && typeof c.value === "string")
    .map((c: Record<string, unknown>) => ({
      name: String(c.name),
      value: String(c.value),
      domain: String(c.domain ?? ".tiktok.com"),
      path: String(c.path ?? "/"),
      expires: typeof c.expires === "number" ? c.expires : undefined,
      httpOnly: Boolean(c.httpOnly),
      secure: Boolean(c.secure ?? true),
      sameSite: (c.sameSite as TikTokCookie["sameSite"]) ?? "None",
    }));
}

/**
 * Parse Netscape format:
 * .tiktok.com  TRUE  /  TRUE  0  name  value
 */
function parseNetscapeFormat(raw: string): TikTokCookie[] {
  const lines = raw
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"));

  return lines
    .map((line) => {
      const parts = line.split("\t");
      if (parts.length < 7) return null;
      const [domain, , path, secure, expires, name, value] = parts;
      return {
        name: name.trim(),
        value: value?.trim() ?? "",
        domain: domain.trim(),
        path: path.trim(),
        secure: secure.trim().toUpperCase() === "TRUE",
        expires: parseInt(expires.trim(), 10) || undefined,
        httpOnly: false,
        sameSite: "None" as const,
      };
    })
    .filter(Boolean) as TikTokCookie[];
}

/**
 * Parse header string format:
 * "sessionid=xxx; tt_chain_token=yyy; msToken=zzz"
 */
function parseHeaderFormat(raw: string): TikTokCookie[] {
  return raw
    .split(";")
    .map((pair) => pair.trim())
    .filter(Boolean)
    .map((pair) => {
      const eqIdx = pair.indexOf("=");
      if (eqIdx === -1) return null;
      return {
        name: pair.slice(0, eqIdx).trim(),
        value: pair.slice(eqIdx + 1).trim(),
        domain: ".tiktok.com",
        path: "/",
        secure: true,
        httpOnly: false,
        sameSite: "None" as const,
      };
    })
    .filter(Boolean) as TikTokCookie[];
}

/**
 * Cek apakah file cookies lokal ada dan valid
 */
export function hasLocalCookiesFile(): boolean {
  const cookiesPath = process.env.COOKIES_FILE || "./cookies.json";
  const absolutePath = path.resolve(process.cwd(), cookiesPath);
  return fs.existsSync(absolutePath);
}

/**
 * Konversi array TikTokCookie ke header string untuk HTTP request
 */
export function cookiesToHeaderString(cookies: TikTokCookie[]): string {
  return cookies.map((c) => `${c.name}=${c.value}`).join("; ");
}
