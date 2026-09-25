import type { SiteAdapter } from "../lib/siteAdapter.js";

/**
 * Claude.ai adapter (docs/phase-2-plan.md PR 9). Selectors below are verified against a real,
 * saved Claude.ai conversation snapshot (an active conversation with several exchanges, in
 * Spanish) - not guessed from memory, per CLAUDE.md's fixture-based adapter testing requirement.
 * See claude.test.ts and e2e/fixtures/claude.html, both trimmed from that snapshot down to the
 * relevant structure and attributes (the snapshot itself also contained the account's real
 * sidebar chat history, which is not reproduced anywhere here).
 *
 * Unlike ChatGPT (see adapters/chatgpt.ts), Claude.ai ships stable `data-testid` attributes on
 * every relevant element and its own send button stays present in the DOM at all times (state
 * toggled via attributes, not by adding/removing the node) - no equivalent of ChatGPT's
 * appears-only-once-there's-text gap here, verified from the same snapshot.
 */
const COMPOSE_BOX_SELECTOR = '[data-testid="chat-input"]';
const SEND_BUTTON_SELECTOR = '[data-testid="chat-input-send"]';

// Verified distinct from the person's own sent-message container (`[data-testid="user-message"]`)
// in the same snapshot - the distinction that makes response restore safe here, same reasoning as
// adapters/chatgpt.ts.
const RESPONSE_CONTAINER_SELECTOR = '[data-testid="assistant-message"]';

export const claudeAdapter: SiteAdapter = {
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

export const CLAUDE_RESPONSE_CONTAINER_SELECTOR = RESPONSE_CONTAINER_SELECTOR;
