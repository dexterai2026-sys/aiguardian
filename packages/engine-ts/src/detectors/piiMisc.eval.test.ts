import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { loadCorpusFile } from "../corpus/loader.js";
import { evaluateDetector, precision, recall } from "../eval/evaluate.js";
import { detectPiiMisc } from "./piiMisc.js";

const corpusPath = fileURLToPath(
  new URL("../../../../test-corpus/pii-misc.jsonl", import.meta.url),
);

describe("detectPiiMisc corpus evaluation", () => {
  const cases = loadCorpusFile(corpusPath);
  const report = evaluateDetector(detectPiiMisc, cases);

  it("reports per-category precision/recall (not gated - see docs/phase-1-plan.md, PR 6)", () => {
    const categories = [...report.byCategory.keys()].sort();
    expect(categories).toEqual([
      "pii.bank_account",
      "pii.dob",
      "pii.government_id",
      "pii.home_address",
      "pii.medical",
    ]);

    for (const category of categories) {
      const stats = report.byCategory.get(category)!;
      // Intentional: surfaces the measured numbers in test output, per docs/phase-1-plan.md
      // PR 6 ("document actual measured numbers" rather than gating on them here).
      console.log(
        `${category}: precision=${precision(stats)} recall=${recall(stats)}`,
        `(tp=${stats.truePositives} fp=${stats.falsePositives} fn=${stats.falseNegatives})`,
      );
    }
  });
});
