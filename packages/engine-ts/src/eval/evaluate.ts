// Test/tooling entry point, deliberately separate from ../index.ts, same reasoning as the
// corpus and rules loaders: this is a corpus-driven precision/recall harness used by tests
// (and, from PR 12, CI), not part of the runtime detection API.
import type { CorpusCase } from "../corpus/schema.js";
import type { Category, Finding } from "../types.js";

export interface CategoryStats {
  truePositives: number;
  falsePositives: number;
  falseNegatives: number;
}

export interface EvalReport {
  overall: CategoryStats;
  byCategory: Map<Category, CategoryStats>;
}

function emptyStats(): CategoryStats {
  return { truePositives: 0, falsePositives: 0, falseNegatives: 0 };
}

/** `null` when the denominator is zero (no findings at all, positive or negative). */
export function precision(stats: CategoryStats): number | null {
  const denominator = stats.truePositives + stats.falsePositives;
  return denominator === 0 ? null : stats.truePositives / denominator;
}

/** `null` when the denominator is zero (corpus has no expected findings for this category). */
export function recall(stats: CategoryStats): number | null {
  const denominator = stats.truePositives + stats.falseNegatives;
  return denominator === 0 ? null : stats.truePositives / denominator;
}

/**
 * Runs `detector` against every corpus case and scores its output against `expected`. A
 * finding counts as a true positive only when its category, start, and end all exactly match
 * an unconsumed expected entry for that case (each expected entry can be consumed at most
 * once, so duplicate findings for the same span still count as false positives).
 */
export function evaluateDetector(
  detector: (text: string) => Finding[],
  cases: CorpusCase[],
): EvalReport {
  const overall = emptyStats();
  const byCategory = new Map<Category, CategoryStats>();

  const statsFor = (category: Category): CategoryStats => {
    const existing = byCategory.get(category);
    if (existing) {
      return existing;
    }
    const created = emptyStats();
    byCategory.set(category, created);
    return created;
  };

  for (const testCase of cases) {
    const remaining = testCase.expected.map((entry) => ({ ...entry, matched: false }));

    for (const found of detector(testCase.text)) {
      const matchIndex = remaining.findIndex(
        (entry) =>
          !entry.matched &&
          entry.category === found.category &&
          entry.start === found.start &&
          entry.end === found.end,
      );

      if (matchIndex === -1) {
        overall.falsePositives += 1;
        statsFor(found.category).falsePositives += 1;
      } else {
        remaining[matchIndex]!.matched = true;
        overall.truePositives += 1;
        statsFor(found.category).truePositives += 1;
      }
    }

    for (const entry of remaining) {
      if (!entry.matched) {
        overall.falseNegatives += 1;
        statsFor(entry.category).falseNegatives += 1;
      }
    }
  }

  return { overall, byCategory };
}

function addStats(target: CategoryStats, source: CategoryStats): void {
  target.truePositives += source.truePositives;
  target.falsePositives += source.falsePositives;
  target.falseNegatives += source.falseNegatives;
}

/**
 * Combines several reports (e.g. one per corpus file, since `detect()` needs a different
 * `Context` per corpus - see docs/phase-1-plan.md PR 11) into a single overall + per-category
 * report, as if every case had been evaluated together.
 */
export function mergeReports(reports: EvalReport[]): EvalReport {
  const overall = emptyStats();
  const byCategory = new Map<Category, CategoryStats>();

  for (const report of reports) {
    addStats(overall, report.overall);
    for (const [category, stats] of report.byCategory) {
      const existing = byCategory.get(category);
      if (existing) {
        addStats(existing, stats);
      } else {
        byCategory.set(category, { ...stats });
      }
    }
  }

  return { overall, byCategory };
}
