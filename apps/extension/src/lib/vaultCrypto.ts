/**
 * The local family vault's encryption (PR 14, docs/adr/0007-local-vault-crypto-choices.md):
 * PBKDF2 (SHA-256) key derivation + AES-GCM encryption, both native WebCrypto - no new
 * dependency. CLAUDE.md's non-negotiable "protected-values vault is end-to-end encrypted"
 * principle applies to protecting this data at rest even though nothing syncs to a backend yet
 * (see ADR 0007 for why this vault is expected to be reworked, not necessarily reused as-is, once
 * Phase 3 adds real sync).
 *
 * The passphrase itself is never stored anywhere, in any form - only a derived key, held in
 * memory for the current page only, is ever used to encrypt or decrypt. A lost passphrase means a
 * lost vault, by design (CLAUDE.md is explicit about this): there is no recovery mechanism, and
 * none should be added without revisiting that principle first.
 */

// OWASP's current (2023) minimum recommendation for PBKDF2-HMAC-SHA256. Argon2id would be
// stronger but isn't a WebCrypto built-in (see ADR 0007 for why that tradeoff was accepted here).
const PBKDF2_ITERATIONS = 600_000;
const SALT_BYTES = 16;
const IV_BYTES = 12; // AES-GCM's recommended nonce size

export interface EncryptedVaultBlob {
  salt: string; // base64
  iv: string; // base64
  ciphertext: string; // base64
  iterations: number;
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function deriveKey(
  passphrase: string,
  salt: Uint8Array,
  iterations: number,
): Promise<CryptoKey> {
  const passphraseKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: salt as BufferSource, iterations, hash: "SHA-256" },
    passphraseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

/** Encrypts `plaintext` (the vault's serialized JSON) under a freshly generated salt and IV -
 * every save gets its own, per standard AES-GCM practice (an IV must never repeat under the same
 * key). */
export async function encryptVault(
  passphrase: string,
  plaintext: string,
): Promise<EncryptedVaultBlob> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const key = await deriveKey(passphrase, salt, PBKDF2_ITERATIONS);

  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv as BufferSource },
    key,
    new TextEncoder().encode(plaintext),
  );

  return {
    salt: toBase64(salt),
    iv: toBase64(iv),
    ciphertext: toBase64(new Uint8Array(ciphertext)),
    iterations: PBKDF2_ITERATIONS,
  };
}

/** Thrown when decryption fails - always treated as "wrong passphrase" by callers, since
 * AES-GCM's authentication tag makes a wrong key fail decryption rather than silently returning
 * garbage. Never distinguishes "wrong passphrase" from "corrupted data" - CLAUDE.md's vault design
 * doesn't call for that distinction, and guessing wrong here risks leaking information about which
 * case occurred. */
export class VaultDecryptionError extends Error {
  constructor() {
    super("failed to decrypt vault: wrong passphrase or corrupted data");
    this.name = "VaultDecryptionError";
  }
}

export async function decryptVault(passphrase: string, blob: EncryptedVaultBlob): Promise<string> {
  const salt = fromBase64(blob.salt);
  const iv = fromBase64(blob.iv);
  const key = await deriveKey(passphrase, salt, blob.iterations);

  try {
    const plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: iv as BufferSource },
      key,
      fromBase64(blob.ciphertext) as BufferSource,
    );
    return new TextDecoder().decode(plaintext);
  } catch {
    throw new VaultDecryptionError();
  }
}
