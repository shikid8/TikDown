// ─── Cookie Encryption Utility ────────────────────────────────────────────────
// Enkripsi/dekripsi payload cookie TikTok menggunakan AES-256-GCM.
// Key dibaca dari env COOKIE_ENCRYPTION_KEY (min 32 karakter).

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";

const ALGORITHM = "aes-256-gcm";

function getDerivedKey(): Buffer {
  const secret =
    process.env.COOKIE_ENCRYPTION_KEY ||
    "default-secret-key-change-in-prod!!";
  // scryptSync menghasilkan key 32 byte dari secret apapun panjangnya
  return scryptSync(secret, "tiktok-dl-salt", 32);
}

/**
 * Enkripsi string plaintext → format: iv:authTag:ciphertext (hex)
 */
export function encryptPayload(plaintext: string): string {
  const key = getDerivedKey();
  const iv = randomBytes(12); // 96-bit IV untuk GCM
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return [iv.toString("hex"), authTag.toString("hex"), encrypted.toString("hex")].join(":");
}

/**
 * Dekripsi string terenkripsi → plaintext.
 * Throw jika format tidak valid atau autentikasi gagal.
 */
export function decryptPayload(payload: string): string {
  const parts = payload.split(":");
  if (parts.length !== 3) {
    throw new Error("Format payload terenkripsi tidak valid");
  }

  const [ivHex, tagHex, encryptedHex] = parts;
  const key = getDerivedKey();
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(tagHex, "hex");
  const encrypted = Buffer.from(encryptedHex, "hex");

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  return (
    decipher.update(encrypted).toString("utf8") +
    decipher.final("utf8")
  );
}

