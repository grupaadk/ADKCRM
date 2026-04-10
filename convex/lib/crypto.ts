/**
 * AES-256-GCM encryption/decryption for sensitive data (API keys, tokens).
 * Uses Web Crypto API available in Convex runtime.
 *
 * Encrypted format: base64(iv:ciphertext:tag) — single string safe for DB storage.
 */

const ALGORITHM = "AES-GCM";
const IV_LENGTH = 12; // 96 bits recommended for GCM

function getEncryptionKey(): string {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    throw new Error(
      "ENCRYPTION_KEY env var not set. Run: npx convex env set ENCRYPTION_KEY $(openssl rand -hex 32)",
    );
  }
  return key;
}

async function importKey(hexKey: string): Promise<CryptoKey> {
  const keyBytes = new Uint8Array(
    hexKey.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16)),
  );
  return crypto.subtle.importKey("raw", keyBytes, { name: ALGORITHM }, false, [
    "encrypt",
    "decrypt",
  ]);
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function fromBase64(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Encrypt a plaintext string. Returns a base64 encoded string containing iv + ciphertext.
 */
export async function encrypt(plaintext: string): Promise<string> {
  const key = await importKey(getEncryptionKey());
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const encoded = new TextEncoder().encode(plaintext);

  const cipherBuffer = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv },
    key,
    encoded,
  );

  // Combine iv + ciphertext into one buffer
  const cipherBytes = new Uint8Array(cipherBuffer);
  const combined = new Uint8Array(iv.length + cipherBytes.length);
  combined.set(iv);
  combined.set(cipherBytes, iv.length);

  return toBase64(combined);
}

/**
 * Decrypt a previously encrypted string.
 */
export async function decrypt(encrypted: string): Promise<string> {
  const key = await importKey(getEncryptionKey());
  const combined = fromBase64(encrypted);

  const iv = combined.slice(0, IV_LENGTH);
  const ciphertext = combined.slice(IV_LENGTH);

  const decrypted = await crypto.subtle.decrypt(
    { name: ALGORITHM, iv },
    key,
    ciphertext,
  );

  return new TextDecoder().decode(decrypted);
}

/**
 * Check if a string looks like an encrypted value (base64 with sufficient length).
 */
export function isEncrypted(value: string): boolean {
  try {
    const decoded = fromBase64(value);
    return decoded.length > IV_LENGTH + 16; // iv + at least some ciphertext + tag
  } catch {
    return false;
  }
}
