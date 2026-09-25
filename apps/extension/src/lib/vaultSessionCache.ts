import type { VaultEntry } from "@guardian/engine-ts";

/**
 * Caches the vault's decrypted contents in chrome.storage.session (PR 15) - memory-only, never
 * written to disk, cleared automatically when the browser fully closes - once unlocked via the
 * options page, so content scripts on AI sites can check both outgoing text and (in family mode)
 * the AI's own replies against it. Without this, the vault's decrypted contents would only ever be
 * reachable from the options page's own memory, a separate JS context content scripts have no
 * access to at all (see docs/adr/0007-local-vault-crypto-choices.md's addendum for the full
 * reasoning and the alternatives considered).
 *
 * Auto-locks after IDLE_TIMEOUT_MS of no use - the same "unlock once, auto-lock on inactivity"
 * pattern password manager extensions use for exactly this problem. Every read extends the window
 * (a sliding expiration), so active use is never interrupted, but the cache reliably clears itself
 * if the person walks away. Populated regardless of mode (see options/main.ts) - originally
 * family-mode-only, widened after real-world testing found vault entries were never protecting
 * outgoing text at all; see that ADR addendum for the owner sign-off on this scope change.
 */
export const IDLE_TIMEOUT_MS = 15 * 60 * 1000;
const CACHE_KEY = "guardianVaultSessionCache";

interface CachedVault {
  entries: VaultEntry[];
  lastUsedAt: number;
}

/** Pure (no chrome.storage access), so the auto-lock boundary itself is unit-testable without a
 * chrome API stub - the rest of this file is thin wiring around chrome.storage.session,
 * deliberately not unit-tested directly (same convention as lib/siteSettingsStorage.ts). */
export function isSessionCacheExpired(lastUsedAt: number, now: number): boolean {
  return now - lastUsedAt > IDLE_TIMEOUT_MS;
}

export async function setVaultSessionCache(entries: VaultEntry[]): Promise<void> {
  const cached: CachedVault = { entries, lastUsedAt: Date.now() };
  await chrome.storage.session.set({ [CACHE_KEY]: cached });
}

/** Returns `null` once the cache has never been set, or has gone idle past the timeout (and
 * clears it in that case) - callers (lib/familyResponseFlagging.ts) treat `null` the same as
 * "family mode isn't usable right now," not an error. Also returns `null` (rather than throwing)
 * if chrome.storage.session itself is unreadable right now - most notably, a content script
 * running before background/index.ts's setAccessLevel(TRUSTED_AND_UNTRUSTED_CONTEXTS) grant has
 * completed (a real startup race, not just a test artifact). Content-flag categories don't need
 * the vault at all (see lib/familyContext.ts), so degrading to "no vault this scan" here is the
 * correct narrow failure, not a reason to let the error propagate and abort the whole scan. */
export async function getVaultSessionCache(): Promise<VaultEntry[] | null> {
  try {
    const result = await chrome.storage.session.get(CACHE_KEY);
    const cached: unknown = result[CACHE_KEY];
    if (!cached || typeof cached !== "object") {
      return null;
    }

    const { entries, lastUsedAt } = cached as CachedVault;
    if (isSessionCacheExpired(lastUsedAt, Date.now())) {
      await clearVaultSessionCache();
      return null;
    }

    await chrome.storage.session.set({ [CACHE_KEY]: { entries, lastUsedAt: Date.now() } });
    return entries;
  } catch {
    return null;
  }
}

export async function clearVaultSessionCache(): Promise<void> {
  await chrome.storage.session.remove(CACHE_KEY);
}
