import type { Finding } from "@guardian/engine-ts";
import { tallyCategories } from "./usageStatsTally.js";

/**
 * Local-only counters of findings surfaced and masks applied, per site and category (PR 13).
 * Never transmitted anywhere - CLAUDE.md's data-minimization principle - stored only in
 * chrome.storage.local, with clearUsageStats() as the manual reset the plan calls for. Like
 * lib/siteSettingsStorage.ts, this is thin real-API wiring around chrome.storage and deliberately
 * not unit-tested directly; the actual counting logic it calls (tallyCategories) is pure and
 * tested in usageStatsTally.test.ts, and the wiring itself is exercised by e2e/popup.spec.ts in a
 * real browser.
 */
export interface SiteCategoryStats {
  findings: number;
  masked: number;
}
export type UsageStatsTable = Record<string, Record<string, SiteCategoryStats>>;

const USAGE_STATS_KEY = "guardianUsageStats";

export async function getUsageStats(): Promise<UsageStatsTable> {
  const result = await chrome.storage.local.get(USAGE_STATS_KEY);
  const value: unknown = result[USAGE_STATS_KEY];
  return typeof value === "object" && value !== null ? (value as UsageStatsTable) : {};
}

async function incrementStats(
  site: string,
  findings: Finding[],
  kind: keyof SiteCategoryStats,
): Promise<void> {
  const increments = tallyCategories(findings);
  if (Object.keys(increments).length === 0) {
    return;
  }

  const stats = await getUsageStats();
  const siteStats = { ...stats[site] };
  for (const [category, count] of Object.entries(increments)) {
    const current = siteStats[category] ?? { findings: 0, masked: 0 };
    siteStats[category] = { ...current, [kind]: current[kind] + count };
  }
  await chrome.storage.local.set({ [USAGE_STATS_KEY]: { ...stats, [site]: siteStats } });
}

/** Call when findings are actually surfaced to the person (a review panel shown) - not on every
 * debounced keystroke re-scan, which would inflate counts without reflecting anything the person
 * actually saw. */
export function recordFindingsShown(site: string, findings: Finding[]): Promise<void> {
  return incrementStats(site, findings, "findings");
}

/** Call when the person chooses "Send masked" - counts which categories were actually masked, not
 * just detected. */
export function recordMasked(site: string, findings: Finding[]): Promise<void> {
  return incrementStats(site, findings, "masked");
}

export async function clearUsageStats(): Promise<void> {
  await chrome.storage.local.remove(USAGE_STATS_KEY);
}
