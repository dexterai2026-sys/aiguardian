// See structuredPii.ts for why this is a bundled data import rather than a filesystem read.
import rulesData from "../../../../rules/patterns/secrets.json";
import { validatePatternRule, type PatternRule } from "../rules/schema.js";
import type { Finding } from "../types.js";
import {
  compilePatternRule,
  runPatternRules,
  type CompiledPatternRule,
} from "./patternDetector.js";

function loadRules(): CompiledPatternRule[] {
  const raw = rulesData as unknown[];
  raw.forEach((entry, index) => validatePatternRule(entry, `secrets.json[${index}]`));
  return (raw as PatternRule[]).map(compilePatternRule);
}

const SECRETS_RULES = loadRules();

/**
 * Tier 1 detector for API keys (known vendor prefixes) and password mentions in chat text.
 * secret.password has a known false-positive risk (see rules/patterns/secrets.json) that is
 * measured and reported by secrets.eval.test.ts, not hidden by a lenient corpus.
 */
export function detectSecrets(text: string): Finding[] {
  return runPatternRules(text, SECRETS_RULES, 1);
}
