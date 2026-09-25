import type { Category, Finding, VaultEntry } from "../types.js";
import { fuzzyThresholdFor, levenshteinDistance } from "./levenshtein.js";

/**
 * Placeholder label per vault-entry category, mirroring the placeholderPrefix convention used
 * by the rule files (see /rules/README.md). pii.name and pii.school have no Tier-1 pattern rule
 * (no regex makes sense for an arbitrary name or school), so they're only defined here.
 */
const VAULT_PLACEHOLDER_PREFIXES: Partial<Record<Category, string>> = {
  "pii.name": "NAME",
  "pii.school": "SCHOOL",
  "pii.home_address": "ADDRESS",
  "pii.phone": "PHONE",
  "pii.email": "EMAIL",
  "pii.ssn": "SSN",
  "pii.payment_card": "CARD",
  "pii.bank_account": "BANK",
  "pii.dob": "DOB",
  "pii.medical": "MEDICAL",
  "pii.government_id": "GOVID",
};

function placeholderFor(entry: VaultEntry): string {
  return VAULT_PLACEHOLDER_PREFIXES[entry.category] ?? "VAULT";
}

/**
 * All findings from vault matches use category "vault.match" - the literal category CLAUDE.md's
 * enum defines for this tier - rather than the vault entry's own category (e.g. pii.name).
 * `suggestedPlaceholder` carries the human-readable label instead (e.g. "NAME"), so masking
 * still produces a readable [NAME_1] rather than a generic [VAULT_1]. This resolves PR 9's open
 * question about extending Finding: the existing shape already has room for it.
 */
function toFinding(entry: VaultEntry, start: number, end: number, confidence: number): Finding {
  return {
    category: "vault.match",
    start,
    end,
    confidence,
    tier: 2,
    suggestedPlaceholder: placeholderFor(entry),
  };
}

const WORD_PATTERN = /[\p{L}\p{N}'-]+/gu;

function findExactSubstringMatches(text: string, entry: VaultEntry): Finding[] {
  const findings: Finding[] = [];
  const value = entry.value;
  const haystack = text.toLowerCase();
  const needle = value.toLowerCase();

  let fromIndex = 0;
  let index = haystack.indexOf(needle, fromIndex);
  while (index !== -1) {
    findings.push(toFinding(entry, index, index + value.length, 0.95));
    fromIndex = index + Math.max(value.length, 1);
    index = haystack.indexOf(needle, fromIndex);
  }
  return findings;
}

function findWordMatches(text: string, entry: VaultEntry): Finding[] {
  const findings: Finding[] = [];
  const value = entry.value;
  const threshold = fuzzyThresholdFor(value);

  WORD_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = WORD_PATTERN.exec(text)) !== null) {
    const word = match[0];
    const distance = levenshteinDistance(word, value);
    if (distance === 0) {
      findings.push(toFinding(entry, match.index, match.index + word.length, 0.95));
    } else if (distance <= threshold) {
      findings.push(toFinding(entry, match.index, match.index + word.length, 0.7));
    }
  }
  return findings;
}

/**
 * Tier 2 detector: matches `text` against the family's registered vault values (child's name,
 * school, street, etc. - CLAUDE.md's "highest-value tier for families"). Multi-word values
 * (e.g. a street address) are matched by exact case-insensitive substring only; single-word
 * values are also matched fuzzily (typo/misspelling tolerance via Levenshtein, not nickname
 * handling - see levenshtein.ts). Does not resolve overlaps with Tier 1 findings - that's
 * detect() in PR 11.
 */
export function detectVaultMatches(text: string, vault: VaultEntry[] | undefined): Finding[] {
  if (!vault || vault.length === 0) {
    return [];
  }

  const findings: Finding[] = [];
  for (const entry of vault) {
    const value = entry.value.trim();
    if (value.length === 0) {
      continue;
    }
    if (/\s/.test(value)) {
      findings.push(...findExactSubstringMatches(text, entry));
    } else {
      findings.push(...findWordMatches(text, entry));
    }
  }
  return findings;
}
