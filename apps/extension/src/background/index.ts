// Background service worker stub. Real logic (declarativeNetRequest rule sync, usage-stats
// bookkeeping, cross-tab coordination) lands in later Phase 2 PRs; this only proves the
// extension's background context builds, loads, and registers correctly.
chrome.runtime.onInstalled.addListener(() => {
  console.log("[Guardian] installed");
});
