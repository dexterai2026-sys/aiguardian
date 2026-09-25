import { resolveOverlaps } from "./overlap.js";
import type { Finding, MaskResult, RestoreMap } from "./types.js";

/**
 * Replaces each finding's span in `text` with a numbered placeholder (e.g. "[NAME_1]",
 * "[NAME_2]", "[ADDRESS_1]") and returns the masked text plus an in-memory map to restore the
 * original values. Numbering is per placeholder label (`finding.suggestedPlaceholder`), not per
 * `category` - vault matches all share `category: "vault.match"` but get distinct labels like
 * "NAME"/"ADDRESS" (see vault.ts), and those must count independently.
 *
 * Findings are resolved for overlaps first (see overlap.ts): a lower-precedence finding fully
 * or partially overlapping a higher-precedence one is dropped rather than masked twice or
 * producing a garbled overlapping replacement.
 *
 * Known limitation, not solved here: if `text` already contains a literal substring that looks
 * like a placeholder (e.g. someone typed "[NAME_1]" themselves), `restore()` can't distinguish
 * it from a placeholder this function inserted. Rare in practice; documented rather than solved
 * with an escaping scheme, per Phase 1's scope.
 */
export function mask(text: string, findings: Finding[]): MaskResult {
  const resolved = resolveOverlaps(findings);
  const counters = new Map<string, number>();
  const restoreMap: RestoreMap = new Map();

  let maskedText = "";
  let cursor = 0;

  for (const finding of resolved) {
    maskedText += text.slice(cursor, finding.start);

    const label = finding.suggestedPlaceholder;
    const count = (counters.get(label) ?? 0) + 1;
    counters.set(label, count);

    const placeholder = `[${label}_${count}]`;
    restoreMap.set(placeholder, text.slice(finding.start, finding.end));
    maskedText += placeholder;

    cursor = finding.end;
  }
  maskedText += text.slice(cursor);

  return { maskedText, restoreMap };
}
