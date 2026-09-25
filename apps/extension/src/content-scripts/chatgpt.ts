// ChatGPT adapter content script (docs/phase-2-plan.md, PR 8): same detection/highlighting/send-
// interception/file-upload-scanning behavior as content-scripts/generic-fallback.ts, but backed by
// adapters/chatgpt.ts's selectors (verified against real, saved ChatGPT DOM) instead of the
// generic fallback's site-agnostic heuristics. This is what lets response restore
// (lib/responseRestore.ts, PR 7) be wired in safely here: the adapter's response-container
// selector reliably picks out only the AI's own reply, distinct from ChatGPT's own re-rendering of
// the person's sent message - the ambiguity that kept the generic fallback from doing this at all.
import { detect } from "@guardian/engine-ts";
import type { Context, RestoreMap } from "@guardian/engine-ts";
import { chatgptAdapter, CHATGPT_RESPONSE_CONTAINER_SELECTOR } from "../adapters/chatgpt.js";
import { attachFileUploadInterceptor } from "../lib/fileUploadInterceptor.js";
import { isFixtureTarget } from "../lib/fixtureTarget.js";
import { debounce } from "../lib/debounce.js";
import { readComposeBoxText } from "../lib/findComposeBox.js";
import { createHighlightOverlay } from "../lib/highlightOverlay.js";
import { createProtectionBadge } from "../lib/protectionBadge.js";
import { attachResponseRestore } from "../lib/responseRestore.js";
import { attachSendInterceptor } from "../lib/sendInterceptor.js";

const DEBOUNCE_MS = 300;

const PERSONAL_CONTEXT: Context = {
  appId: "chatgpt",
  siteId: location.hostname,
  mode: "personal",
  ageProfile: "adult",
};

function detectNow(text: string) {
  return detect(text, PERSONAL_CONTEXT);
}

function runDetection(
  composeBox: HTMLElement,
  overlay: ReturnType<typeof createHighlightOverlay>,
): void {
  const text = readComposeBoxText(composeBox);
  const findings = detectNow(text);
  composeBox.dataset.guardianFindings = JSON.stringify(findings);
  overlay.update(findings);
}

function attach(composeBox: HTMLElement): void {
  createProtectionBadge(composeBox);
  const overlay = createHighlightOverlay(composeBox);
  const debouncedRun = debounce(() => runDetection(composeBox, overlay), DEBOUNCE_MS);
  composeBox.addEventListener("input", debouncedRun);

  composeBox.addEventListener("paste", () => {
    setTimeout(() => runDetection(composeBox, overlay), 0);
  });

  // Accumulated across every masked send in this tab's lifetime - see generic-fallback.ts's
  // matching comment for why a later send's placeholder numbering can overwrite an earlier one on
  // collision (a known, documented limitation of mask()'s per-call numbering, not solved here).
  const restoreMap: RestoreMap = new Map();
  attachSendInterceptor({
    composeBox,
    // A getter, not a fixed element: ChatGPT's Send button doesn't exist in the DOM at all until
    // the compose box has content (see adapters/chatgpt.ts), so it can't be resolved once up
    // front the way most sites' send buttons can.
    sendButton: () => chatgptAdapter.findSendButton(composeBox),
    detectNow,
    onMasked(newEntries) {
      for (const [placeholder, value] of newEntries) {
        restoreMap.set(placeholder, value);
      }
    },
  });

  if (chatgptAdapter.capabilities.responseRestore) {
    attachResponseRestore({
      root: document.body,
      composeBox,
      getRestoreMap: () => restoreMap,
      responseContainerSelector: CHATGPT_RESPONSE_CONTAINER_SELECTOR,
    });
  }
}

// In production, this script only ever runs on chatgpt.com/chat.openai.com (per manifest.json),
// where nothing else attaches this same setup. isFixtureTarget is purely a testing convenience for
// the fixtures that share "http://localhost/*" across every content script (see
// lib/fixtureTarget.ts) - real sites never trigger it.
if (isFixtureTarget("chatgpt")) {
  const composeBox = chatgptAdapter.findComposeBox(document);
  if (composeBox) {
    attach(composeBox);
  }

  attachFileUploadInterceptor({ root: document, detect: detectNow });
}
