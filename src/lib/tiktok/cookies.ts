// ─── Cookie Parser & Validator ────────────────────────────────────────────────
import type { TikTokCookie, CookieFormat, CookieValidationResult } from "@/types/cookie";

// Required cookies for TikTok session
const REQUIRED_COOKIE_NAMES = ["sessionid"];
const IMPORTANT_COOKIE_NAMES = ["tt_chain_token", "msToken", "s_v_web_id"];

/**
 * Parse Netscape cookie format (exported from browser extensions)
 * Format: .domain  TRUE  /path  SECURE  expires  name  value
 */
export function parseNetscapeCookies(raw: string): TikTokCookie[] {
  const lines = raw
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"));

  return lines.map((line) => {
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
  }).filter(Boolean) as TikTokCookie[];
}

/**
 * Parse header string format: "key=value; key2=value2"
 */
export function parseHeaderCookies(raw: string): TikTokCookie[] {
  return raw
    .split(";")
    .map((pair) => pair.trim())
    .filter(Boolean)
    .map((pair) => {
      const eqIdx = pair.indexOf("=");
      if (eqIdx === -1) return null;
      const name = pair.slice(0, eqIdx).trim();
      const value = pair.slice(eqIdx + 1).trim();
      return {
        name,
        value,
        domain: ".tiktok.com",
        path: "/",
        secure: true,
        sameSite: "None" as const,
      };
    })
    .filter(Boolean) as TikTokCookie[];
}

/**
 * Parse JSON format: array of cookie objects
 */
export function parseJsonCookies(raw: string): TikTokCookie[] {
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) throw new Error("Expected JSON array of cookies");

  return parsed.map((c: Record<string, unknown>) => ({
    name: String(c.name ?? ""),
    value: String(c.value ?? ""),
    domain: String(c.domain ?? ".tiktok.com"),
    path: String(c.path ?? "/"),
    expires: typeof c.expires === "number" ? c.expires : undefined,
    httpOnly: Boolean(c.httpOnly),
    secure: Boolean(c.secure),
    sameSite: (c.sameSite as TikTokCookie["sameSite"]) ?? "None",
  }));
}

/**
 * Auto-detect cookie format and parse accordingly
 */
export function parseCookies(raw: string, format: CookieFormat): TikTokCookie[] {
  const trimmed = raw.trim();
  switch (format) {
    case "netscape":
      return parseNetscapeCookies(trimmed);
    case "json":
      return parseJsonCookies(trimmed);
    case "header":
      return parseHeaderCookies(trimmed);
    default:
      throw new Error(`Unknown cookie format: ${format}`);
  }
}

/**
 * Validate cookies contain at minimum a sessionid
 */
export function validateCookies(cookies: TikTokCookie[]): CookieValidationResult {
  if (!cookies || cookies.length === 0) {
    return { isValid: false, message: "Cookies kosong atau tidak valid." };
  }

  const names = cookies.map((c) => c.name.toLowerCase());
  const hasSession = REQUIRED_COOKIE_NAMES.every((r) =>
    names.includes(r.toLowerCase())
  );

  if (!hasSession) {
    return {
      isValid: false,
      message: `Cookie 'sessionid' tidak ditemukan. Pastikan Anda sudah login ke TikTok dan mengekspor cookies yang benar.`,
    };
  }

  const missingImportant = IMPORTANT_COOKIE_NAMES.filter(
    (n) => !names.includes(n.toLowerCase())
  );

  return {
    isValid: true,
    cookies,
    message:
      missingImportant.length > 0
        ? `Cookies valid. Beberapa cookie opsional tidak ditemukan: ${missingImportant.join(", ")}`
        : "Cookies valid dan lengkap! Session aktif.",
  };
}

/**
 * Filter cookies to only TikTok-related domains
 */
export function filterTikTokCookies(cookies: TikTokCookie[]): TikTokCookie[] {
  return cookies.filter(
    (c) =>
      c.domain.includes("tiktok.com") ||
      c.domain.includes("bytedance.com") ||
      c.domain === ".tiktok.com" ||
      !c.domain // treat domain-less as universal
  );
}

/**
 * Convert TikTokCookie[] to header string for axios requests
 */
export function cookiesToHeaderString(cookies: TikTokCookie[]): string {
  return cookies.map((c) => `${c.name}=${c.value}`).join("; ");
}
