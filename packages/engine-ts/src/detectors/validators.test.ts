import { describe, expect, it } from "vitest";
import { luhnCheck } from "./validators.js";

describe("luhnCheck", () => {
  it("accepts a known-valid test card number", () => {
    expect(luhnCheck("4111111111111111")).toBe(true);
  });

  it("accepts the same number with spaces or dashes", () => {
    expect(luhnCheck("4111 1111 1111 1111")).toBe(true);
    expect(luhnCheck("4111-1111-1111-1111")).toBe(true);
  });

  it("rejects a number with an altered check digit", () => {
    expect(luhnCheck("4111111111111112")).toBe(false);
  });

  it("rejects non-digit input", () => {
    expect(luhnCheck("not a number")).toBe(false);
  });

  it("rejects an empty string", () => {
    expect(luhnCheck("")).toBe(false);
  });
});
