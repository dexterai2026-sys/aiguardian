import { describe, expect, it } from "vitest";
import type { Finding } from "@guardian/engine-ts";
import { renderHighlightHtml } from "./renderHighlightHtml.js";

function finding(overrides: Partial<Finding> & Pick<Finding, "start" | "end">): Finding {
  return {
    category: "pii.email",
    confidence: 0.9,
    tier: 1,
    suggestedPlaceholder: "EMAIL",
    ...overrides,
  };
}

describe("renderHighlightHtml", () => {
  it("returns the escaped text plus a trailing newline when there are no findings", () => {
    expect(renderHighlightHtml("hello", [])).toBe("hello\n");
  });

  it("wraps a single finding's span in a mark", () => {
    const html = renderHighlightHtml("contact jane@example.com please", [
      finding({ start: 8, end: 24 }),
    ]);
    expect(html).toBe(
      'contact <mark class="guardian-mark" data-category="pii.email" title="Guardian detected: pii.email">jane@example.com</mark> please\n',
    );
  });

  it("wraps multiple non-overlapping findings, in order", () => {
    const html = renderHighlightHtml("a@example.com and 555-123-4567", [
      finding({ category: "pii.phone", start: 18, end: 30 }),
      finding({ category: "pii.email", start: 0, end: 13 }), // out of order on purpose
    ]);
    expect(html).toBe(
      '<mark class="guardian-mark" data-category="pii.email" title="Guardian detected: pii.email">a@example.com</mark> and <mark class="guardian-mark" data-category="pii.phone" title="Guardian detected: pii.phone">555-123-4567</mark>\n',
    );
  });

  it("escapes HTML-significant characters in both plain text and highlighted spans", () => {
    const html = renderHighlightHtml("<b>a@example.com</b>", [finding({ start: 3, end: 16 })]);
    expect(html).toBe(
      '&lt;b&gt;<mark class="guardian-mark" data-category="pii.email" title="Guardian detected: pii.email">a@example.com</mark>&lt;/b&gt;\n',
    );
  });
});
