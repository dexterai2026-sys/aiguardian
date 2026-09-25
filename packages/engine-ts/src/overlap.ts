import type { Finding } from "./types.js";

function spansOverlap(a: Finding, b: Finding): boolean {
  return a.start < b.end && b.start < a.end;
}

/**
 * Deterministic precedence for two overlapping findings (including full containment, e.g. a
 * vault name match inside a longer address match): higher tier wins first (Tier 2 vault matches
 * are more trusted than a Tier 1 pattern guess), then higher confidence, then whichever was
 * produced first (stable tiebreak) - an arbitrary but deterministic final rule, documented here
 * rather than left to array/sort-implementation accident.
 */
function comparePrecedence(a: Finding, b: Finding): number {
  if (a.tier !== b.tier) {
    return b.tier - a.tier;
  }
  return b.confidence - a.confidence;
}

/**
 * Drops lower-precedence findings that overlap a higher-precedence one, keeping the rest.
 * Greedy: findings are considered in precedence order, and a finding is kept only if it doesn't
 * overlap anything already kept. This is the "overlap resolution rule" referenced in
 * docs/phase-1-plan.md PRs 10 and 11 - mask() uses it directly, and detect() (PR 11) applies it
 * to its own combined Tier 1 + Tier 2 output before returning, so callers never see raw overlaps
 * from either entry point.
 */
export function resolveOverlaps(findings: Finding[]): Finding[] {
  const byPrecedence = findings
    .map((finding, index) => ({ finding, index }))
    .sort((a, b) => comparePrecedence(a.finding, b.finding) || a.index - b.index);

  const kept: Finding[] = [];
  for (const { finding } of byPrecedence) {
    if (!kept.some((existing) => spansOverlap(existing, finding))) {
      kept.push(finding);
    }
  }

  return kept.sort((a, b) => a.start - b.start || a.end - b.end);
}
