/**
 * Standard Levenshtein edit distance (single-character insert/delete/substitute) between two
 * strings, case-insensitive. Exact algorithm, not an approximation - a hand-written O(n*m)
 * dynamic-programming table is exact and fast enough for the short strings (names, street
 * words) and small vaults (tens of entries per family) this is used against; no dependency
 * needed (decision recorded in docs/phase-1-plan.md, PR 9).
 */
export function levenshteinDistance(a: string, b: string): number {
  const s = a.toLowerCase();
  const t = b.toLowerCase();

  if (s === t) {
    return 0;
  }
  if (s.length === 0) {
    return t.length;
  }
  if (t.length === 0) {
    return s.length;
  }

  let previousRow = Array.from({ length: t.length + 1 }, (_, i) => i);

  for (let i = 1; i <= s.length; i++) {
    const currentRow = [i];
    for (let j = 1; j <= t.length; j++) {
      const cost = s[i - 1] === t[j - 1] ? 0 : 1;
      currentRow.push(
        Math.min(
          currentRow[j - 1]! + 1, // insertion
          previousRow[j]! + 1, // deletion
          previousRow[j - 1]! + cost, // substitution
        ),
      );
    }
    previousRow = currentRow;
  }

  return previousRow[t.length]!;
}

/**
 * How much edit distance to tolerate for a fuzzy match against a registered value of this
 * length. Deliberately conservative for short values (<=3 chars: exact match only), since a
 * short string has many unrelated words within edit distance 1 of it - a real limitation, not a
 * bug. This is a typo/misspelling tolerance, not nickname handling: "Jonathan" vs "Jonathon" is
 * one substitution away and matches; "Jonathan" vs "Jonny" is not (nicknames need a separate
 * alias list, out of scope for Phase 1).
 */
export function fuzzyThresholdFor(value: string): number {
  if (value.length <= 3) {
    return 0;
  }
  if (value.length <= 6) {
    return 1;
  }
  return 2;
}
