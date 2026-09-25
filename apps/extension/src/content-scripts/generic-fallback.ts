// Generic-fallback content script (docs/phase-2-plan.md, PR 3): finds the chat-style compose box
// on any matched AI site and runs Tier 1/2 detection against it as the person types. No visible
// UI yet - findings are written to a dataset attribute, same pattern as
// content-scripts/probe.ts, for tests to read; real highlighting is PR 4. Per-site adapters
// (PR 8+) take precedence over this on the sites they cover.
import { detect } from "@guardian/engine-ts";
import type { Context } from "@guardian/engine-ts";
import { debounce } from "../lib/debounce.js";
import { findComposeBox, readComposeBoxText } from "../lib/findComposeBox.js";

const DEBOUNCE_MS = 300;

const PERSONAL_CONTEXT: Context = {
  appId: "generic-fallback",
  siteId: location.hostname,
  mode: "personal",
  ageProfile: "adult",
};

function runDetection(composeBox: HTMLElement): void {
  const text = readComposeBoxText(composeBox);
  const findings = detect(text, PERSONAL_CONTEXT);
  composeBox.dataset.guardianFindings = JSON.stringify(findings);
}

function attach(composeBox: HTMLElement): void {
  const debouncedRun = debounce(() => runDetection(composeBox), DEBOUNCE_MS);
  composeBox.addEventListener("input", debouncedRun);
}

const composeBox = findComposeBox(document);
if (composeBox) {
  attach(composeBox);
}
