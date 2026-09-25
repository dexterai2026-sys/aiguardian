// Gemini adapter content script (docs/phase-2-plan.md, PR 9): same detection/highlighting/send-
// interception/file-upload-scanning behavior as content-scripts/generic-fallback.ts, but backed by
// adapters/gemini.ts's selectors (verified against a real, saved Gemini conversation) instead of
// the generic fallback's site-agnostic heuristics. Response restore (lib/responseRestore.ts, PR 7)
// is wired in safely here for the same reason as content-scripts/chatgpt.ts and
// content-scripts/claude.ts: the adapter's response-container selector reliably picks out only
// Gemini's own reply, distinct from Gemini's own rendering of the person's sent message.
import { detect } from "@guardian/engine-ts";
import type { Context, RestoreMap } from "@guardian/engine-ts";
import { geminiAdapter, GEMINI_RESPONSE_CONTAINER_SELECTOR } from "../adapters/gemini.js";
import { attachFileUploadInterceptor } from "../lib/fileUploadInterceptor.js";
import { isFixtureTarget } from "../lib/fixtureTarget.js";
import { debounce } from "../lib/debounce.js";
import { readComposeBoxText } from "../lib/findComposeBox.js";
import { createHighlightOverlay } from "../lib/highlightOverlay.js";
import { attachResponseRestore } from "../lib/responseRestore.js";
import { attachSendInterceptor } from "../lib/sendInterceptor.js";

const DEBOUNCE_MS = 300;

const PERSONAL_CONTEXT: Context = {
  appId: "gemini",
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
    // A getter, not a fixed element, for the same reason as content-scripts/chatgpt.ts and
    // content-scripts/claude.ts: cheap to re-resolve, and doesn't assume the button's mount
    // behavior beyond what the saved snapshot actually verified.
    sendButton: () => geminiAdapter.findSendButton(composeBox),
    detectNow,
    onMasked(newEntries) {
      for (const [placeholder, value] of newEntries) {
        restoreMap.set(placeholder, value);
      }
    },
  });

  if (geminiAdapter.capabilities.responseRestore) {
    attachResponseRestore({
      root: document.body,
      composeBox,
      getRestoreMap: () => restoreMap,
      responseContainerSelector: GEMINI_RESPONSE_CONTAINER_SELECTOR,
    });
  }
}

// In production, this script only ever runs on gemini.google.com (per manifest.json), where
// nothing else attaches this same setup. isFixtureTarget is purely a testing convenience for the
// fixtures that share "http://localhost/*" across every content script (see lib/fixtureTarget.ts)
// - real sites never trigger it.
if (isFixtureTarget("gemini")) {
  const composeBox = geminiAdapter.findComposeBox(document);
  if (composeBox) {
    attach(composeBox);
  }

  attachFileUploadInterceptor({ root: document, detect: detectNow });
}
