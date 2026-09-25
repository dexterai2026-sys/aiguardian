import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { loadCorpusFile } from "./corpus/loader.js";
import { detectContentFlags } from "./detectors/contentFlags.js";
import { detectInjection } from "./detectors/injection.js";
import { detectPiiMisc } from "./detectors/piiMisc.js";
import { detectSecrets } from "./detectors/secrets.js";
import { detectStructuredPii } from "./detectors/structuredPii.js";
import { detectVaultMatches } from "./detectors/vault.js";
import { mask } from "./mask.js";
import { restore } from "./restore.js";
import type { Context, Finding, VaultEntry } from "./types.js";

const familyContext: Context = {
  appId: "roundtrip-test",
  siteId: "roundtrip-test",
  mode: "family",
  ageProfile: "teen",
};

const vault: VaultEntry[] = [
  { id: "child-name", category: "pii.name", value: "Jonathan" },
  { id: "sibling-name", category: "pii.name", value: "Ava" },
  { id: "school", category: "pii.school", value: "Lincoln Elementary School" },
  { id: "street", category: "pii.home_address", value: "Maple Street" },
];

function corpusPath(name: string): string {
  return fileURLToPath(new URL(`../../../test-corpus/${name}`, import.meta.url));
}

/**
 * mask()/restore() must round-trip for every real detector against its real corpus, not just
 * the hand-picked example in restore.test.ts - this is the check the plan calls out explicitly
 * (docs/phase-1-plan.md, PR 10: "Round-trip tests ... across the corpus").
 */
describe.each<[string, string, (text: string) => Finding[]]>([
  ["detectStructuredPii", "pii-structured.jsonl", detectStructuredPii],
  ["detectPiiMisc", "pii-misc.jsonl", detectPiiMisc],
  ["detectSecrets", "secrets.jsonl", detectSecrets],
  ["detectInjection", "injection.jsonl", detectInjection],
  ["detectContentFlags", "content-flags.jsonl", (text) => detectContentFlags(text, familyContext)],
  ["detectVaultMatches", "vault.jsonl", (text) => detectVaultMatches(text, vault)],
])("mask/restore round-trip: %s against %s", (_name, corpusFile, detector) => {
  const cases = loadCorpusFile(corpusPath(corpusFile));

  it("restores every case's original text exactly", () => {
    for (const testCase of cases) {
      const findings = detector(testCase.text);
      const { maskedText, restoreMap } = mask(testCase.text, findings);
      expect(restore(maskedText, restoreMap), `case ${testCase.id}`).toBe(testCase.text);
    }
  });
});
