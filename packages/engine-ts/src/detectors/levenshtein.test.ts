import { describe, expect, it } from "vitest";
import { fuzzyThresholdFor, levenshteinDistance } from "./levenshtein.js";

describe("levenshteinDistance", () => {
  it("is 0 for identical strings, case-insensitively", () => {
    expect(levenshteinDistance("Jonathan", "jonathan")).toBe(0);
  });

  it("counts a single substitution as distance 1", () => {
    expect(levenshteinDistance("Jonathan", "Jonathon")).toBe(1);
  });

  it("counts a longer edit correctly", () => {
    expect(levenshteinDistance("Jonathan", "Jonny")).toBe(5);
  });

  it("handles an empty string as the length of the other", () => {
    expect(levenshteinDistance("", "abc")).toBe(3);
    expect(levenshteinDistance("abc", "")).toBe(3);
  });
});

describe("fuzzyThresholdFor", () => {
  it("is 0 (exact only) for short values", () => {
    expect(fuzzyThresholdFor("Ava")).toBe(0);
  });

  it("is 1 for medium-length values", () => {
    expect(fuzzyThresholdFor("Jonny")).toBe(1);
  });

  it("is 2 for longer values", () => {
    expect(fuzzyThresholdFor("Jonathan")).toBe(2);
  });
});
