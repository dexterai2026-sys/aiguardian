// Background service worker (docs/phase-2-plan.md, PR 12, PR 15): keeps declarativeNetRequest's
// dynamic rules in sync with the person's own AI-site allow/block choices (a self-directed,
// personal-mode control - CLAUDE.md scopes parent-set blocking policy to Phase 3), sets the
// toolbar icon's title to make protection status visible per the "visible, never covert"
// principle, and grants content scripts read access to chrome.storage.session (PR 15's vault
// session cache, lib/vaultSessionCache.ts) - by default session storage is readable only from
// trusted extension contexts (this service worker, popup, options), not content scripts, which
// Chrome treats as "untrusted" for this purpose even though they're this extension's own code.
// Rule generation itself is pure (lib/blockRules.ts, lib/aiSiteGroups.ts, both unit-tested) - this
// file is only the thin wiring to the real chrome.declarativeNetRequest/chrome.storage APIs.
import { getAiSiteGroups } from "../lib/aiSiteGroups.js";
import { buildBlockRulesForDomains, domainsForBlockedSites } from "../lib/blockRules.js";
import { getBlockedSites, onBlockedSitesChanged } from "../lib/siteSettingsStorage.js";

// Must be set on every service worker startup, not just install - it isn't guaranteed to persist
// across a worker restart (MV3 service workers are routinely killed and restarted when idle).
function grantContentScriptSessionStorageAccess(): void {
  void chrome.storage.session.setAccessLevel({
    accessLevel: "TRUSTED_AND_UNTRUSTED_CONTEXTS",
  });
}

const ALL_GROUPS = getAiSiteGroups();
const ALL_DOMAINS = ALL_GROUPS.flatMap((group) => group.domains);
// Every rule ID this extension could ever add, so a resync can remove exactly its own previous
// rules (including ones for sites that just got un-blocked) without needing to track state across
// calls - ruleIdForDomain (see blockRules.ts) is a pure function of the domain string.
const ALL_POSSIBLE_RULE_IDS = buildBlockRulesForDomains(ALL_DOMAINS).map((rule) => rule.id);

async function syncBlockRules(): Promise<void> {
  const blockedSites = await getBlockedSites();
  const blockedDomains = domainsForBlockedSites(blockedSites, ALL_GROUPS);
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: ALL_POSSIBLE_RULE_IDS,
    addRules: buildBlockRulesForDomains(blockedDomains),
  });
}

chrome.runtime.onInstalled.addListener(() => {
  console.log("[Guardian] installed");
  void chrome.action.setTitle({ title: "Guardian — protection active" });
  void syncBlockRules();
  grantContentScriptSessionStorageAccess();
});

chrome.runtime.onStartup.addListener(() => {
  grantContentScriptSessionStorageAccess();
});

// Also set immediately on every service worker load (covers a mid-session worker restart, which
// fires neither onInstalled nor onStartup).
grantContentScriptSessionStorageAccess();

onBlockedSitesChanged(() => {
  void syncBlockRules();
});
