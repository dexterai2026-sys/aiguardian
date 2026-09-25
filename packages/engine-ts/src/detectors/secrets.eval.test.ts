import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { loadCorpusFile } from "../corpus/loader.js";
import { evaluateDetector, precision, recall } from "../eval/evaluate.js";
import { detectSecrets } from "./secrets.js";

const corpusPath = fileURLToPath(new URL("../../../../test-corpus/secrets.jsonl", import.meta.url));

describe("detectSecrets corpus evaluation", () => {
  const cases = loadCorpusFile(corpusPath);
  const report = evaluateDetector(detectSecrets, cases);

  it("meets the quality target for secret.api_key (known vendor prefixes are unambiguous)", () => {
    const stats = report.byCategory.get("secret.api_key")!;
    expect(precision(stats)).toBe(1);
    expect(recall(stats)).toBe(1);
  });

  it("reports secret.password's precision/recall, including its known false positive (not gated)", () => {
    const stats = report.byCategory.get("secret.password")!;
    // Intentional: surfaces the measured numbers in test output, per docs/phase-1-plan.md
    // PR 6. secret.password is not held to the structured-PII quality target.
    console.log(
      `secret.password: precision=${precision(stats)} recall=${recall(stats)}`,
      `(tp=${stats.truePositives} fp=${stats.falsePositives} fn=${stats.falseNegatives})`,
    );
    expect(stats.falsePositives).toBeGreaterThanOrEqual(1);
  });
});
