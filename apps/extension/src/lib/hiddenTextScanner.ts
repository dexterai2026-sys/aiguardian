/**
 * Detects text that's present in the DOM (and therefore copyable) but not actually visible to a
 * sighted person - the classic prompt-injection trick of hiding instructions inside content a
 * human might copy from a webpage and paste into an AI chat, never noticing they carried extra
 * text along with it. Distinct from `injection.hidden_text`'s zero-width/bidi-character detection
 * in engine-ts, which runs against already-extracted plain text - this instead inspects the DOM
 * and computed styles of what's actually selected, since CSS-hidden content (as opposed to
 * invisible Unicode characters) leaves no special characters in the copied text at all - the text
 * itself reads completely normally, it's just never rendered where a person can see it.
 *
 * Deliberately heuristic and narrow, not an exhaustive contrast/visibility engine: catches the
 * common, well-known hiding techniques (near-zero opacity, near-zero font size, foreground color
 * equal to background, zero-size clipped boxes, and elements positioned off-screen), not every way
 * CSS can make something invisible (e.g. a full WCAG contrast-ratio calculation, `clip-path`,
 * `text-indent` pushed off-canvas). A missed case means a warning that should have appeared
 * doesn't - never the reverse (silently stripping or blocking) - so under-detection here is a
 * documented gap to widen later, not a silent correctness bug now.
 */

const MIN_VISIBLE_OPACITY = 0.05;
const MIN_VISIBLE_FONT_SIZE_PX = 1;

function isVisuallyHiddenElement(element: Element, view: Window): boolean {
  const style = view.getComputedStyle(element);

  if (style.display === "none" || style.visibility === "hidden") {
    return true;
  }
  if (parseFloat(style.opacity) <= MIN_VISIBLE_OPACITY) {
    return true;
  }
  if (parseFloat(style.fontSize) <= MIN_VISIBLE_FONT_SIZE_PX) {
    return true;
  }
  // Narrow on purpose (see file docs): catches literal color-matches-background, not general low
  // contrast.
  if (style.color === style.backgroundColor && style.color !== "") {
    return true;
  }

  const rect = element.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) {
    return true; // zero-size, typically clipped via overflow:hidden
  }
  if (rect.right < 0 || rect.bottom < 0) {
    return true; // positioned entirely above/left of the viewport
  }

  return false;
}

/** Walks `element` and its ancestors up to (and excluding) `document`, since a node hidden by any
 * ancestor is itself hidden regardless of its own styles. */
function isVisuallyHidden(element: Element, view: Window): boolean {
  let current: Element | null = element;
  while (current && current.nodeType === Node.ELEMENT_NODE) {
    if (isVisuallyHiddenElement(current, view)) {
      return true;
    }
    current = current.parentElement;
  }
  return false;
}

/**
 * Returns the distinct, non-whitespace hidden-text strings found among the text nodes that
 * `selection` actually spans - not the whole page, only what the person is about to copy.
 */
export function findHiddenTextInSelection(selection: Selection | null): string[] {
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
    return [];
  }

  const ownerDocument = selection.anchorNode?.ownerDocument;
  const view = ownerDocument?.defaultView;
  if (!ownerDocument || !view) {
    return [];
  }

  const found = new Set<string>();

  for (let i = 0; i < selection.rangeCount; i++) {
    for (const node of textNodesIntersecting(selection.getRangeAt(i), ownerDocument)) {
      const text = node.textContent?.trim() ?? "";
      const parent = node.parentElement;
      if (text.length > 0 && parent && isVisuallyHidden(parent, view)) {
        found.add(text);
      }
    }
  }

  return Array.from(found);
}

/** A TreeWalker only visits *descendants* of its root, so a range entirely within a single text
 * node (whose commonAncestorContainer is that text node itself, with no children to descend into)
 * needs a direct check instead. */
function textNodesIntersecting(range: Range, ownerDocument: Document): Text[] {
  const root = range.commonAncestorContainer;
  if (root.nodeType === Node.TEXT_NODE) {
    return range.intersectsNode(root) ? [root as Text] : [];
  }

  const nodes: Text[] = [];
  const walker = ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    if (range.intersectsNode(node)) {
      nodes.push(node as Text);
    }
    node = walker.nextNode();
  }
  return nodes;
}
