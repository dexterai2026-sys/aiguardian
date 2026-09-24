import { isCategory, type Category } from "../types.js";

/**
 * One expected finding within a corpus case, per the `/test-corpus` JSONL format documented
 * in CLAUDE.md and `/test-corpus/README.md`.
 */
export interface ExpectedFinding {
  category: Category;
  /** Start offset (inclusive) into `text`, in UTF-16 code units. */
  start: number;
  /** End offset (exclusive) into `text`, in UTF-16 code units. */
  end: number;
}

/** One line of a `/test-corpus/*.jsonl` file. */
export interface CorpusCase {
  id: string;
  text: string;
  /** Empty for a hard negative: text that looks like a finding but should not produce one. */
  expected: ExpectedFinding[];
  notes?: string;
}

export class CorpusValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CorpusValidationError";
  }
}

function fail(where: string, message: string): never {
  throw new CorpusValidationError(`${where}: ${message}`);
}

/**
 * Validates a parsed JSON value against the corpus case schema, throwing
 * `CorpusValidationError` with a descriptive message on the first problem found. `where`
 * identifies the case for the error message (e.g. a file path and line number).
 */
export function validateCorpusCase(value: unknown, where: string): asserts value is CorpusCase {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    fail(where, "expected a JSON object");
  }
  const case_ = value as Record<string, unknown>;

  if (typeof case_.id !== "string" || case_.id.length === 0) {
    fail(where, '"id" must be a non-empty string');
  }
  if (typeof case_.text !== "string") {
    fail(where, '"text" must be a string');
  }
  if (case_.notes !== undefined && typeof case_.notes !== "string") {
    fail(where, '"notes" must be a string if present');
  }
  if (!Array.isArray(case_.expected)) {
    fail(where, '"expected" must be an array');
  }

  const text = case_.text as string;
  case_.expected.forEach((entry, index) => {
    const entryWhere = `${where}, expected[${index}]`;
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
      fail(entryWhere, "expected a JSON object");
    }
    const finding = entry as Record<string, unknown>;

    if (!isCategory(finding.category)) {
      fail(entryWhere, `"category" ${JSON.stringify(finding.category)} is not a known category`);
    }
    if (!Number.isInteger(finding.start) || (finding.start as number) < 0) {
      fail(entryWhere, '"start" must be a non-negative integer');
    }
    if (!Number.isInteger(finding.end) || (finding.end as number) <= (finding.start as number)) {
      fail(entryWhere, '"end" must be an integer greater than "start"');
    }
    if ((finding.end as number) > text.length) {
      fail(
        entryWhere,
        `"end" (${finding.end}) is beyond the end of "text" (length ${text.length})`,
      );
    }
  });
}
