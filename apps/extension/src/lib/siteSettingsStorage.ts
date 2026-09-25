/**
 * Thin wrapper over chrome.storage.local for the person's own AI-site allow/block choices (PR 12
 * - a self-directed, personal-mode control; parent-set policy is Phase 3, once it can sync from a
 * backend). Stores site *names* (as grouped by lib/aiSiteGroups.ts), not domains - the popup's
 * toggle is one per site the person recognizes, and lib/blockRules.ts expands a blocked name to
 * every domain it covers. Deliberately not unit-tested: this is pure wiring around the real
 * chrome.storage API, exercised instead by the extension's own e2e tests running in a real
 * browser.
 */
const BLOCKED_SITES_KEY = "guardianBlockedSites";

export async function getBlockedSites(): Promise<string[]> {
  const result = await chrome.storage.local.get(BLOCKED_SITES_KEY);
  const value: unknown = result[BLOCKED_SITES_KEY];
  return Array.isArray(value) ? (value as string[]) : [];
}

export async function setSiteBlocked(siteName: string, blocked: boolean): Promise<void> {
  const current = await getBlockedSites();
  const next = blocked
    ? Array.from(new Set([...current, siteName]))
    : current.filter((name) => name !== siteName);
  await chrome.storage.local.set({ [BLOCKED_SITES_KEY]: next });
}

/** Fires whenever the blocked-sites list changes in this or another extension context (e.g. the
 * background service worker reacting to a toggle made in the popup). */
export function onBlockedSitesChanged(callback: (blockedSites: string[]) => void): void {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local" || !(BLOCKED_SITES_KEY in changes)) {
      return;
    }
    const value: unknown = changes[BLOCKED_SITES_KEY]?.newValue;
    callback(Array.isArray(value) ? (value as string[]) : []);
  });
}

// Whether the person has already seen the one-time Edge/Brave built-in-sidebar notice (PR 12) -
// shown once, not on every popup open, per CLAUDE.md's data-minimization spirit applied to the
// person's own attention, not just their data.
const BROWSER_NOTICE_SEEN_KEY = "guardianBrowserNoticeSeen";

export async function hasSeenBrowserNotice(): Promise<boolean> {
  const result = await chrome.storage.local.get(BROWSER_NOTICE_SEEN_KEY);
  return result[BROWSER_NOTICE_SEEN_KEY] === true;
}

export async function markBrowserNoticeSeen(): Promise<void> {
  await chrome.storage.local.set({ [BROWSER_NOTICE_SEEN_KEY]: true });
}
