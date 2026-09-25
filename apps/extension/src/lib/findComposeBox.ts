/**
 * Heuristic for locating the chat-style compose box on an AI site's page, for the "generic
 * fallback" content script (per CLAUDE.md: real per-site adapters, PR 8+, take precedence when
 * they exist; this runs everywhere else on the matched AI-site list).
 *
 * Candidates are `<textarea>` and `[contenteditable]` elements (the two shapes a rich chat input
 * takes); the largest visible one wins, since a compose box is typically the most prominent text
 * input on the page. Deliberately simple for this first pass - CLAUDE.md's fuller description
 * ("large textarea... near a send-shaped button") also wants proximity to a send control, which
 * this doesn't check; a wrong pick would show highlighting/interception on the wrong element,
 * which is recoverable (nothing is silently lost), so the added complexity of a
 * nearest-send-button search is deferred rather than built speculatively now.
 */
export function findComposeBox(root: ParentNode = document): HTMLElement | null {
  const candidates: HTMLElement[] = [
    ...root.querySelectorAll<HTMLTextAreaElement>("textarea"),
    ...root.querySelectorAll<HTMLElement>('[contenteditable="true"], [contenteditable=""]'),
  ];

  let best: HTMLElement | null = null;
  let bestArea = 0;

  for (const element of candidates) {
    const rect = element.getBoundingClientRect();
    const area = rect.width * rect.height;
    if (area <= 0) {
      continue; // hidden, zero-size, or not laid out
    }
    if (area > bestArea) {
      bestArea = area;
      best = element;
    }
  }

  return best;
}

/** Reads the current text out of a compose box, whichever of the two candidate shapes it is. */
export function readComposeBoxText(element: HTMLElement): string {
  if (element instanceof HTMLTextAreaElement) {
    return element.value;
  }
  return element.textContent ?? "";
}
