/**
 * The interface a per-site adapter (PR 8+) implements in place of the generic fallback's
 * heuristics (lib/findComposeBox.ts, lib/findSendButton.ts). An adapter trades the generic
 * fallback's site-agnostic guessing for selectors verified against that specific site's real,
 * saved DOM (CLAUDE.md requires fixture-based testing, not live scraping) - in exchange, it can
 * safely support things the generic fallback can't, like response restore (lib/responseRestore.ts),
 * which needs a selector that reliably picks out only the AI's own reply, never the site's own
 * echo of what the person just sent.
 *
 * `capabilities` lets an adapter be honest about what it can't yet support (e.g. a site whose
 * response container hasn't been verified against a real snapshot) rather than wiring in a guess -
 * the same "documented gap, not a guess" approach used throughout this engine and extension.
 */
export interface SiteAdapterCapabilities {
  /** Whether `findResponseContainer` is verified against this site's real DOM and safe to use for
   * response restore - false means the adapter still relies on generic-fallback-style behavior
   * for anything response-related, same as if there were no adapter at all for this piece. */
  responseRestore: boolean;
}

export interface SiteAdapter {
  capabilities: SiteAdapterCapabilities;
  /** Finds the chat compose box, using this site's own known markup rather than a generic
   * largest-visible-element heuristic. */
  findComposeBox(root: Document): HTMLElement | null;
  /** Finds the control that sends `composeBox`'s current content. */
  findSendButton(composeBox: HTMLElement): HTMLElement | null;
  /** Finds the root element(s) that contain only the AI's own responses - never the site's own
   * echo of the person's sent message. Only meaningful when `capabilities.responseRestore` is
   * true; returns an empty array otherwise. */
  findResponseContainers(root: Document): Element[];
}
