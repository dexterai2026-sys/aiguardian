import { isCategory, type Category } from "../types.js";

/** Named secondary validators a detector may apply after a pattern match. */
export const VALIDATORS = ["luhn"] as const;
export type ValidatorName = (typeof VALIDATORS)[number];

function isValidatorName(value: unknown): value is ValidatorName {
  return typeof value === "string" && (VALIDATORS as readonly string[]).includes(value);
}

/** One Tier-1 pattern rule, per `/rules/patterns/*.json` and `/rules/README.md`. */
export interface PatternRule {
  category: Category;
  /** Regex source, no delimiters or embedded flags; the loader applies "gu" plus `flags`. */
  pattern: string;
  flags?: string;
  validation?: ValidatorName;
  confidence: number;
  placeholderPrefix: string;
  description?: string;
}

/** One entry in `/rules/ai-domains.json`. */
export interface AiDomainEntry {
  domain: string;
  name: string;
}

export class RuleValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RuleValidationError";
  }
}

function fail(where: string, message: string): never {
  throw new RuleValidationError(`${where}: ${message}`);
}

function asRecord(value: unknown, where: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    fail(where, "expected a JSON object");
  }
  return value as Record<string, unknown>;
}

export function validatePatternRule(value: unknown, where: string): asserts value is PatternRule {
  const rule = asRecord(value, where);

  if (!isCategory(rule.category)) {
    fail(where, `"category" ${JSON.stringify(rule.category)} is not a known category`);
  }
  if (typeof rule.pattern !== "string" || rule.pattern.length === 0) {
    fail(where, '"pattern" must be a non-empty string');
  }
  try {
    new RegExp(rule.pattern, `gu${typeof rule.flags === "string" ? rule.flags : ""}`);
  } catch (cause) {
    fail(
      where,
      `"pattern" is not a valid regular expression (${cause instanceof Error ? cause.message : String(cause)})`,
    );
  }
  if (rule.flags !== undefined && typeof rule.flags !== "string") {
    fail(where, '"flags" must be a string if present');
  }
  if (rule.validation !== undefined && !isValidatorName(rule.validation)) {
    fail(where, `"validation" ${JSON.stringify(rule.validation)} is not a known validator`);
  }
  if (
    typeof rule.confidence !== "number" ||
    Number.isNaN(rule.confidence) ||
    rule.confidence < 0 ||
    rule.confidence > 1
  ) {
    fail(where, '"confidence" must be a number in [0, 1]');
  }
  if (typeof rule.placeholderPrefix !== "string" || rule.placeholderPrefix.length === 0) {
    fail(where, '"placeholderPrefix" must be a non-empty string');
  }
  if (rule.description !== undefined && typeof rule.description !== "string") {
    fail(where, '"description" must be a string if present');
  }
}

export function validateAiDomainEntry(
  value: unknown,
  where: string,
): asserts value is AiDomainEntry {
  const entry = asRecord(value, where);

  if (typeof entry.domain !== "string" || entry.domain.length === 0) {
    fail(where, '"domain" must be a non-empty string');
  }
  if (/^[a-z0-9]+:\/\//i.test(entry.domain) || entry.domain.includes("/")) {
    fail(where, '"domain" must be a bare hostname, not a URL');
  }
  if (typeof entry.name !== "string" || entry.name.length === 0) {
    fail(where, '"name" must be a non-empty string');
  }
}
