import { describe, expect, it } from "vitest";
import type { PatternRule } from "../rules/schema.js";
import { compilePatternRule, runPatternRules } from "./patternDetector.js";

const emailRule: PatternRule = {
  category: "pii.email",
  pattern: "\\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}\\b",
  confidence: 0.95,
  placeholderPrefix: "EMAIL",
};

const cardRule: PatternRule = {
  category: "pii.payment_card",
  pattern: "\\b(?:\\d[ -]?){13,19}\\b",
  validation: "luhn",
  confidence: 0.9,
  placeholderPrefix: "CARD",
};

describe("runPatternRules", () => {
  it("finds a single match with the correct offsets", () => {
    const findings = runPatternRules(
      "email jane@example.com now",
      [compilePatternRule(emailRule)],
      1,
    );
    expect(findings).toEqual([
      {
        category: "pii.email",
        start: 6,
        end: 22,
        confidence: 0.95,
        tier: 1,
        suggestedPlaceholder: "EMAIL",
      },
    ]);
  });

  it("finds multiple non-overlapping matches from the same rule", () => {
    const findings = runPatternRules(
      "a@example.com and b@example.com",
      [compilePatternRule(emailRule)],
      1,
    );
    expect(findings).toHaveLength(2);
  });

  it("drops a match that fails its validation step", () => {
    const findings = runPatternRules("4111111111111112", [compilePatternRule(cardRule)], 1);
    expect(findings).toEqual([]);
  });

  it("keeps a match that passes its validation step", () => {
    const findings = runPatternRules("4111111111111111", [compilePatternRule(cardRule)], 1);
    expect(findings).toHaveLength(1);
  });

  it("returns no findings when nothing matches", () => {
    expect(runPatternRules("nothing to see here", [compilePatternRule(emailRule)], 1)).toEqual([]);
  });
});
