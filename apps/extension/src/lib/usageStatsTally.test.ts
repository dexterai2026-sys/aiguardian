import { describe, expect, it } from "vitest";
import type { Finding } from "@guardian/engine-ts";
import { tallyCategories } from "./usageStatsTally.js";

function finding(category: Finding["category"]): Finding {
  return { category, start: 0, end: 1, confidence: 1, tier: 1, suggestedPlaceholder: "X" };
}

describe("tallyCategories", () => {
  it("counts one finding per category", () => {
    expect(tallyCategories([finding("pii.email")])).toEqual({ "pii.email": 1 });
  });

  it("counts multiple findings of the same category", () => {
    expect(tallyCategories([finding("pii.email"), finding("pii.email")])).toEqual({
      "pii.email": 2,
    });
  });

  it("tallies distinct categories separately", () => {
    expect(tallyCategories([finding("pii.email"), finding("pii.ssn")])).toEqual({
      "pii.email": 1,
      "pii.ssn": 1,
    });
  });

  it("returns an empty tally for no findings", () => {
    expect(tallyCategories([])).toEqual({});
  });
});
