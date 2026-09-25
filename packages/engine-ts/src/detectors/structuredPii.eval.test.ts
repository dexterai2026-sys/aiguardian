import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { loadCorpusFile } from "../corpus/loader.js";
import { evaluateDetector, precision, recall } from "../eval/evaluate.js";
import { detectStructuredPii } from "./structuredPii.js";

const corpusPath = fileURLToPath(
  new URL("../../../../test-corpus/pii-structured.jsonl", import.meta.url),
);

describe("detectStructuredPii corpus evaluation", () => {
  const cases = loadCorpusFile(corpusPath);
  const report = evaluateDetector(detectStructuredPii, cases);

  it("meets the CLAUDE.md quality target (precision >= 0.95, recall >= 0.90)", () => {
    const p = precision(report.overall);
    const r = recall(report.overall);
    expect(p).not.toBeNull();
    expect(r).not.toBeNull();
    expect(p as number).toBeGreaterThanOrEqual(0.95);
    expect(r as number).toBeGreaterThanOrEqual(0.9);
  });

  it("reports per-category precision/recall for visibility", () => {
    const categories = [...report.byCategory.keys()].sort();
    expect(categories).toEqual(["pii.email", "pii.payment_card", "pii.phone", "pii.ssn"]);

    for (const category of categories) {
      const stats = report.byCategory.get(category)!;
      // Every seeded category should have both positive and negative examples in the corpus,
      // so recall/precision should be measurable (non-null) for each.
      expect(precision(stats)).not.toBeNull();
      expect(recall(stats)).not.toBeNull();
    }
  });
});
