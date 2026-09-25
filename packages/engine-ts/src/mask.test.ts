import { describe, expect, it } from "vitest";
import { mask } from "./mask.js";
import type { Finding } from "./types.js";

function finding(overrides: Partial<Finding> & Pick<Finding, "start" | "end">): Finding {
  return {
    category: "pii.email",
    confidence: 0.9,
    tier: 1,
    suggestedPlaceholder: "EMAIL",
    ...overrides,
  };
}

describe("mask", () => {
  it("returns the text unchanged when there are no findings", () => {
    const result = mask("hello there", []);
    expect(result.maskedText).toBe("hello there");
    expect(result.restoreMap.size).toBe(0);
  });

  it("replaces a single finding with a numbered placeholder and records the original text", () => {
    const text = "contact jane@example.com please";
    const result = mask(text, [finding({ start: 8, end: 24 })]);

    expect(result.maskedText).toBe("contact [EMAIL_1] please");
    expect(result.restoreMap.get("[EMAIL_1]")).toBe("jane@example.com");
  });

  it("numbers repeated findings with the same placeholder label sequentially", () => {
    const text = "a@example.com and b@example.com";
    const result = mask(text, [finding({ start: 0, end: 13 }), finding({ start: 18, end: 32 })]);

    expect(result.maskedText).toBe("[EMAIL_1] and [EMAIL_2]");
    expect(result.restoreMap.get("[EMAIL_1]")).toBe("a@example.com");
    expect(result.restoreMap.get("[EMAIL_2]")).toBe("b@example.com");
  });

  it("numbers different placeholder labels independently, even under the same category", () => {
    const text = "Jonathan lives on Maple Street.";
    const result = mask(text, [
      finding({
        category: "vault.match",
        start: 0,
        end: 8,
        tier: 2,
        suggestedPlaceholder: "NAME",
      }),
      finding({
        category: "vault.match",
        start: 18,
        end: 30,
        tier: 2,
        suggestedPlaceholder: "ADDRESS",
      }),
    ]);

    expect(result.maskedText).toBe("[NAME_1] lives on [ADDRESS_1].");
  });

  it("drops a lower-precedence finding that overlaps a higher-tier one", () => {
    const text = "Jonathan Smith called.";
    const result = mask(text, [
      // Tier 1 guess spanning the whole name.
      finding({
        category: "pii.name",
        start: 0,
        end: 14,
        tier: 1,
        confidence: 0.5,
        suggestedPlaceholder: "NAME",
      }),
      // Tier 2 vault match for just "Jonathan", nested inside the Tier 1 span.
      finding({
        category: "vault.match",
        start: 0,
        end: 8,
        tier: 2,
        confidence: 0.95,
        suggestedPlaceholder: "NAME",
      }),
    ]);

    expect(result.maskedText).toBe("[NAME_1] Smith called.");
    expect(result.restoreMap.get("[NAME_1]")).toBe("Jonathan");
  });
});
