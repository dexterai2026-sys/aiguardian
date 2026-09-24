import { readFileSync } from "node:fs";
import { CorpusValidationError, validateCorpusCase, type CorpusCase } from "./schema.js";

export { CorpusValidationError };

/**
 * Parses JSONL corpus content (one case per line; blank lines are skipped) into validated
 * `CorpusCase` objects. `sourceName` is used only to identify the source in error messages
 * (e.g. a file path), so this can be tested without touching the filesystem.
 */
export function parseCorpus(content: string, sourceName: string): CorpusCase[] {
  const cases: CorpusCase[] = [];
  const lines = content.split("\n");

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (trimmed.length === 0) {
      return;
    }

    const lineNumber = index + 1;
    const where = `${sourceName}:${lineNumber}`;

    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch (cause) {
      throw new CorpusValidationError(
        `${where}: invalid JSON (${cause instanceof Error ? cause.message : String(cause)})`,
      );
    }

    validateCorpusCase(parsed, where);
    cases.push(parsed);
  });

  return cases;
}

/** Reads and parses a single `/test-corpus/*.jsonl` file. */
export function loadCorpusFile(path: string): CorpusCase[] {
  const content = readFileSync(path, "utf-8");
  return parseCorpus(content, path);
}
