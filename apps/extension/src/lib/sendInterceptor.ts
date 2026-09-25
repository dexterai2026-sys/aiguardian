import { mask } from "@guardian/engine-ts";
import type { Finding, RestoreMap } from "@guardian/engine-ts";
import { readComposeBoxText } from "./findComposeBox.js";
import { createInterceptionPanel } from "./interceptionPanel.js";

export interface SendInterceptorOptions {
  composeBox: HTMLElement;
  /** A fixed element, `null` if there's no send button to intercept clicks on, or a getter
   * re-resolved on every click - needed for a site (e.g. ChatGPT, see adapters/chatgpt.ts) whose
   * send button doesn't exist in the DOM at all until the compose box has content, so it can't be
   * captured once up front the way a fixed element can. */
  sendButton: HTMLElement | null | (() => HTMLElement | null);
  /** Runs detection fresh at interception time - never relies on stale/debounced findings. */
  detectNow: (text: string) => Finding[];
  /** Called whenever a review panel is actually shown to the person (PR 13: usage stats) - not on
   * every debounced re-scan while typing, only the discrete moment findings were surfaced. */
  onFindings?: (findings: Finding[]) => void;
  /** Called after "Send masked" replaces the compose box's text, so a caller (PR 7: response
   * restore) can keep the resulting map for this tab/conversation. Never persisted here or by
   * any caller - CLAUDE.md requires restoreMap live in memory only. `findings` is the same set
   * `onFindings` already saw for this interception, passed again so a caller (PR 13: usage stats)
   * doesn't have to keep its own copy just to know what was masked. */
  onMasked?: (restoreMap: RestoreMap, findings: Finding[]) => void;
}

/**
 * Selects all of `composeBox`'s content and replaces it via `execCommand("insertText", ...)`,
 * returning whether that actually worked. This matters for a rich-text editor (e.g. ChatGPT's
 * ProseMirror-based compose box): such editors keep their OWN internal document model, entirely
 * separate from the DOM - directly overwriting `.textContent` changes what's on screen but leaves
 * that internal model untouched, so a framework's own Enter/Send handling (which reads its model,
 * not raw DOM text) can go on to send the ORIGINAL, un-masked text a moment later even though the
 * DOM briefly showed the masked version (a real bug found via testing on live chatgpt.com, not
 * caught by this repo's fixture-based e2e tests, whose fixtures are plain, framework-free
 * contenteditable elements). `execCommand("insertText", ...)`, despite being deprecated, is still
 * implemented by Chromium and is exactly the technique other extensions in this same space
 * (grammar/spell-checkers) use for this reason: it goes through the same native text-insertion
 * path a real keystroke would, which rich editors listen for via `beforeinput`/`input` to update
 * their own state correctly - unlike a synthetic "input" event fired after the fact.
 */
function setContentEditableTextViaExecCommand(composeBox: HTMLElement, text: string): boolean {
  const ownerDocument = composeBox.ownerDocument;
  composeBox.focus();
  const selection = ownerDocument.getSelection();
  const range = ownerDocument.createRange();
  range.selectNodeContents(composeBox);
  selection?.removeAllRanges();
  selection?.addRange(range);
  try {
    return ownerDocument.execCommand("insertText", false, text);
  } catch {
    // Not implemented in this environment (e.g. jsdom in unit tests) - caller falls back.
    return false;
  }
}

function setComposeBoxText(composeBox: HTMLElement, text: string): void {
  if (composeBox instanceof HTMLTextAreaElement) {
    composeBox.value = text;
  } else if (!setContentEditableTextViaExecCommand(composeBox, text)) {
    composeBox.textContent = text;
  } else {
    return; // execCommand already dispatched its own native input event(s).
  }
  // Sites commonly listen for "input" to sync their own state (React/Vue controlled inputs,
  // send-button enabled/disabled state, etc.) - setting .value/.textContent directly doesn't
  // fire it on its own.
  composeBox.dispatchEvent(new Event("input", { bubbles: true }));
}

/**
 * Resolves after two animation frames - real-world testing on live chatgpt.com found that even
 * `execCommand("insertText", ...)` wasn't enough on its own: a rich-text editor like ProseMirror
 * reconciles DOM mutations it didn't originate itself (as ours technically didn't, despite going
 * through the native insertText path) via its own MutationObserver-driven flush cycle, which isn't
 * guaranteed to complete synchronously within the same call stack as execCommand. Replaying the
 * send immediately after, in the same synchronous tick, can still race that flush and hit the
 * editor's own (still un-masked) internal state. Two animation frames is the standard "wait for a
 * full paint/observer-flush cycle" technique - cheap enough to be imperceptible to the person, but
 * enough for a MutationObserver callback (which fires at the end of the current microtask queue,
 * well before the next animation frame) to have definitely run at least once.
 */
function nextAnimationFrame(ownerDocument: Document): Promise<void> {
  const view = ownerDocument.defaultView ?? window;
  return new Promise((resolve) => {
    view.requestAnimationFrame(() => view.requestAnimationFrame(() => resolve()));
  });
}

/**
 * Wires up send interception on a compose box: pressing Enter (without Shift) or clicking its
 * send button, when there are findings, shows a review panel instead of letting the send
 * through. Never blocks sending outright - "Send anyway" always works - per CLAUDE.md's
 * "protect and teach, don't restrict" approach.
 */
export function attachSendInterceptor(options: SendInterceptorOptions): void {
  const { composeBox, sendButton, detectNow, onFindings, onMasked } = options;
  const ownerDocument = composeBox.ownerDocument;

  const resolveSendButton: () => HTMLElement | null =
    typeof sendButton === "function" ? sendButton : () => sendButton;

  let bypassNextEnter = false;
  let bypassNextClick = false;
  let activePanel: ReturnType<typeof createInterceptionPanel> | null = null;

  function closePanel(): void {
    activePanel?.remove();
    activePanel = null;
  }

  function replay(kind: "enter" | "click"): void {
    if (kind === "enter") {
      bypassNextEnter = true;
      composeBox.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Enter",
          code: "Enter",
          bubbles: true,
          cancelable: true,
        }),
      );
    } else {
      // Re-resolved rather than reusing whatever element intercept() saw: a site can re-render its
      // send button between interception and this replay (e.g. ChatGPT's is a fresh DOM node any
      // time the compose box's empty/non-empty state toggles).
      const button = resolveSendButton();
      if (button) {
        bypassNextClick = true;
        button.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      }
    }
  }

  function intercept(kind: "enter" | "click", event: Event): void {
    const text = readComposeBoxText(composeBox);
    const findings = detectNow(text);
    if (findings.length === 0) {
      return; // nothing to review - let the send proceed untouched
    }

    event.preventDefault();
    event.stopImmediatePropagation();
    closePanel(); // in case a previous panel from an earlier attempt is still open
    onFindings?.(findings);

    const { maskedText, restoreMap } = mask(text, findings);

    activePanel = createInterceptionPanel(ownerDocument, maskedText, {
      onSendMasked(): void {
        closePanel();
        setComposeBoxText(composeBox, maskedText);
        onMasked?.(restoreMap, findings);
        // Waits a couple of animation frames before replaying - see nextAnimationFrame's docs.
        // Only needed here, not in onSendAnyway: that path replays the send with text that was
        // never changed, so there's no editor-internal state to wait for.
        void nextAnimationFrame(ownerDocument).then(() => replay(kind));
      },
      onEdit(): void {
        closePanel(); // no text change - the person edits the original manually and tries again
      },
      onSendAnyway(): void {
        closePanel();
        replay(kind);
      },
    });
    composeBox.insertAdjacentElement("afterend", activePanel.element);
  }

  // Both listeners use the capture phase, not bubble (the default): capture-phase listeners
  // always run before any bubble-phase listener on the same target, regardless of attachment
  // order. That matters here specifically because the content script is injected after the
  // page's own scripts have already run and attached their own send handlers (Manifest V3's
  // default "document_idle" injection timing) - a bubble-phase listener could lose the race and
  // let the site's own handler send the original, un-reviewed text first.
  composeBox.addEventListener(
    "keydown",
    (event) => {
      if (bypassNextEnter) {
        bypassNextEnter = false;
        return;
      }
      const keyboardEvent = event as KeyboardEvent;
      if (keyboardEvent.key === "Enter" && !keyboardEvent.shiftKey) {
        intercept("enter", event);
      }
    },
    { capture: true },
  );

  // Delegated at the document level rather than bound to `sendButton` directly, so a button that
  // doesn't exist yet at attach time (see the constructor's docs) is still caught once it renders
  // and the person clicks it - re-resolved fresh on every click via resolveSendButton(), not
  // captured once. A capture-phase listener on the document still fires before any listener on
  // the button itself (bubble or capture), so this keeps the same "wins the race against the
  // site's own handler" guarantee as attaching directly to a known element would.
  ownerDocument.addEventListener(
    "click",
    (event) => {
      const button = resolveSendButton();
      if (!button || !(event.target instanceof Node) || !button.contains(event.target)) {
        return;
      }
      if (bypassNextClick) {
        bypassNextClick = false;
        return;
      }
      intercept("click", event);
    },
    { capture: true },
  );
}
