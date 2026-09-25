import type { RestoreMap } from "@guardian/engine-ts";

/**
 * Watches a page for AI response text containing placeholder tokens (e.g. "[EMAIL_1]") and
 * replaces them, for on-screen display only, with the original value from the current tab's
 * `restoreMap` - since the AI itself only ever saw the masked text (see sendInterceptor.ts), any
 * placeholder it echoes back is purely a display convenience to resolve, never a DOM/storage
 * mutation that could leak the restored value back into the page's own state or network requests.
 * `getRestoreMap` is read fresh on every mutation rather than captured once, since the map grows
 * as the person sends more masked messages over the life of the tab (see generic-fallback.ts).
 *
 * A placeholder with no matching key (the AI hallucinated one, or it's a stale placeholder from
 * a different conversation entirely) is left exactly as-is - restoring only ever fills in a value
 * this tab itself produced.
 *
 * Two things are deliberately never touched, even though both can contain placeholder-shaped
 * text: the compose box itself (a person could legitimately type a literal "[EMAIL_1]"-looking
 * string before it's ever masked, and restoring it prematurely would be surprising and wrong),
 * and Guardian's own UI (the interception panel's masked-preview text is supposed to show the
 * placeholder, not the value it stands for - restoring it there would defeat its purpose).
 */
export interface ResponseRestoreOptions {
  root: Node;
  /** Never touched, even if it matches elsewhere in `root` (see file docs). */
  composeBox: Element;
  getRestoreMap: () => RestoreMap;
}

export interface ResponseRestoreHandle {
  destroy(): void;
}

// Matches mask.ts's placeholder shape exactly: a single uppercase label (rules/*.json's
// "placeholderPrefix" values are always one word - see NAME/EMAIL/ADDRESS/etc.) plus a 1-based
// counter, e.g. "[EMAIL_1]".
const PLACEHOLDER_PATTERN = /\[[A-Z0-9]+_\d+\]/g;
const GUARDIAN_UI_SELECTOR = '[class*="guardian-"]';

export function attachResponseRestore(options: ResponseRestoreOptions): ResponseRestoreHandle {
  const { root, composeBox, getRestoreMap } = options;

  function isExcluded(textNode: Text): boolean {
    const element = textNode.parentElement;
    if (!element) {
      return false;
    }
    return composeBox.contains(element) || element.closest(GUARDIAN_UI_SELECTOR) !== null;
  }

  function restore(textNode: Text): void {
    if (isExcluded(textNode)) {
      return;
    }
    const restoreMap = getRestoreMap();
    if (restoreMap.size === 0) {
      return;
    }
    const original = textNode.data;
    const restored = original.replace(PLACEHOLDER_PATTERN, (placeholder) => {
      return restoreMap.get(placeholder) ?? placeholder;
    });
    if (restored !== original) {
      textNode.data = restored;
    }
  }

  function scanForTextNodes(node: Node): void {
    if (node.nodeType === Node.TEXT_NODE) {
      restore(node as Text);
      return;
    }
    for (const child of Array.from(node.childNodes)) {
      scanForTextNodes(child);
    }
  }

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === "characterData" && mutation.target.nodeType === Node.TEXT_NODE) {
        restore(mutation.target as Text);
      }
      for (const addedNode of Array.from(mutation.addedNodes)) {
        scanForTextNodes(addedNode);
      }
    }
  });

  observer.observe(root, { childList: true, subtree: true, characterData: true });

  return {
    destroy(): void {
      observer.disconnect();
    },
  };
}
