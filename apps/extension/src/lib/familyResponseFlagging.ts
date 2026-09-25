import { detect } from "@guardian/engine-ts";
import type { Context, Finding } from "@guardian/engine-ts";

/**
 * Family-mode response flagging (PR 15): runs detect() with `context.mode: "family"` against the
 * AI's own reply text, inside a site adapter's verified response container (never the person's
 * own echoed message - see adapters/*.ts and lib/responseRestore.ts's file docs for why that
 * distinction matters). Flags matched spans in place with a `<mark>`, directly inside the
 * response's existing rendered HTML - unlike the compose-box highlight overlay
 * (lib/highlightOverlay.ts), which uses a separate transparent overlay because the underlying
 * element is live-edited by the person typing, a rendered AI response isn't being edited, so
 * marking it up in place is safe and simpler.
 *
 * No alert is sent anywhere - there is no parent, backend, or dashboard to send one to yet. This
 * is strictly an in-the-moment, on-device signal to whoever is at the keyboard, same as every
 * other personal-mode feature in this extension.
 */
export interface FamilyResponseFlaggingOptions {
  root: Node;
  responseContainerSelector: string;
  /** Re-read on every scan, never cached across calls - returns `null` when flagging shouldn't run
   * right now (personal mode, or the vault session cache has auto-locked or was never unlocked
   * this browser session - see lib/vaultSessionCache.ts), in which case this pass is skipped
   * entirely rather than running detect() with an empty/stale vault. */
  getContext: () => Promise<Context | null>;
}

export interface FamilyResponseFlaggingHandle {
  destroy(): void;
}

const FLAG_CLASS = "guardian-family-flag";
const SCAN_DEBOUNCE_MS = 500; // lets a streaming response settle before scanning it

interface TextNodeSpan {
  node: Text;
  start: number;
  end: number;
}

/** Walks `container`'s text nodes, skipping any already inside a `<mark>` this module created
 * itself - both so a re-scan never tries to flag already-flagged text again, and so it doesn't
 * infinite-loop by reacting to its own DOM changes (see attachFamilyResponseFlagging's
 * disconnect/reconnect around each scan for the other half of that). */
function collectTextNodes(container: Element): TextNodeSpan[] {
  const ownerDocument = container.ownerDocument;
  const spans: TextNodeSpan[] = [];
  let offset = 0;

  const walker = ownerDocument.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    const text = node as Text;
    if (!text.parentElement?.classList.contains(FLAG_CLASS)) {
      spans.push({ node: text, start: offset, end: offset + text.data.length });
      offset += text.data.length;
    }
    node = walker.nextNode();
  }
  return spans;
}

/**
 * Wraps `finding`'s matched range in a `<mark>`, if (and only if) it falls entirely within one
 * text node. A match spanning multiple text nodes (e.g. split by inline markdown formatting like
 * `**bold**` partway through a flagged phrase) is a known, documented gap, not attempted here -
 * the same "honest, narrow scope over a fragile guess" approach used elsewhere in this engine.
 */
function highlightFinding(
  textNodes: TextNodeSpan[],
  finding: Finding,
  ownerDocument: Document,
): void {
  const span = textNodes.find((s) => finding.start >= s.start && finding.end <= s.end);
  if (!span) {
    return;
  }

  const localStart = finding.start - span.start;
  const localEnd = finding.end - span.start;
  const matched = span.node.splitText(localStart);
  matched.splitText(localEnd - localStart);

  const mark = ownerDocument.createElement("mark");
  mark.className = FLAG_CLASS;
  mark.dataset.category = finding.category;
  mark.title = `Guardian flagged: ${finding.category}`;
  matched.replaceWith(mark);
  mark.appendChild(matched);
}

export function attachFamilyResponseFlagging(
  options: FamilyResponseFlaggingOptions,
): FamilyResponseFlaggingHandle {
  const { root, responseContainerSelector, getContext } = options;
  const ownerDocument = root.ownerDocument ?? (root as Document);

  async function scanAllContainers(): Promise<void> {
    const context = await getContext();
    if (!context) {
      return;
    }

    const containers = Array.from(
      ownerDocument.querySelectorAll<Element>(responseContainerSelector),
    );

    // Disconnected for the duration of our own edits below, so wrapping a match in <mark> doesn't
    // immediately re-trigger this same observer on our own mutation.
    observer.disconnect();
    try {
      for (const container of containers) {
        const textNodes = collectTextNodes(container);
        if (textNodes.length === 0) {
          continue;
        }
        const fullText = textNodes.map((span) => span.node.data).join("");
        const findings = detect(fullText, context);
        // Highlighted in reverse offset order so splitting a text node for an earlier match
        // doesn't shift the still-to-process offsets of a later match in the same node.
        for (const finding of [...findings].sort((a, b) => b.start - a.start)) {
          highlightFinding(textNodes, finding, ownerDocument);
        }
      }
    } finally {
      observer.observe(root, { childList: true, subtree: true, characterData: true });
    }
  }

  let scanScheduled = false;
  let scanTimeoutId: ReturnType<typeof setTimeout> | undefined;
  function scheduleScan(): void {
    if (scanScheduled) {
      return;
    }
    scanScheduled = true;
    scanTimeoutId = setTimeout(() => {
      scanScheduled = false;
      void scanAllContainers();
    }, SCAN_DEBOUNCE_MS);
  }

  const observer = new MutationObserver(scheduleScan);
  observer.observe(root, { childList: true, subtree: true, characterData: true });
  scheduleScan(); // covers content already present at attach time

  return {
    destroy(): void {
      observer.disconnect();
      // Without this, a scan already scheduled (but not yet run) before destroy() would still
      // fire afterward - the observer being disconnected only stops *new* mutations from
      // scheduling further scans, it doesn't cancel one already in flight.
      clearTimeout(scanTimeoutId);
    },
  };
}
