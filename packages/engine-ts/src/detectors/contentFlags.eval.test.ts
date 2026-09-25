import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { loadCorpusFile } from "../corpus/loader.js";
import { evaluateDetector, precision, recall } from "../eval/evaluate.js";
import type { Context } from "../types.js";
import { detectContentFlags } from "./contentFlags.js";

const corpusPath = fileURLToPath(
  new URL("../../../../test-corpus/content-flags.jsonl", import.meta.url),
);

// The corpus format (CorpusCase) has no notion of Context/mode - it's shared across every
// detector's evaluation, most of which don't need one. Content flags are family-mode-gated, so
// the evaluation harness always calls the detector with a fixed family-mode context; mode
// gating itself is verified separately by the non-family-mode unit tests in
// contentFlags.test.ts, not by this corpus.
const familyContext: Context = {
  appId: "eval",
  siteId: "eval",
  mode: "family",
  ageProfile: "teen",
};

describe("detectContentFlags corpus evaluation", () => {
  const cases = loadCorpusFile(corpusPath);
  const report = evaluateDetector((text) => detectContentFlags(text, familyContext), cases);

  it("reports per-category precision/recall (not gated - CLAUDE.md's quality target is scoped to structured PII)", () => {
    const categories = [...report.byCategory.keys()].sort();
    expect(categories).toEqual([
      "content.secrecy_from_parents",
      "content.self_harm",
      "content.sexual",
      "content.violence",
    ]);

    for (const category of categories) {
      const stats = report.byCategory.get(category)!;
      console.log(
        `${category}: precision=${precision(stats)} recall=${recall(stats)}`,
        `(tp=${stats.truePositives} fp=${stats.falsePositives} fn=${stats.falseNegatives})`,
      );
    }
  });

  it("documents the known false positives on media-quote and surprise-party hard negatives", () => {
    const violence = report.byCategory.get("content.violence")!;
    const secrecy = report.byCategory.get("content.secrecy_from_parents")!;
    expect(violence.falsePositives).toBeGreaterThanOrEqual(1);
    expect(secrecy.falsePositives).toBeGreaterThanOrEqual(1);
  });
});
