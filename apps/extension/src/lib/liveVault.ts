import type { VaultEntry } from "@guardian/engine-ts";
import { getVaultSessionCache } from "./vaultSessionCache.js";

const REFRESH_INTERVAL_MS = 5000;

/**
 * Keeps a live, synchronously-readable snapshot of the vault session cache for a content script's
 * own outgoing (compose-box) detection. detect() needs a Context synchronously on every keystroke
 * and at send-interception time, but the vault lives in chrome.storage.session (async) - awaiting
 * it on every call would make typing feel slow, which CLAUDE.md's <20ms latency intent rules out.
 *
 * Deliberately throttled to real activity, not a blind background timer: the returned getter only
 * kicks off a refresh (at most once per REFRESH_INTERVAL_MS) when it's actually called, which only
 * happens when the person is typing, pasting, or sending - i.e. only while they're actively using
 * the compose box. A `setInterval` running regardless of activity would keep extending the vault
 * session cache's own idle-timeout (lib/vaultSessionCache.ts) forever, for as long as an AI-site
 * tab merely stayed open - defeating the "auto-lock if the person walks away" property that timeout
 * exists for. Tying refreshes to actual compose-box use keeps that property intact: no typing, no
 * refresh, and the vault's own idle timer runs down normally.
 *
 * A new vault entry, or the vault session cache expiring, is picked up within one refresh cycle,
 * not instantly - an explicit, small tradeoff for keeping detection itself synchronous and fast.
 */
export function createLiveVault(): () => VaultEntry[] {
  let current: VaultEntry[] = [];
  let lastRefreshAt = 0;

  function refreshIfStale(): void {
    const now = Date.now();
    if (now - lastRefreshAt < REFRESH_INTERVAL_MS) {
      return;
    }
    lastRefreshAt = now;
    void getVaultSessionCache().then((vault) => {
      current = vault ?? [];
    });
  }

  return () => {
    refreshIfStale();
    return current;
  };
}
