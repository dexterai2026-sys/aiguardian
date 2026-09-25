import { describe, expect, it } from "vitest";
import type { Context } from "../types.js";
import { detectContentFlags } from "./contentFlags.js";

const familyContext: Context = {
  appId: "test-app",
  siteId: "test-site",
  mode: "family",
  ageProfile: "teen",
};

const personalContext: Context = {
  ...familyContext,
  mode: "personal",
};

describe("detectContentFlags", () => {
  it("finds a self-harm phrase in family mode", () => {
    const findings = detectContentFlags(
      "Sometimes I think about suicide and it scares me.",
      familyContext,
    );
    expect(findings).toEqual([
      {
        category: "content.self_harm",
        start: 12,
        end: 31,
        confidence: 0.7,
        tier: 1,
        suggestedPlaceholder: "SELFHARM",
      },
    ]);
  });

  it("finds a secrecy-from-parents phrase in family mode", () => {
    expect(
      detectContentFlags("Don't tell your parents about this, okay?", familyContext),
    ).toHaveLength(1);
  });

  it("returns nothing outside family mode, even for otherwise-matching text", () => {
    expect(
      detectContentFlags("Sometimes I think about suicide and it scares me.", personalContext),
    ).toEqual([]);
    expect(
      detectContentFlags("Don't tell your parents about this, okay?", personalContext),
    ).toEqual([]);
  });

  it("returns nothing for benign text in family mode", () => {
    expect(
      detectContentFlags("We had a normal conversation about homework and chores.", familyContext),
    ).toEqual([]);
  });
});
