import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseCorpus, loadCorpusFile, CorpusValidationError } from "./loader.js";

describe("parseCorpus", () => {
  it("parses multiple valid lines and skips blank lines", () => {
    const content = [
      '{"id": "a", "text": "hi", "expected": []}',
      "",
      '{"id": "b", "text": "jane@example.com", "expected": [{"category": "pii.email", "start": 0, "end": 16}]}',
      "   ",
    ].join("\n");

    const cases = parseCorpus(content, "inline");

    expect(cases).toHaveLength(2);
    expect(cases[0]?.id).toBe("a");
    expect(cases[1]?.id).toBe("b");
  });

  it("throws with the source name and line number on invalid JSON", () => {
    const content = '{"id": "a", "text": "hi", "expected": []}\n{not json}';
    expect(() => parseCorpus(content, "fixture.jsonl")).toThrow(/fixture\.jsonl:2/);
  });

  it("throws CorpusValidationError on a schema violation", () => {
    const content = '{"id": "a", "expected": []}';
    expect(() => parseCorpus(content, "fixture.jsonl")).toThrow(CorpusValidationError);
  });
});

describe("loadCorpusFile", () => {
  it("loads and validates the smoke fixture", () => {
    const smokePath = fileURLToPath(
      new URL("../../../../test-corpus/smoke.jsonl", import.meta.url),
    );

    const cases = loadCorpusFile(smokePath);

    expect(cases.length).toBeGreaterThanOrEqual(3);
    expect(cases.map((c) => c.id)).toContain("smoke-neg-001");
    const negative = cases.find((c) => c.id === "smoke-neg-001");
    expect(negative?.expected).toEqual([]);
  });
});
