import type { VaultEntry } from "@guardian/engine-ts";
import { decryptVault, encryptVault, type EncryptedVaultBlob } from "./vaultCrypto.js";

/**
 * Thin wrapper over chrome.storage.local for the encrypted vault blob (PR 14) - stores only
 * ciphertext, salt, IV, and the PBKDF2 iteration count used, never the passphrase or plaintext
 * vault contents. Deliberately not unit-tested directly (same style as
 * lib/siteSettingsStorage.ts): this is thin real-API wiring around chrome.storage, exercised
 * instead by the extension's own e2e tests. The actual crypto (lib/vaultCrypto.ts) is unit-tested
 * on its own.
 */
const VAULT_BLOB_KEY = "guardianVaultBlob";

export interface VaultContents {
  entries: VaultEntry[];
}

export async function getVaultBlob(): Promise<EncryptedVaultBlob | null> {
  const result = await chrome.storage.local.get(VAULT_BLOB_KEY);
  const value: unknown = result[VAULT_BLOB_KEY];
  return value && typeof value === "object" ? (value as EncryptedVaultBlob) : null;
}

export async function saveVault(passphrase: string, contents: VaultContents): Promise<void> {
  const blob = await encryptVault(passphrase, JSON.stringify(contents));
  await chrome.storage.local.set({ [VAULT_BLOB_KEY]: blob });
}

/** Returns `null` if no vault has been created yet, so a caller can tell "empty vault" (an
 * existing, decryptable blob with zero entries) apart from "never set up" - the UI shows a
 * different first-run state for each. Throws VaultDecryptionError (see vaultCrypto.ts) for a wrong
 * passphrase, same as decryptVault(). */
export async function loadVault(passphrase: string): Promise<VaultContents | null> {
  const blob = await getVaultBlob();
  if (!blob) {
    return null;
  }
  const plaintext = await decryptVault(passphrase, blob);
  return JSON.parse(plaintext) as VaultContents;
}

/** Permanently deletes the vault blob - CLAUDE.md's lost-passphrase-means-lost-vault design means
 * this is also effectively what "I forgot my passphrase" leads to: starting over, not recovering.
 */
export async function deleteVault(): Promise<void> {
  await chrome.storage.local.remove(VAULT_BLOB_KEY);
}
