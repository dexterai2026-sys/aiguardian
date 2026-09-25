import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { loadCorpusFile } from "../corpus/loader.js";
import { evaluateDetector, precision, recall } from "../eval/evaluate.js";
import { detectInjection } from "./injection.js";

const corpusPath = fileURLToPath(
  new URL("../../../../test-corpus/injection.jsonl", import.meta.url),
);

describe("detectInjection corpus evaluation", () => {
  const cases = loadCorpusFile(corpusPath);
  const report = evaluateDetector(detectInjection, cases);

  it("reports per-category precision/recall (not gated - CLAUDE.md's quality target is scoped to structured PII)", () => {
    const categories = [...report.byCategory.keys()].sort();
    expect(categories).toEqual(["injection.hidden_text", "injection.instruction_pattern"]);

    for (const category of categories) {
      const stats = report.byCategory.get(category)!;
      console.log(
        `${category}: precision=${precision(stats)} recall=${recall(stats)}`,
        `(tp=${stats.truePositives} fp=${stats.falsePositives} fn=${stats.falseNegatives})`,
      );
    }
  });
});
