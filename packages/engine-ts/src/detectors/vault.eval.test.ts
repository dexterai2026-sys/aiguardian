import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { loadCorpusFile } from "../corpus/loader.js";
import { evaluateDetector, precision, recall } from "../eval/evaluate.js";
import type { VaultEntry } from "../types.js";
import { detectVaultMatches } from "./vault.js";

const corpusPath = fileURLToPath(new URL("../../../../test-corpus/vault.jsonl", import.meta.url));

// Same reasoning as PR 8's content-flags eval test: CorpusCase has no per-case vault field
// (nothing else needs one), so the corpus is written against this fixed vault fixture instead.
const vault: VaultEntry[] = [
  { id: "child-name", category: "pii.name", value: "Jonathan" },
  { id: "sibling-name", category: "pii.name", value: "Ava" },
  { id: "school", category: "pii.school", value: "Lincoln Elementary School" },
  { id: "street", category: "pii.home_address", value: "Maple Street" },
];

describe("detectVaultMatches corpus evaluation", () => {
  const cases = loadCorpusFile(corpusPath);
  const report = evaluateDetector((text) => detectVaultMatches(text, vault), cases);

  it("meets the quality target (precision >= 0.95, recall >= 0.90)", () => {
    // vault.match isn't structured PII, but exact/fuzzy matching against a small, known set of
    // registered values is at least as constrained as the structured-PII categories, so this
    // corpus holds the detector to the same bar rather than accepting a lower one by default.
    const p = precision(report.overall);
    const r = recall(report.overall);
    expect(p).not.toBeNull();
    expect(r).not.toBeNull();
    expect(p as number).toBeGreaterThanOrEqual(0.95);
    expect(r as number).toBeGreaterThanOrEqual(0.9);
  });
});
