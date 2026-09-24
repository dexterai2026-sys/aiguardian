import { describe, expect, it } from "vitest";
import { validateCorpusCase, CorpusValidationError } from "./schema.js";

const valid = {
  id: "addr-001",
  text: "we live at 42 Maple Street",
  expected: [{ category: "pii.home_address", start: 11, end: 26 }],
  notes: "basic street address",
};

describe("validateCorpusCase", () => {
  it("accepts a well-formed case", () => {
    expect(() => validateCorpusCase(valid, "test")).not.toThrow();
  });

  it("accepts a hard negative with an empty expected array", () => {
    expect(() =>
      validateCorpusCase({ id: "neg-001", text: "hi", expected: [] }, "test"),
    ).not.toThrow();
  });

  it("rejects a non-object value", () => {
    expect(() => validateCorpusCase("not an object", "test")).toThrow(CorpusValidationError);
  });

  it("rejects a missing id", () => {
    const { id: _id, ...rest } = valid;
    expect(() => validateCorpusCase(rest, "test")).toThrow(/"id"/);
  });

  it("rejects an unknown category", () => {
    const bad = { ...valid, expected: [{ category: "pii.bogus", start: 0, end: 1 }] };
    expect(() => validateCorpusCase(bad, "test")).toThrow(/not a known category/);
  });

  it("rejects a negative start offset", () => {
    const bad = { ...valid, expected: [{ category: "pii.home_address", start: -1, end: 5 }] };
    expect(() => validateCorpusCase(bad, "test")).toThrow(/"start"/);
  });

  it("rejects an end offset before start", () => {
    const bad = { ...valid, expected: [{ category: "pii.home_address", start: 10, end: 5 }] };
    expect(() => validateCorpusCase(bad, "test")).toThrow(/"end"/);
  });

  it("rejects an end offset beyond the text length", () => {
    const bad = { ...valid, expected: [{ category: "pii.home_address", start: 0, end: 999 }] };
    expect(() => validateCorpusCase(bad, "test")).toThrow(/beyond the end of "text"/);
  });
});
