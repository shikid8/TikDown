// ─── Simple In-Memory Rate Limiter ────────────────────────────────────────────
// Membatasi jumlah request per IP dalam window waktu tertentu.
// Cocok untuk deployment single-instance (Render). Untuk multi-instance gunakan Redis.

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

// Map: ip → record
const store = new Map<string, RateLimitRecord>();

// Bersihkan entri lama setiap 5 menit agar tidak memory leak
setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of store.entries()) {
    if (now > record.resetAt) store.delete(ip);
  }
}, 5 * 60 * 1000);

/**
 * Cek apakah request dari `ip` masih dalam batas rate limit.
 * @param ip         Alamat IP pengirim
 * @param limit      Jumlah request maksimum dalam window (default dari env atau 20)
 * @param windowMs   Panjang window dalam milidetik (default dari env atau 1 jam)
 * @returns `{ allowed: true }` atau `{ allowed: false, retryAfterMs: number }`
 */
export function checkRateLimit(
  ip: string,
  limit?: number,
  windowMs?: number
): { allowed: boolean; retryAfterMs?: number } {
  const maxRequests =
    limit ?? parseInt(process.env.RATE_LIMIT_MAX || "20", 10);
  const window =
    windowMs ?? parseInt(process.env.RATE_LIMIT_WINDOW_MS || "3600000", 10);

  const now = Date.now();
  const record = store.get(ip);

  if (!record || now > record.resetAt) {
    store.set(ip, { count: 1, resetAt: now + window });
    return { allowed: true };
  }

  if (record.count >= maxRequests) {
    return { allowed: false, retryAfterMs: record.resetAt - now };
  }

  record.count++;
  return { allowed: true };
}

/**
 * Ambil IP dari NextRequest headers.
 * Prioritas: x-forwarded-for → x-real-ip → "unknown"
 */
export function getClientIp(req: import("next/server").NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

