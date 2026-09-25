import { describe, expect, it } from "vitest";
import type { CorpusCase } from "../corpus/schema.js";
import type { Finding } from "../types.js";
import { evaluateDetector, mergeReports, precision, recall } from "./evaluate.js";

describe("precision/recall", () => {
  it("is null when there are no findings at all for a category", () => {
    const stats = { truePositives: 0, falsePositives: 0, falseNegatives: 0 };
    expect(precision(stats)).toBeNull();
    expect(recall(stats)).toBeNull();
  });

  it("computes precision and recall normally otherwise", () => {
    const stats = { truePositives: 3, falsePositives: 1, falseNegatives: 1 };
    expect(precision(stats)).toBe(0.75);
    expect(recall(stats)).toBe(0.75);
  });
});

describe("evaluateDetector", () => {
  const finding: Finding = {
    category: "pii.email",
    start: 0,
    end: 2,
    confidence: 1,
    tier: 1,
    suggestedPlaceholder: "EMAIL",
  };

  it("counts a matching finding as a true positive", () => {
    const cases: CorpusCase[] = [
      { id: "a", text: "hi", expected: [{ category: "pii.email", start: 0, end: 2 }] },
    ];
    const report = evaluateDetector(() => [finding], cases);
    expect(report.overall).toEqual({ truePositives: 1, falsePositives: 0, falseNegatives: 0 });
  });

  it("counts an unexpected finding as a false positive on a hard-negative case", () => {
    const cases: CorpusCase[] = [{ id: "b", text: "hi", expected: [] }];
    const report = evaluateDetector(() => [finding], cases);
    expect(report.overall).toEqual({ truePositives: 0, falsePositives: 1, falseNegatives: 0 });
  });

  it("counts a missed expected finding as a false negative", () => {
    const cases: CorpusCase[] = [
      { id: "a", text: "hi", expected: [{ category: "pii.email", start: 0, end: 2 }] },
    ];
    const report = evaluateDetector(() => [], cases);
    expect(report.overall).toEqual({ truePositives: 0, falsePositives: 0, falseNegatives: 1 });
  });
});

describe("mergeReports", () => {
  it("sums overall and per-category stats across reports", () => {
    const a = evaluateDetector(
      () => [
        {
          category: "pii.email" as const,
          start: 0,
          end: 2,
          confidence: 1,
          tier: 1 as const,
          suggestedPlaceholder: "EMAIL",
        },
      ],
      [{ id: "a", text: "hi", expected: [{ category: "pii.email", start: 0, end: 2 }] }],
    );
    const b = evaluateDetector(
      () => [],
      [{ id: "b", text: "hi", expected: [{ category: "pii.ssn", start: 0, end: 2 }] }],
    );

    const merged = mergeReports([a, b]);
    expect(merged.overall).toEqual({ truePositives: 1, falsePositives: 0, falseNegatives: 1 });
    expect(merged.byCategory.get("pii.email")).toEqual({
      truePositives: 1,
      falsePositives: 0,
      falseNegatives: 0,
    });
    expect(merged.byCategory.get("pii.ssn")).toEqual({
      truePositives: 0,
      falsePositives: 0,
      falseNegatives: 1,
    });
  });
});
