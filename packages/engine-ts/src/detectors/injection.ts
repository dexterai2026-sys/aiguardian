// See structuredPii.ts for why this is a bundled data import rather than a filesystem read.
import rulesData from "../../../../rules/patterns/injection.json";
import { validatePatternRule, type PatternRule } from "../rules/schema.js";
import type { Finding } from "../types.js";
import {
  compilePatternRule,
  runPatternRules,
  type CompiledPatternRule,
} from "./patternDetector.js";

function loadRules(): CompiledPatternRule[] {
  const raw = rulesData as unknown[];
  raw.forEach((entry, index) => validatePatternRule(entry, `injection.json[${index}]`));
  return (raw as PatternRule[]).map(compilePatternRule);
}

const INJECTION_RULES = loadRules();

/**
 * Tier 1 detector for prompt injection: hidden/invisible characters (injection.hidden_text)
 * and known jailbreak/instruction-override phrasings (injection.instruction_pattern). Operates
 * on plain text only - a page-DOM scanner for CSS-hidden content is an extension concern
 * (Phase 2), not this engine. Not held to the structured-PII quality target; precision/recall
 * are reported by injection.eval.test.ts.
 */
export function detectInjection(text: string): Finding[] {
  return runPatternRules(text, INJECTION_RULES, 1);
}
