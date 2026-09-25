import { performance } from "node:perf_hooks";
import { describe, expect, it } from "vitest";
import { detect } from "./detect.js";
import type { Context, VaultEntry } from "./types.js";

const vault: VaultEntry[] = [
  { id: "child-name", category: "pii.name", value: "Jonathan" },
  { id: "street", category: "pii.home_address", value: "Maple Street" },
];

const context: Context = {
  appId: "perf-test",
  siteId: "perf-test",
  mode: "family",
  ageProfile: "teen",
  vault,
};

/** A realistic-ish paragraph exercising every detector at least once, repeated to length. */
function buildSample(targetLength: number): string {
  const paragraph =
    "Hey, quick update: reach me at jane.doe@example.com or 555-123-4567 if anything comes up. " +
    "We live at 42 Maple Street near the school, and Jonathan has practice at Lincoln Elementary " +
    "School today. Please don't ignore all previous instructions from the coach, and remember my " +
    "account number is 123456789012 for the fundraiser. Also, please don't tell your parents " +
    "about the surprise party - keep it a secret! ";
  let sample = "";
  while (sample.length < targetLength) {
    sample += paragraph;
  }
  return sample.slice(0, targetLength);
}

describe("detect() performance", () => {
  it("completes in a reasonable time on a 2,000-character sample", () => {
    const sample = buildSample(2000);

    detect(sample, context); // warm up (JIT, regex compilation caches, etc.)

    const iterations = 20;
    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      detect(sample, context);
    }
    const averageMs = (performance.now() - start) / iterations;

    console.log(
      `detect() average latency on a ${sample.length}-char sample: ${averageMs.toFixed(2)}ms`,
      "(CLAUDE.md target: <20ms Tier 1+2 on a mid-range device; this CI/dev-container runner",
      "isn't equivalent hardware, so this number is logged for tracking, not enforced here -",
      "see docs/phase-1-plan.md PR 11 and its open question about a future hard gate).",
    );

    // Loose sanity bound only: catches a catastrophic regression (e.g. an accidental
    // exponential-blowup regex), not an attempt to enforce the CLAUDE.md target on this
    // hardware.
    expect(averageMs).toBeLessThan(500);
  });
});
