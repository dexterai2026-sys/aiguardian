import { mask } from "@guardian/engine-ts";
import type { Finding, RestoreMap } from "@guardian/engine-ts";
import { readComposeBoxText } from "./findComposeBox.js";
import { createInterceptionPanel } from "./interceptionPanel.js";

export interface SendInterceptorOptions {
  composeBox: HTMLElement;
  sendButton: HTMLElement | null;
  /** Runs detection fresh at interception time - never relies on stale/debounced findings. */
  detectNow: (text: string) => Finding[];
  /** Called after "Send masked" replaces the compose box's text, so a caller (PR 7: response
   * restore) can keep the resulting map for this tab/conversation. Never persisted here or by
   * any caller - CLAUDE.md requires restoreMap live in memory only. */
  onMasked?: (restoreMap: RestoreMap) => void;
}

function setComposeBoxText(composeBox: HTMLElement, text: string): void {
  if (composeBox instanceof HTMLTextAreaElement) {
    composeBox.value = text;
  } else {
    composeBox.textContent = text;
  }
  // Sites commonly listen for "input" to sync their own state (React/Vue controlled inputs,
  // send-button enabled/disabled state, etc.) - setting .value/.textContent directly doesn't
  // fire it on its own.
  composeBox.dispatchEvent(new Event("input", { bubbles: true }));
}

/**
 * Wires up send interception on a compose box: pressing Enter (without Shift) or clicking its
 * send button, when there are findings, shows a review panel instead of letting the send
 * through. Never blocks sending outright - "Send anyway" always works - per CLAUDE.md's
 * "protect and teach, don't restrict" approach.
 */
export function attachSendInterceptor(options: SendInterceptorOptions): void {
  const { composeBox, sendButton, detectNow, onMasked } = options;
  const ownerDocument = composeBox.ownerDocument;

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
    } else if (sendButton) {
      bypassNextClick = true;
      sendButton.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
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

    const { maskedText, restoreMap } = mask(text, findings);

    activePanel = createInterceptionPanel(ownerDocument, maskedText, {
      onSendMasked(): void {
        closePanel();
        setComposeBoxText(composeBox, maskedText);
        onMasked?.(restoreMap);
        replay(kind);
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

  sendButton?.addEventListener(
    "click",
    (event) => {
      if (bypassNextClick) {
        bypassNextClick = false;
        return;
      }
      intercept("click", event);
    },
    { capture: true },
  );
}
