import type { Finding } from "@guardian/engine-ts";
import { readComposeBoxText } from "./findComposeBox.js";
import { renderHighlightHtml } from "./renderHighlightHtml.js";

/**
 * The classic "highlight inside a text input" technique: an absolutely-positioned mirror div,
 * sized, positioned, and styled identically to the target, sits directly behind it. The target's
 * own background is made transparent, so it paints only its text glyphs - the mirror's `<mark>`
 * background-colors show through in the space around and behind them. Kept in sync with the
 * target's position and scroll offset so the two stay pixel-aligned as the person types, resizes,
 * or scrolls.
 *
 * Used for both `<textarea>` and `[contenteditable]` targets. CLAUDE.md's description suggests
 * contenteditable could instead be highlighted by styling its own content directly (native
 * inline `<mark>`s in place) - deliberately not done here: mutating a contenteditable element's
 * live DOM while the person is typing risks corrupting cursor/selection state and can trip up the
 * host page's own mutation observers or React-style re-renders. The overlay never touches the
 * target's own content, only reads it, so this risk doesn't apply - one technique for both
 * element shapes, at the cost of the metrics-copying fiddliness below.
 *
 * Positioning: the overlay is a sibling of `target` (not a wrapper around it, to avoid moving
 * `target` in the DOM, which could break the host page's own references to it), placed at
 * `target.offsetTop`/`offsetLeft` relative to `target`'s parent - which is why the parent, not
 * `target` itself, is what gets `position: relative` if it isn't positioned already. Stacking:
 * the overlay gets `z-index: -1` rather than promoting `target` to a higher z-index, so the only
 * style this ever changes on `target` itself is its background - CSS paints a positioned
 * descendant with a negative z-index behind its parent's ordinary (static) in-flow children,
 * which `target` remains, without needing to touch `target`'s own position or stacking order at
 * all.
 */
export interface HighlightOverlay {
  /** Re-renders the overlay for the target's *current* text and the given findings. */
  update(findings: Finding[]): void;
  /** Removes the overlay from the DOM and restores the target's and parent's original styles. */
  destroy(): void;
}

const COPIED_STYLE_PROPERTIES = [
  "boxSizing",
  "width",
  "height",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "borderTopWidth",
  "borderRightWidth",
  "borderBottomWidth",
  "borderLeftWidth",
  "borderTopStyle",
  "borderRightStyle",
  "borderBottomStyle",
  "borderLeftStyle",
  "fontFamily",
  "fontSize",
  "fontWeight",
  "fontStyle",
  "lineHeight",
  "letterSpacing",
  "textAlign",
  "textIndent",
  "textTransform",
  "whiteSpace",
  "wordSpacing",
  "overflowWrap",
] as const;

function copyStyles(from: CSSStyleDeclaration, to: CSSStyleDeclaration): void {
  for (const property of COPIED_STYLE_PROPERTIES) {
    to[property] = from[property];
  }
}

export function createHighlightOverlay(target: HTMLElement): HighlightOverlay {
  const ownerDocument = target.ownerDocument;
  const parent = target.parentElement;
  if (!parent) {
    throw new Error("createHighlightOverlay: target must currently have a parent element");
  }

  const previousParentPosition = parent.style.position;
  const parentComputedPosition = ownerDocument.defaultView?.getComputedStyle(parent).position;
  if (!parentComputedPosition || parentComputedPosition === "static") {
    parent.style.position = "relative";
  }

  const overlay = ownerDocument.createElement("div");
  overlay.className = "guardian-highlight-overlay";
  overlay.setAttribute("aria-hidden", "true");
  overlay.style.position = "absolute";
  overlay.style.overflow = "hidden";
  overlay.style.pointerEvents = "none";
  overlay.style.color = "transparent"; // only <mark> backgrounds should be visible
  overlay.style.zIndex = "-1"; // behind target's own (static, in-flow) glyphs - see file docs

  const targetComputedStyle = ownerDocument.defaultView?.getComputedStyle(target);
  if (targetComputedStyle) {
    copyStyles(targetComputedStyle, overlay.style);
  }

  const previousBackground = target.style.background;
  target.style.background = "transparent";

  parent.insertBefore(overlay, target);

  function syncPosition(): void {
    overlay.style.top = `${target.offsetTop}px`;
    overlay.style.left = `${target.offsetLeft}px`;
    overlay.scrollTop = target.scrollTop;
    overlay.scrollLeft = target.scrollLeft;
  }
  syncPosition();
  target.addEventListener("scroll", syncPosition);

  return {
    update(findings: Finding[]): void {
      overlay.innerHTML = renderHighlightHtml(readComposeBoxText(target), findings);
      syncPosition();
    },
    destroy(): void {
      target.removeEventListener("scroll", syncPosition);
      overlay.remove();
      target.style.background = previousBackground;
      parent.style.position = previousParentPosition;
    },
  };
}
