import type { PatternRule } from "../rules/schema.js";
import type { Finding, Tier } from "../types.js";
import { VALIDATORS } from "./validators.js";

export interface CompiledPatternRule extends PatternRule {
  regex: RegExp;
}

export function compilePatternRule(rule: PatternRule): CompiledPatternRule {
  return { ...rule, regex: new RegExp(rule.pattern, `gu${rule.flags ?? ""}`) };
}

/**
 * Runs each compiled rule against `text` and returns every match that passes its optional
 * `validation` step, as a `Finding` at the given `tier`. Does not resolve overlaps between
 * rules or across tiers — that's the job of `detect()` (see docs/phase-1-plan.md, PR 11), which
 * combines this with other tiers' output.
 */
export function runPatternRules(text: string, rules: CompiledPatternRule[], tier: Tier): Finding[] {
  const findings: Finding[] = [];

  for (const rule of rules) {
    const validate = rule.validation ? VALIDATORS[rule.validation] : undefined;
    rule.regex.lastIndex = 0;

    let match: RegExpExecArray | null;
    while ((match = rule.regex.exec(text)) !== null) {
      const raw = match[0];
      if (!validate || validate(raw)) {
        findings.push({
          category: rule.category,
          start: match.index,
          end: match.index + raw.length,
          confidence: rule.confidence,
          tier,
          suggestedPlaceholder: rule.placeholderPrefix,
        });
      }
      // Guard against an infinite loop if a rule's pattern can match an empty string.
      if (raw.length === 0) {
        rule.regex.lastIndex += 1;
      }
    }
  }

  return findings;
}
