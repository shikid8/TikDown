// ─── TikTok Cookie Type ──────────────────────────────────────────────────────

export interface TikTokCookie {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires?: number;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: "Strict" | "Lax" | "None";
}

export type CookieFormat = "netscape" | "json" | "header";

export interface CookieSession {
  id: string;
  cookies: TikTokCookie[];
  createdAt: number;
  expiresAt?: number;
  isValid: boolean;
}

export interface CookieValidationResult {
  isValid: boolean;
  message: string;
  cookies?: TikTokCookie[];
  sessionId?: string;
}
