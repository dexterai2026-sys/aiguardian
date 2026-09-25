import { describe, expect, it } from "vitest";
import type { VaultEntry } from "../types.js";
import { detectVaultMatches } from "./vault.js";

const vault: VaultEntry[] = [
  { id: "child-name", category: "pii.name", value: "Jonathan" },
  { id: "sibling-name", category: "pii.name", value: "Ava" },
  { id: "school", category: "pii.school", value: "Lincoln Elementary School" },
  { id: "street", category: "pii.home_address", value: "Maple Street" },
];

describe("detectVaultMatches", () => {
  it("returns nothing when there is no vault", () => {
    expect(detectVaultMatches("Jonathan is here.", undefined)).toEqual([]);
    expect(detectVaultMatches("Jonathan is here.", [])).toEqual([]);
  });

  it("finds an exact match with category vault.match and a type-specific placeholder", () => {
    const findings = detectVaultMatches("Jonathan has soccer practice today.", vault);
    expect(findings).toEqual([
      {
        category: "vault.match",
        start: 0,
        end: 8,
        confidence: 0.95,
        tier: 2,
        suggestedPlaceholder: "NAME",
      },
    ]);
  });

  it("finds a fuzzy match for a one-letter misspelling", () => {
    const findings = detectVaultMatches("Jonathon has soccer practice today.", vault);
    expect(findings).toEqual([
      {
        category: "vault.match",
        start: 0,
        end: 8,
        confidence: 0.7,
        tier: 2,
        suggestedPlaceholder: "NAME",
      },
    ]);
  });

  it("does not fuzzy-match a nickname (too far in edit distance)", () => {
    expect(detectVaultMatches("Jonny has soccer practice today.", vault)).toEqual([]);
  });

  it("does not fuzzy-match a short (<=3 char) value", () => {
    expect(detectVaultMatches("Eva loves painting.", vault)).toEqual([]);
    expect(detectVaultMatches("Ava loves painting.", vault)).toHaveLength(1);
  });

  it("matches a multi-word value only as an exact substring, with the address placeholder", () => {
    const findings = detectVaultMatches("We live on Maple Street near the park.", vault);
    expect(findings).toEqual([
      {
        category: "vault.match",
        start: 11,
        end: 23,
        confidence: 0.95,
        tier: 2,
        suggestedPlaceholder: "ADDRESS",
      },
    ]);
    expect(detectVaultMatches("We live on Elm Street near the park.", vault)).toEqual([]);
  });

  it("finds multiple distinct vault entries in one message", () => {
    const findings = detectVaultMatches("Jonathan and Ava live on Maple Street.", vault);
    expect(findings.map((f) => f.suggestedPlaceholder).sort()).toEqual(["ADDRESS", "NAME", "NAME"]);
  });
});
