import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { loadCorpusFile } from "./corpus/loader.js";
import { detect } from "./detect.js";
import {
  evaluateDetector,
  mergeReports,
  precision,
  recall,
  type CategoryStats,
  type EvalReport,
} from "./eval/evaluate.js";
import type { Category, Context, VaultEntry } from "./types.js";

function sumStats(report: EvalReport, categories: Category[]): CategoryStats {
  const totals = { truePositives: 0, falsePositives: 0, falseNegatives: 0 };
  for (const category of categories) {
    const stats = report.byCategory.get(category);
    if (!stats) {
      continue;
    }
    totals.truePositives += stats.truePositives;
    totals.falsePositives += stats.falsePositives;
    totals.falseNegatives += stats.falseNegatives;
  }
  return totals;
}

function corpusPath(name: string): string {
  return fileURLToPath(new URL(`../../../test-corpus/${name}`, import.meta.url));
}

const personalContext: Context = {
  appId: "eval",
  siteId: "eval",
  mode: "personal",
  ageProfile: "adult",
};

const familyContext: Context = { ...personalContext, mode: "family", ageProfile: "teen" };

// Same fixed vault fixture as vault.eval.test.ts. Deliberately scoped to only vault.jsonl: this
// vault's "Maple Street" entry overlaps pii-misc.jsonl's own "42 Maple Street" address case
// (both corpora happened to reuse CLAUDE.md's example address), and detect()'s overlap
// resolution would then drop that corpus's expected pii.home_address finding in favor of the
// higher-tier vault match - a real interaction, not a bug, but one that would corrupt
// pii-misc.jsonl's own precision/recall numbers if the vault were applied there too. Each corpus
// file is evaluated with only the context it was actually written against.
const vault: VaultEntry[] = [
  { id: "child-name", category: "pii.name", value: "Jonathan" },
  { id: "sibling-name", category: "pii.name", value: "Ava" },
  { id: "school", category: "pii.school", value: "Lincoln Elementary School" },
  { id: "street", category: "pii.home_address", value: "Maple Street" },
];
const vaultContext: Context = { ...personalContext, vault };

/**
 * First end-to-end measurement of every category through the real detect() entry point (every
 * other eval test in PRs 5-9 called its own detector function directly). Mirrors PR 5's
 * structured-PII gate and PRs 6-9's report-only categories, but now exercised through detect()'s
 * full fan-out and overlap resolution, per docs/phase-1-plan.md PR 11.
 */
describe("detect() corpus evaluation (all categories, end-to-end)", () => {
  const reports = [
    evaluateDetector(
      (text) => detect(text, personalContext),
      loadCorpusFile(corpusPath("pii-structured.jsonl")),
    ),
    evaluateDetector(
      (text) => detect(text, personalContext),
      loadCorpusFile(corpusPath("pii-misc.jsonl")),
    ),
    evaluateDetector(
      (text) => detect(text, personalContext),
      loadCorpusFile(corpusPath("secrets.jsonl")),
    ),
    evaluateDetector(
      (text) => detect(text, personalContext),
      loadCorpusFile(corpusPath("injection.jsonl")),
    ),
    evaluateDetector(
      (text) => detect(text, familyContext),
      loadCorpusFile(corpusPath("content-flags.jsonl")),
    ),
    evaluateDetector(
      (text) => detect(text, vaultContext),
      loadCorpusFile(corpusPath("vault.jsonl")),
    ),
  ];
  const report = mergeReports(reports);

  it("meets the CLAUDE.md quality target for structured PII through detect()", () => {
    const structuredPii = sumStats(report, [
      "pii.payment_card",
      "pii.ssn",
      "pii.phone",
      "pii.email",
    ]);

    const p = precision(structuredPii);
    const r = recall(structuredPii);
    expect(p).not.toBeNull();
    expect(r).not.toBeNull();
    expect(p as number).toBeGreaterThanOrEqual(0.95);
    expect(r as number).toBeGreaterThanOrEqual(0.9);
  });

  it("meets the same bar for vault.match through detect()", () => {
    const stats = report.byCategory.get("vault.match")!;
    expect(precision(stats)).toBeGreaterThanOrEqual(0.95);
    expect(recall(stats)).toBeGreaterThanOrEqual(0.9);
  });

  it("reports every other category's precision/recall (not gated) for visibility", () => {
    const categories = [...report.byCategory.keys()].sort();
    expect(categories.length).toBeGreaterThan(0);
    for (const category of categories) {
      const stats = report.byCategory.get(category)!;
      console.log(
        `${category}: precision=${precision(stats)} recall=${recall(stats)}`,
        `(tp=${stats.truePositives} fp=${stats.falsePositives} fn=${stats.falseNegatives})`,
      );
    }
  });
});
