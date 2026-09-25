// See structuredPii.ts for why this is a bundled data import rather than a filesystem read.
import rulesData from "../../../../rules/patterns/pii-misc.json";
import { validatePatternRule, type PatternRule } from "../rules/schema.js";
import type { Finding } from "../types.js";
import {
  compilePatternRule,
  runPatternRules,
  type CompiledPatternRule,
} from "./patternDetector.js";

function loadRules(): CompiledPatternRule[] {
  const raw = rulesData as unknown[];
  raw.forEach((entry, index) => validatePatternRule(entry, `pii-misc.json[${index}]`));
  return (raw as PatternRule[]).map(compilePatternRule);
}

const PII_MISC_RULES = loadRules();

/**
 * Tier 1 detector for home address, date of birth, government ID, bank account, and medical
 * mentions. Lower confidence than structuredPii's categories - these rely on keyword/shape
 * heuristics (a birth-context keyword before a date, an explicit "account number" label, a
 * street suffix) rather than a validatable format, so precision and recall are not held to the
 * same CLAUDE.md target and are reported, not gated (see docs/phase-1-plan.md, PR 6).
 */
export function detectPiiMisc(text: string): Finding[] {
  return runPatternRules(text, PII_MISC_RULES, 1);
}
