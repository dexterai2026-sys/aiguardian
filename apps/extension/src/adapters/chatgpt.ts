import type { SiteAdapter } from "../lib/siteAdapter.js";

/**
 * ChatGPT adapter (docs/phase-2-plan.md PR 8). Selectors below are verified against two real,
 * saved ChatGPT page snapshots (an empty "new chat" screen, and an active conversation with one
 * exchange) - not guessed from memory, per CLAUDE.md's fixture-based adapter testing requirement.
 * See chatgpt.test.ts and e2e/fixtures/chatgpt.html, both trimmed from those snapshots down to
 * the relevant structure and attributes (the snapshots themselves also contained the account's
 * real conversation history and account/user IDs, which are not reproduced anywhere here).
 */

// The compose box is a ProseMirror contenteditable div, consistently identified by its accessible
// role and label regardless of ChatGPT's own (frequently-changing) utility-class names.
const COMPOSE_BOX_SELECTOR = '[contenteditable="true"][role="textbox"][aria-label="Ask ChatGPT"]';

// Verified only once text is present in the compose box - with it empty, ChatGPT shows "Dictate"/
// "Start Voice" buttons instead, which don't count as a send control at all. Scoped to the
// enclosing <form data-chatgpt-composer>, verified to wrap both the compose box and this button.
const COMPOSER_FORM_SELECTOR = "form[data-chatgpt-composer]";
const SEND_BUTTON_SELECTOR = 'button[aria-label="Send"]';

// The AI's own reply text root. Verified distinct from the person's own sent-message bubble, which
// ChatGPT marks separately as `[data-user-message-bubble="true"]` - this is exactly the
// distinction the generic fallback can't make (see lib/responseRestore.ts's file docs and
// docs/phase-2-plan.md's PR 7 notes) that makes response restore safe to enable here.
const RESPONSE_CONTAINER_SELECTOR = '[data-markdown-text-style="assistant-message"]';

export const chatgptAdapter: SiteAdapter = {
  capabilities: {
    responseRestore: true,
  },

  findComposeBox(root: Document): HTMLElement | null {
    return root.querySelector<HTMLElement>(COMPOSE_BOX_SELECTOR);
  },

  findSendButton(composeBox: HTMLElement): HTMLElement | null {
    const form = composeBox.closest(COMPOSER_FORM_SELECTOR);
    return form?.querySelector<HTMLElement>(SEND_BUTTON_SELECTOR) ?? null;
  },

  findResponseContainers(root: Document): Element[] {
    return Array.from(root.querySelectorAll(RESPONSE_CONTAINER_SELECTOR));
  },
};

export const CHATGPT_RESPONSE_CONTAINER_SELECTOR = RESPONSE_CONTAINER_SELECTOR;
