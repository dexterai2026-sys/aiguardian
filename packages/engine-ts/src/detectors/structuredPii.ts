// Loaded as a bundled data import (not read from disk at runtime), so this detector stays
// browser-safe for the extension/dashboard bundle in later phases. /rules is the shared,
// engine-agnostic source of truth (see /rules/README.md); Kotlin and Rust implementations load
// the same file their own way.
import rulesData from "../../../../rules/patterns/pii-structured.json";
import { validatePatternRule, type PatternRule } from "../rules/schema.js";
import type { Finding } from "../types.js";
import {
  compilePatternRule,
  runPatternRules,
  type CompiledPatternRule,
} from "./patternDetector.js";

function loadRules(): CompiledPatternRule[] {
  const raw = rulesData as unknown[];
  raw.forEach((entry, index) => validatePatternRule(entry, `pii-structured.json[${index}]`));
  return (raw as PatternRule[]).map(compilePatternRule);
}

const STRUCTURED_PII_RULES = loadRules();

/**
 * Tier 1 detector for structured PII: payment cards, SSNs, phone numbers, and emails. This is
 * the category group CLAUDE.md's quality target applies to (precision >= 0.95, recall >= 0.90
 * on the corpus) — see structuredPii.eval.test.ts.
 */
export function detectStructuredPii(text: string): Finding[] {
  return runPatternRules(text, STRUCTURED_PII_RULES, 1);
}
