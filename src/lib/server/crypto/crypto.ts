import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";
import { assertServerOnly } from "@/lib/server/server-guard";

assertServerOnly("src/lib/server/crypto/crypto.ts");

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const DEFAULT_KEY_VERSION = 1;

/**
 * Derives a 32-byte key specifically from `OAUTH_TOKEN_ENCRYPTION_KEY`.
 * Fails closed when key is unconfigured or a placeholder.
 * Never falls back to AUTH_SECRET.
 */
function getEncryptionKey(): Buffer {
  const rawKey = process.env.OAUTH_TOKEN_ENCRYPTION_KEY;

  if (
    !rawKey ||
    typeof rawKey !== "string" ||
    rawKey.trim() === "" ||
    /^replace-with/i.test(rawKey.trim()) ||
    /^your-/i.test(rawKey.trim())
  ) {
    throw new Error("OAUTH_TOKEN_ENCRYPTION_KEY configuration is missing or unconfigured");
  }

  return scryptSync(rawKey.trim(), "aksa-oauth-salt", 32);
}

/**
 * Encrypts a plaintext string (e.g. refresh token) using AES-256-GCM.
 * Output format: base64(IV + AuthTag + Ciphertext)
 */
export function encryptToken(
  plaintext: string,
  keyVersion = DEFAULT_KEY_VERSION
): { ciphertext: string; keyVersion: number } {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  const combined = Buffer.concat([iv, authTag, encrypted]);
  return {
    ciphertext: combined.toString("base64"),
    keyVersion
  };
}

/**
 * Decrypts a base64-encoded AES-256-GCM payload.
 */
export function decryptToken(ciphertext: string): string {
  const key = getEncryptionKey();
  const buffer = Buffer.from(ciphertext, "base64");

  if (buffer.length < IV_LENGTH + AUTH_TAG_LENGTH) {
    throw new Error("Invalid ciphertext length");
  }

  const iv = buffer.subarray(0, IV_LENGTH);
  const authTag = buffer.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const encryptedText = buffer.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([decipher.update(encryptedText), decipher.final()]);
  return decrypted.toString("utf8");
}
