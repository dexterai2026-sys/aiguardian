// See structuredPii.ts for why this is a bundled data import rather than a filesystem read.
import rulesData from "../../../../rules/patterns/content-flags.json";
import { validatePatternRule, type PatternRule } from "../rules/schema.js";
import type { Context, Finding } from "../types.js";
import {
  compilePatternRule,
  runPatternRules,
  type CompiledPatternRule,
} from "./patternDetector.js";

function loadRules(): CompiledPatternRule[] {
  const raw = rulesData as unknown[];
  raw.forEach((entry, index) => validatePatternRule(entry, `content-flags.json[${index}]`));
  return (raw as PatternRule[]).map(compilePatternRule);
}

const CONTENT_FLAG_RULES = loadRules();

/**
 * Tier 1 detector for family-mode content flags: content.self_harm, content.sexual,
 * content.violence, content.secrecy_from_parents. Returns no findings outside family mode -
 * per CLAUDE.md, personal (adult) mode "reports to no one", so these categories must never
 * surface there even if the rule data would otherwise match.
 *
 * Keyword/phrase heuristics only, per docs/phase-1-plan.md PR 8: real recall and precision
 * limitations are documented per-rule in rules/patterns/content-flags.json and measured (not
 * gated) by contentFlags.eval.test.ts. A real classifier is Tier 3 (on-device ML), not Phase 1.
 */
export function detectContentFlags(text: string, context: Context): Finding[] {
  if (context.mode !== "family") {
    return [];
  }
  return runPatternRules(text, CONTENT_FLAG_RULES, 1);
}
