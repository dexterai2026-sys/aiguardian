import type { Finding, MaskResult } from "./types.js";

/**
 * Replaces each finding's span in `text` with a numbered placeholder (e.g. "[NAME_1]") and
 * returns the masked text plus an in-memory map to restore the original values. Not
 * implemented yet — see docs/phase-1-plan.md, PR 10.
 */
export function mask(_text: string, _findings: Finding[]): MaskResult {
  throw new Error("mask() is not implemented yet (see docs/phase-1-plan.md, PR 10)");
}
