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
import { attachFamilyResponseFlagging } from "../lib/familyResponseFlagging.js";
import { getFamilyContext } from "../lib/familyContext.js";
import { attachFileUploadInterceptor } from "../lib/fileUploadInterceptor.js";
import { isFixtureTarget } from "../lib/fixtureTarget.js";
import { watchComposeBox } from "../lib/watchComposeBox.js";
import { debounce } from "../lib/debounce.js";
import { findComposeBoxWithFallback, readComposeBoxText } from "../lib/findComposeBox.js";
import { createHighlightOverlay } from "../lib/highlightOverlay.js";
import { createLiveVault } from "../lib/liveVault.js";
import { createProtectionBadge } from "../lib/protectionBadge.js";
import { attachResponseRestore } from "../lib/responseRestore.js";
import { attachSendInterceptor } from "../lib/sendInterceptor.js";
import { recordFindingsShown, recordMasked } from "../lib/usageStats.js";

const DEBOUNCE_MS = 300;

// Vault matching (Tier 2) protects outgoing text in both personal and family mode - see
// lib/liveVault.ts's docs for why this reads a background-refreshed snapshot rather than awaiting
// storage on every keystroke. `mode` stays "personal" here deliberately: the family-only
// content.* categories are about flagging the AI's own reply (lib/familyResponseFlagging.ts), not
// the person's own outgoing text, so this doesn't change by mode.
const getLiveVault = createLiveVault();

function detectNow(text: string) {
  const context: Context = {
    appId: "gemini",
    siteId: location.hostname,
    mode: "personal",
    ageProfile: "adult",
    vault: getLiveVault(),
  };
  return detect(text, context);
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
    // A getter, not a fixed element, for the same reason as content-scripts/chatgpt.ts and
    // content-scripts/claude.ts: cheap to re-resolve, and doesn't assume the button's mount
    // behavior beyond what the saved snapshot actually verified.
    sendButton: () => geminiAdapter.findSendButton(composeBox),
    detectNow,
    onFindings: (findings) => void recordFindingsShown(location.hostname, findings),
    onMasked(newEntries, findings) {
      for (const [placeholder, value] of newEntries) {
        restoreMap.set(placeholder, value);
      }
      void recordMasked(location.hostname, findings);
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

  // Family-mode response flagging (PR 15): safe here for the same reason response restore is -
  // the adapter's response-container selector reliably isolates Gemini's own reply. getContext()
  // resolves to null (no-op) outside family mode or while the vault session cache is locked.
  attachFamilyResponseFlagging({
    root: document.body,
    responseContainerSelector: GEMINI_RESPONSE_CONTAINER_SELECTOR,
    getContext: () => getFamilyContext("gemini"),
  });
}

// In production, this script only ever runs on gemini.google.com (per manifest.json), where
// nothing else attaches this same setup. isFixtureTarget is purely a testing convenience for the
// fixtures that share "http://localhost/*" across every content script (see lib/fixtureTarget.ts)
// - real sites never trigger it.
if (isFixtureTarget("gemini")) {
  // watchComposeBox, not a one-time find-and-attach: Gemini is a single-page app, and starting a
  // new conversation (or navigating between chats) can replace the compose box's own DOM node
  // without a full page load - see lib/watchComposeBox.ts's file docs. findComposeBoxWithFallback
  // falls back to the generic largest-text-input heuristic if Gemini ever changes its markup
  // enough that the adapter's own selector stops matching, rather than finding nothing at all.
  watchComposeBox(
    () => findComposeBoxWithFallback(() => geminiAdapter.findComposeBox(document)),
    attach,
  );

  attachFileUploadInterceptor({
    root: document,
    detect: detectNow,
    onFindings: (findings) => void recordFindingsShown(location.hostname, findings),
  });
}
