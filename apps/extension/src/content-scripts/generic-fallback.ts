// Generic-fallback content script (docs/phase-2-plan.md, PRs 3-6): finds the chat-style compose
// box on any matched AI site, runs Tier 1/2 detection against it as the person types, highlights
// findings in place (lib/highlightOverlay.ts), and intercepts sending a message with findings
// still present (lib/sendInterceptor.ts) to offer a masked alternative. Also scans text-like file
// uploads before they reach the site (lib/fileUploadInterceptor.ts). Findings are also written to
// a dataset attribute, same pattern as content-scripts/probe.ts, for tests to read. Per-site
// adapters (PR 8+) take precedence over this on the sites they cover.
import { detect } from "@guardian/engine-ts";
import type { Context } from "@guardian/engine-ts";
import { debounce } from "../lib/debounce.js";
import { attachFileUploadInterceptor } from "../lib/fileUploadInterceptor.js";
import { findComposeBox, readComposeBoxText } from "../lib/findComposeBox.js";
import { findSendButton } from "../lib/findSendButton.js";
import { createHighlightOverlay } from "../lib/highlightOverlay.js";
import { attachSendInterceptor } from "../lib/sendInterceptor.js";

const DEBOUNCE_MS = 300;

const PERSONAL_CONTEXT: Context = {
  appId: "generic-fallback",
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

  // A paste can drop in a whole paragraph at once - worth flagging immediately rather than
  // waiting out the same debounce meant for keystroke-by-keystroke typing. The paste event fires
  // *before* the browser applies it to the element's value/content, so this reads the result on
  // the next tick (setTimeout, not a microtask - the DOM update isn't guaranteed to have
  // happened by the time a microtask runs, only by the next macrotask).
  composeBox.addEventListener("paste", () => {
    setTimeout(() => runDetection(composeBox, overlay), 0);
  });

  // onMasked (the resulting restoreMap) is unused until PR 7 (response restore) needs it.
  attachSendInterceptor({ composeBox, sendButton: findSendButton(composeBox), detectNow });
}

const composeBox = findComposeBox(document);
if (composeBox) {
  attach(composeBox);
}

// File inputs aren't necessarily inside the compose box's own container, so this is attached
// unconditionally rather than gated on a compose box being found.
attachFileUploadInterceptor({ root: document, detect: detectNow });
