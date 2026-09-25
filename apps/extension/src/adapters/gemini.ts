import type { SiteAdapter } from "../lib/siteAdapter.js";

/**
 * Gemini adapter (docs/phase-2-plan.md PR 9). Selectors below are verified against a real, saved
 * Gemini conversation snapshot (an active conversation with two exchanges) - not guessed from
 * memory, per CLAUDE.md's fixture-based adapter testing requirement. See gemini.test.ts and
 * e2e/fixtures/gemini.html, both trimmed from that snapshot down to the relevant structure and
 * attributes (the snapshot itself also contained the account's real email address in its account
 * menu, which is not reproduced anywhere here).
 */
const COMPOSE_BOX_SELECTOR = '[role="textbox"][aria-label="Enter a prompt for Gemini"]';
const SEND_BUTTON_SELECTOR = 'button[aria-label="Send message"]';

// `<message-content>` is Gemini's custom element for the AI's own response text - verified never
// to appear inside `<user-query-content>` (the person's own sent message) in the saved snapshot,
// which is what makes response restore safe here (same reasoning as adapters/chatgpt.ts and
// adapters/claude.ts).
const RESPONSE_CONTAINER_SELECTOR = "message-content";

export const geminiAdapter: SiteAdapter = {
  capabilities: {
    responseRestore: true,
  },

  findComposeBox(root: Document): HTMLElement | null {
    return root.querySelector<HTMLElement>(COMPOSE_BOX_SELECTOR);
  },

  findSendButton(composeBox: HTMLElement): HTMLElement | null {
    return composeBox.ownerDocument.querySelector<HTMLElement>(SEND_BUTTON_SELECTOR);
  },

  findResponseContainers(root: Document): Element[] {
    return Array.from(root.querySelectorAll(RESPONSE_CONTAINER_SELECTOR));
  },
};

export const GEMINI_RESPONSE_CONTAINER_SELECTOR = RESPONSE_CONTAINER_SELECTOR;
