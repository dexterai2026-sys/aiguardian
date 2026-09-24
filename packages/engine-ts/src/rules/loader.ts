import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  RuleValidationError,
  validateAiDomainEntry,
  validatePatternRule,
  type AiDomainEntry,
  type PatternRule,
} from "./schema.js";

export { RuleValidationError };

function parseJsonArray(content: string, sourceName: string): unknown[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch (cause) {
    throw new RuleValidationError(
      `${sourceName}: invalid JSON (${cause instanceof Error ? cause.message : String(cause)})`,
    );
  }
  if (!Array.isArray(parsed)) {
    throw new RuleValidationError(`${sourceName}: expected a JSON array`);
  }
  return parsed;
}

/** Parses and validates one pattern-rule file's contents (a JSON array of `PatternRule`). */
export function parsePatternRules(content: string, sourceName: string): PatternRule[] {
  const entries = parseJsonArray(content, sourceName);
  entries.forEach((entry, index) => validatePatternRule(entry, `${sourceName}[${index}]`));
  return entries as PatternRule[];
}

export function loadPatternRuleFile(path: string): PatternRule[] {
  return parsePatternRules(readFileSync(path, "utf-8"), path);
}

/**
 * Loads every `*.json` file in `dir` (non-recursive) as pattern rules and concatenates them,
 * throwing if the same category appears more than once across the whole directory — each
 * category must have exactly one Tier-1 rule.
 */
export function loadPatternRuleDir(dir: string): PatternRule[] {
  const files = readdirSync(dir)
    .filter((name) => name.endsWith(".json"))
    .sort();

  const rules: PatternRule[] = [];
  const seenBy = new Map<string, string>();

  for (const file of files) {
    const path = join(dir, file);
    for (const rule of loadPatternRuleFile(path)) {
      const previousFile = seenBy.get(rule.category);
      if (previousFile !== undefined) {
        throw new RuleValidationError(
          `${path}: category "${rule.category}" is already defined in ${previousFile}`,
        );
      }
      seenBy.set(rule.category, path);
      rules.push(rule);
    }
  }

  return rules;
}

/** Parses and validates the AI domain list (a JSON array of `AiDomainEntry`). */
export function parseAiDomains(content: string, sourceName: string): AiDomainEntry[] {
  const entries = parseJsonArray(content, sourceName);
  entries.forEach((entry, index) => validateAiDomainEntry(entry, `${sourceName}[${index}]`));
  return entries as AiDomainEntry[];
}

export function loadAiDomainsFile(path: string): AiDomainEntry[] {
  return parseAiDomains(readFileSync(path, "utf-8"), path);
}
