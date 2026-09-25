// Generic-fallback content script (docs/phase-2-plan.md, PRs 3-6, partial 7): finds the
// chat-style compose box on any matched AI site, runs Tier 1/2 detection against it as the person
// types, highlights findings in place (lib/highlightOverlay.ts), and intercepts sending a message
// with findings still present (lib/sendInterceptor.ts) to offer a masked alternative. Also scans
// text-like file uploads before they reach the site (lib/fileUploadInterceptor.ts). Findings are
// also written to a dataset attribute, same pattern as content-scripts/probe.ts, for tests to
// read. Per-site adapters (PR 8+) take precedence over this on the sites they cover.
//
// lib/responseRestore.ts (PR 7) is deliberately NOT wired in here: it needs a root scoped to just
// the AI's own response container to be safe, and the generic fallback has no reliable way to
// identify one - a real chat site typically re-renders the person's own just-sent message as a
// bubble too, and without adapter knowledge of the DOM this script cannot tell that bubble apart
// from the AI's reply. Restoring inside the person's own "sent" bubble would be a real bug, not a
// convenience: it would visibly undo the masking they just chose, on their own screen, which is
// exactly the protection "Send masked" is supposed to provide against anyone looking at that
// screen. Per-site adapters (PR 8+), which know their site's real response-container selector,
// are the first safe callers of attachResponseRestore.
import { detect } from "@guardian/engine-ts";
import type { Context } from "@guardian/engine-ts";
import { debounce } from "../lib/debounce.js";
import { attachFileUploadInterceptor } from "../lib/fileUploadInterceptor.js";
import { isFixtureTarget } from "../lib/fixtureTarget.js";
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

  // onMasked (the resulting restoreMap) is unused here - see the file-level comment on
  // lib/responseRestore.ts above for why the generic fallback doesn't consume it yet.
  attachSendInterceptor({ composeBox, sendButton: findSendButton(composeBox), detectNow });
}

// In production, an adapter-covered site (e.g. chatgpt.com) is simply absent from this script's
// manifest matches, so it never runs there at all - no runtime check needed. isFixtureTarget is
// purely a testing convenience for the fixtures that share "http://localhost/*" across every
// content script (see lib/fixtureTarget.ts) - real sites never trigger it.
if (isFixtureTarget("generic-fallback")) {
  const composeBox = findComposeBox(document);
  if (composeBox) {
    attach(composeBox);
  }

  // File inputs aren't necessarily inside the compose box's own container, so this is attached
  // unconditionally rather than gated on a compose box being found.
  attachFileUploadInterceptor({ root: document, detect: detectNow });
}
