import type { Finding } from "@guardian/engine-ts";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Renders `text` as HTML with each finding's span wrapped in a `<mark>`, for the overlay
 * technique in highlightOverlay.ts. Assumes `findings` are already overlap-resolved (as
 * `detect()`'s output always is) - this function only sorts by `start`, it doesn't itself
 * detect or repair overlaps, so passing raw unresolved Tier 1 output here would produce
 * malformed/nested marks.
 *
 * A trailing newline is appended so the mirror div always has at least one more line than the
 * visible text - without it, a textarea ending in "\n" renders an extra blank line the mirror
 * div wouldn't otherwise reserve space for, throwing off the scroll-height match between them.
 */
export function renderHighlightHtml(text: string, findings: Finding[]): string {
  const sorted = [...findings].sort((a, b) => a.start - b.start);

  let html = "";
  let cursor = 0;
  for (const finding of sorted) {
    html += escapeHtml(text.slice(cursor, finding.start));
    html += `<mark class="guardian-mark" data-category="${escapeHtml(finding.category)}" title="Guardian detected: ${escapeHtml(finding.category)}">`;
    html += escapeHtml(text.slice(finding.start, finding.end));
    html += "</mark>";
    cursor = finding.end;
  }
  html += escapeHtml(text.slice(cursor));

  return html + "\n";
}
