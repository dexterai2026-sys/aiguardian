// Claude.ai adapter content script (docs/phase-2-plan.md, PR 9): same detection/highlighting/
// send-interception/file-upload-scanning behavior as content-scripts/generic-fallback.ts, but
// backed by adapters/claude.ts's selectors (verified against a real, saved Claude.ai conversation)
// instead of the generic fallback's site-agnostic heuristics. Response restore
// (lib/responseRestore.ts, PR 7) is wired in safely here for the same reason as
// content-scripts/chatgpt.ts: the adapter's response-container selector reliably picks out only
// Claude's own reply, distinct from Claude.ai's own rendering of the person's sent message.
import { detect } from "@guardian/engine-ts";
import type { Context, RestoreMap } from "@guardian/engine-ts";
import { claudeAdapter, CLAUDE_RESPONSE_CONTAINER_SELECTOR } from "../adapters/claude.js";
import { attachFamilyResponseFlagging } from "../lib/familyResponseFlagging.js";
import { getFamilyContext } from "../lib/familyContext.js";
import { attachFileUploadInterceptor } from "../lib/fileUploadInterceptor.js";
import { isFixtureTarget } from "../lib/fixtureTarget.js";
import { watchComposeBox } from "../lib/watchComposeBox.js";
import { debounce } from "../lib/debounce.js";
import { findComposeBoxWithFallback, readComposeBoxText } from "../lib/findComposeBox.js";
import { createHighlightOverlay } from "../lib/highlightOverlay.js";
import { createProtectionBadge } from "../lib/protectionBadge.js";
import { attachResponseRestore } from "../lib/responseRestore.js";
import { attachSendInterceptor } from "../lib/sendInterceptor.js";
import { recordFindingsShown, recordMasked } from "../lib/usageStats.js";

const DEBOUNCE_MS = 300;

const PERSONAL_CONTEXT: Context = {
  appId: "claude",
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
    // A getter for consistency with content-scripts/chatgpt.ts, even though Claude.ai's send
    // button - unlike ChatGPT's - is verified to stay present in the DOM at all times (see
    // adapters/claude.ts): re-resolving costs nothing and stays correct if that ever changes.
    sendButton: () => claudeAdapter.findSendButton(composeBox),
    detectNow,
    onFindings: (findings) => void recordFindingsShown(location.hostname, findings),
    onMasked(newEntries, findings) {
      for (const [placeholder, value] of newEntries) {
        restoreMap.set(placeholder, value);
      }
      void recordMasked(location.hostname, findings);
    },
  });

  if (claudeAdapter.capabilities.responseRestore) {
    attachResponseRestore({
      root: document.body,
      composeBox,
      getRestoreMap: () => restoreMap,
      responseContainerSelector: CLAUDE_RESPONSE_CONTAINER_SELECTOR,
    });
  }

  // Family-mode response flagging (PR 15): safe here for the same reason response restore is -
  // the adapter's response-container selector reliably isolates Claude's own reply. getContext()
  // resolves to null (no-op) outside family mode or while the vault session cache is locked.
  attachFamilyResponseFlagging({
    root: document.body,
    responseContainerSelector: CLAUDE_RESPONSE_CONTAINER_SELECTOR,
    getContext: () => getFamilyContext("claude"),
  });
}

// In production, this script only ever runs on claude.ai (per manifest.json), where nothing else
// attaches this same setup. isFixtureTarget is purely a testing convenience for the fixtures that
// share "http://localhost/*" across every content script (see lib/fixtureTarget.ts) - real sites
// never trigger it.
if (isFixtureTarget("claude")) {
  // watchComposeBox, not a one-time find-and-attach: Claude.ai is a single-page app, and starting
  // a new conversation (or navigating between chats) can replace the compose box's own DOM node
  // without a full page load - see lib/watchComposeBox.ts's file docs. findComposeBoxWithFallback
  // falls back to the generic largest-text-input heuristic if Claude.ai ever changes its markup
  // enough that the adapter's own selector stops matching, rather than finding nothing at all.
  watchComposeBox(
    () => findComposeBoxWithFallback(() => claudeAdapter.findComposeBox(document)),
    attach,
  );

  attachFileUploadInterceptor({
    root: document,
    detect: detectNow,
    onFindings: (findings) => void recordFindingsShown(location.hostname, findings),
  });
}
