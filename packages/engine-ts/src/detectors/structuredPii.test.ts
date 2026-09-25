import { describe, expect, it } from "vitest";
import { detectStructuredPii } from "./structuredPii.js";

describe("detectStructuredPii", () => {
  it("finds an email", () => {
    const findings = detectStructuredPii("contact jane@example.com please");
    expect(findings).toEqual([
      {
        category: "pii.email",
        start: 8,
        end: 24,
        confidence: 0.95,
        tier: 1,
        suggestedPlaceholder: "EMAIL",
      },
    ]);
  });

  it("finds a luhn-valid card and skips a luhn-invalid one", () => {
    expect(detectStructuredPii("4111111111111111")).toHaveLength(1);
    expect(detectStructuredPii("4111111111111112")).toHaveLength(0);
  });

  it("finds multiple categories in one message", () => {
    const findings = detectStructuredPii("email jane@example.com or call 555-123-4567");
    expect(findings.map((f) => f.category).sort()).toEqual(["pii.email", "pii.phone"]);
  });

  it("returns nothing for plain text", () => {
    expect(detectStructuredPii("just a normal sentence with no PII at all")).toEqual([]);
  });
});
