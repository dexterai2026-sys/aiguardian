// Generic-fallback content script (docs/phase-2-plan.md, PRs 3-5): finds the chat-style compose
// box on any matched AI site, runs Tier 1/2 detection against it as the person types, highlights
// findings in place (lib/highlightOverlay.ts), and intercepts sending a message with findings
// still present (lib/sendInterceptor.ts) to offer a masked alternative. Findings are also
// written to a dataset attribute, same pattern as content-scripts/probe.ts, for tests to read.
// Per-site adapters (PR 8+) take precedence over this on the sites they cover.
import { detect } from "@guardian/engine-ts";
import type { Context } from "@guardian/engine-ts";
import { debounce } from "../lib/debounce.js";
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

  // onMasked (the resulting restoreMap) is unused until PR 7 (response restore) needs it.
  attachSendInterceptor({ composeBox, sendButton: findSendButton(composeBox), detectNow });
}

const composeBox = findComposeBox(document);
if (composeBox) {
  attach(composeBox);
}
