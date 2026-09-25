import { debounce } from "./debounce.js";

const RECHECK_DEBOUNCE_MS = 200;

/**
 * Watches for the page's compose box being replaced or newly appearing, and (re-)attaches to it
 * every time this happens. Every AI site this extension targets is a single-page app: leaving or
 * entering a chat (e.g. sending the first message of a new conversation) can swap the compose
 * box's own DOM node via client-side routing, with no full page load - and a content script only
 * runs once, when the page is first injected, so a one-time `findComposeBox()` at that moment can
 * end up wiring every listener (highlighting, send interception, family-mode flagging) to an
 * element that gets silently detached from the page moments later, leaving the person with no
 * protection at all despite the extension having loaded correctly (see docs/phase-2-plan.md's PR
 * 16 notes on this bug, found via real-world testing after PR 16 shipped).
 *
 * `attach` is assumed idempotent-per-call (each call wires a fresh compose box's own listeners;
 * it's never asked to detach anything, since a replaced compose box's old listeners are harmless
 * garbage once that element is no longer in the document). Only re-invoked when the compose box
 * actually changes - ordinary DOM churn nearby (new messages streaming in, sidebar updates) is
 * filtered out by checking whether the *previously* attached element is still connected before
 * bothering to re-search at all.
 */
export function watchComposeBox(
  findComposeBox: () => HTMLElement | null,
  attach: (composeBox: HTMLElement) => void,
): void {
  let current: HTMLElement | null = null;

  function recheck(): void {
    if (current?.isConnected) {
      return;
    }
    const next = findComposeBox();
    if (next) {
      current = next;
      attach(next);
    } else {
      current = null;
    }
  }

  recheck();
  const debouncedRecheck = debounce(recheck, RECHECK_DEBOUNCE_MS);
  new MutationObserver(debouncedRecheck).observe(document.body, {
    childList: true,
    subtree: true,
  });
}
