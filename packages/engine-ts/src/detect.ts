import type { Context, Finding } from "./types.js";

/**
 * Runs all Tier 1 (pattern) and Tier 2 (vault) detectors against `text` and returns every
 * finding, already overlap-resolved. Not implemented yet — Phase 1 PRs 5-9 add the individual
 * detectors, and PR 11 wires them into this entry point.
 */
export function detect(_text: string, _context: Context): Finding[] {
  throw new Error("detect() is not implemented yet (see docs/phase-1-plan.md, PRs 5-11)");
}
