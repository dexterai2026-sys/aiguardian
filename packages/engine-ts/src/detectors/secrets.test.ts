import { describe, expect, it } from "vitest";
import { detectSecrets } from "./secrets.js";

describe("detectSecrets", () => {
  it("finds a known vendor API key prefix", () => {
    const findings = detectSecrets("Use sk-abcdefghijklmnopqrstuvwx for the API.");
    expect(findings).toEqual([
      {
        category: "secret.api_key",
        start: 4,
        end: 31,
        confidence: 0.9,
        tier: 1,
        suggestedPlaceholder: "APIKEY",
      },
    ]);
  });

  it("does not flag a string that merely resembles a key prefix", () => {
    expect(detectSecrets("My favorite quote starts with sk8-or-die energy.")).toEqual([]);
  });

  it("finds a password mention after a password keyword", () => {
    expect(detectSecrets("My password is hunter2 for that account.")).toHaveLength(1);
  });

  it("has a known false-positive on a non-password word after 'password is'", () => {
    // Documents the limitation described in rules/patterns/secrets.json rather than hiding it:
    // this assertion will need to change if the pattern is ever tightened.
    expect(detectSecrets("The password is important for security.")).toHaveLength(1);
  });
});
