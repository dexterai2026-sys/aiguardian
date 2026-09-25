import type { Finding } from "@guardian/engine-ts";

/** Pure tallying logic for lib/usageStats.ts, split out so it's unit-testable without touching
 * chrome.storage: counts how many findings of each category are in one detection/mask event. */
export function tallyCategories(findings: Finding[]): Record<string, number> {
  const tally: Record<string, number> = {};
  for (const finding of findings) {
    tally[finding.category] = (tally[finding.category] ?? 0) + 1;
  }
  return tally;
}
