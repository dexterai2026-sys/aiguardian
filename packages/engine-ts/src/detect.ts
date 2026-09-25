import { detectContentFlags } from "./detectors/contentFlags.js";
import { detectInjection } from "./detectors/injection.js";
import { detectPiiMisc } from "./detectors/piiMisc.js";
import { detectSecrets } from "./detectors/secrets.js";
import { detectStructuredPii } from "./detectors/structuredPii.js";
import { detectVaultMatches } from "./detectors/vault.js";
import { resolveOverlaps } from "./overlap.js";
import type { Context, Finding } from "./types.js";

/**
 * Runs every Tier 1 (pattern) and Tier 2 (vault) detector from PRs 5-9 against `text` and
 * returns their combined findings, overlap-resolved (see overlap.ts) so callers never see two
 * detectors' conflicting guesses about the same span.
 *
 * Family-only categories (content.*) are not gated here - detectContentFlags() already returns
 * nothing outside `context.mode === "family"` (see PR 8), so this function stays a flat,
 * unconditional fan-out rather than branching on mode itself.
 */
export function detect(text: string, context: Context): Finding[] {
  const findings: Finding[] = [
    ...detectStructuredPii(text),
    ...detectPiiMisc(text),
    ...detectSecrets(text),
    ...detectInjection(text),
    ...detectContentFlags(text, context),
    ...detectVaultMatches(text, context.vault),
  ];

  return resolveOverlaps(findings);
}
