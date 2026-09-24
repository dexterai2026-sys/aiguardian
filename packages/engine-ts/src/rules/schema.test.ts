import { describe, expect, it } from "vitest";
import { RuleValidationError, validateAiDomainEntry, validatePatternRule } from "./schema.js";

const validRule = {
  category: "pii.email",
  pattern: "\\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}\\b",
  confidence: 0.95,
  placeholderPrefix: "EMAIL",
};

describe("validatePatternRule", () => {
  it("accepts a well-formed rule", () => {
    expect(() => validatePatternRule(validRule, "test")).not.toThrow();
  });

  it("accepts an optional validation, flags, and description", () => {
    const rule = {
      ...validRule,
      category: "pii.payment_card",
      validation: "luhn",
      flags: "i",
      description: "cards",
    };
    expect(() => validatePatternRule(rule, "test")).not.toThrow();
  });

  it("rejects an unknown category", () => {
    expect(() => validatePatternRule({ ...validRule, category: "pii.bogus" }, "test")).toThrow(
      /not a known category/,
    );
  });

  it("rejects an invalid regex pattern", () => {
    expect(() => validatePatternRule({ ...validRule, pattern: "(" }, "test")).toThrow(
      RuleValidationError,
    );
  });

  it("rejects an unknown validator name", () => {
    expect(() =>
      validatePatternRule({ ...validRule, validation: "not-a-real-validator" }, "test"),
    ).toThrow(/not a known validator/);
  });

  it("rejects confidence outside [0, 1]", () => {
    expect(() => validatePatternRule({ ...validRule, confidence: 1.5 }, "test")).toThrow(
      /"confidence"/,
    );
  });

  it("rejects an empty placeholderPrefix", () => {
    expect(() => validatePatternRule({ ...validRule, placeholderPrefix: "" }, "test")).toThrow(
      /"placeholderPrefix"/,
    );
  });
});

describe("validateAiDomainEntry", () => {
  it("accepts a well-formed entry", () => {
    expect(() =>
      validateAiDomainEntry({ domain: "claude.ai", name: "Claude" }, "test"),
    ).not.toThrow();
  });

  it("rejects a URL instead of a bare hostname", () => {
    expect(() =>
      validateAiDomainEntry({ domain: "https://claude.ai/", name: "Claude" }, "test"),
    ).toThrow(/bare hostname/);
  });

  it("rejects a missing name", () => {
    expect(() => validateAiDomainEntry({ domain: "claude.ai" }, "test")).toThrow(/"name"/);
  });
});
