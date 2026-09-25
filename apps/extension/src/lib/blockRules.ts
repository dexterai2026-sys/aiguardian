import type { AiSiteGroup } from "./aiSiteGroups.js";

/**
 * Turns the person's own site allow/block choices (PR 12: a self-directed, personal-mode control
 * - CLAUDE.md scopes parent-set blocking policy to Phase 3, once policies can sync from a backend)
 * into declarativeNetRequest rules blocking top-level navigation to a blocked site's domains.
 * Pure and side-effect-free: the caller (background/index.ts) is the only place that actually
 * talks to chrome.declarativeNetRequest, so this can be unit-tested without a browser.
 *
 * Rule IDs are stable per domain (not reassigned each time the block list changes) so that
 * `chrome.declarativeNetRequest.updateDynamicRules` can remove exactly the rules for domains no
 * longer blocked without needing to track the previous call's IDs separately - the id is a pure
 * function of the domain string.
 */

// declarativeNetRequest rule IDs must be positive integers - derived deterministically from the
// domain string (not its index in some list, which could shift) via a small string hash.
function ruleIdForDomain(domain: string): number {
  let hash = 0;
  for (let i = 0; i < domain.length; i++) {
    hash = (hash * 31 + domain.charCodeAt(i)) | 0;
  }
  // Rule IDs must be positive; Math.abs(-2147483648) overflows back to itself (the one int32 value
  // without a positive counterpart), so that specific edge case falls back to 1 instead.
  const positive = Math.abs(hash);
  return positive === 0x80000000 ? 1 : positive || 1;
}

export function buildBlockRulesForDomains(domains: string[]): chrome.declarativeNetRequest.Rule[] {
  return domains.map((domain) => ({
    id: ruleIdForDomain(domain),
    priority: 1,
    action: { type: "block" as chrome.declarativeNetRequest.RuleActionType },
    condition: {
      urlFilter: `||${domain}^`,
      resourceTypes: ["main_frame" as chrome.declarativeNetRequest.ResourceType],
    },
  }));
}

/** All domains a set of blocked site names actually covers, per `groups` (see aiSiteGroups.ts) -
 * blocking a site blocks every domain it's known by, not just the one the person happened to
 * click on. */
export function domainsForBlockedSites(
  blockedSiteNames: readonly string[],
  groups: readonly AiSiteGroup[],
): string[] {
  const blocked = new Set(blockedSiteNames);
  return groups.filter((group) => blocked.has(group.name)).flatMap((group) => group.domains);
}
