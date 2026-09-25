import { describe, expect, it } from "vitest";
import { mask } from "./mask.js";
import { restore } from "./restore.js";
import type { Finding, RestoreMap } from "./types.js";

describe("restore", () => {
  it("returns the text unchanged for an empty restore map", () => {
    expect(restore("hello there", new Map())).toBe("hello there");
  });

  it("replaces a single placeholder with its original value", () => {
    const restoreMap: RestoreMap = new Map([["[EMAIL_1]", "jane@example.com"]]);
    expect(restore("contact [EMAIL_1] please", restoreMap)).toBe("contact jane@example.com please");
  });

  it("replaces multiple distinct placeholders in one pass", () => {
    const restoreMap: RestoreMap = new Map([
      ["[EMAIL_1]", "a@example.com"],
      ["[EMAIL_2]", "b@example.com"],
    ]);
    expect(restore("[EMAIL_1] and [EMAIL_2]", restoreMap)).toBe("a@example.com and b@example.com");
  });

  it("does not cascade when one restored value contains another placeholder's literal text", () => {
    // If restore() replaced key-by-key, restoring [A] to "[B]" first and then processing [B]
    // would incorrectly turn it into "value-of-B". A single-pass replace must not do this.
    const restoreMap: RestoreMap = new Map([
      ["[A]", "[B]"],
      ["[B]", "value-of-B"],
    ]);
    expect(restore("start [A] end", restoreMap)).toBe("start [B] end");
  });

  it("round-trips with mask() for arbitrary findings", () => {
    const text = "Reach me at jane.doe@example.com or 555-123-4567, my card is 4242424242424242.";
    const findings: Finding[] = [
      {
        category: "pii.email",
        start: 12,
        end: 32,
        confidence: 0.95,
        tier: 1,
        suggestedPlaceholder: "EMAIL",
      },
      {
        category: "pii.phone",
        start: 36,
        end: 48,
        confidence: 0.75,
        tier: 1,
        suggestedPlaceholder: "PHONE",
      },
      {
        category: "pii.payment_card",
        start: 61,
        end: 77,
        confidence: 0.9,
        tier: 1,
        suggestedPlaceholder: "CARD",
      },
    ];

    const { maskedText, restoreMap } = mask(text, findings);
    expect(restore(maskedText, restoreMap)).toBe(text);
  });
});
