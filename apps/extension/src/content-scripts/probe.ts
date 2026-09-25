// Proof-of-integration content script for Phase 2 PR 2: exists only to confirm the Vite build
// correctly bundles @guardian/engine-ts (including its cross-package rule JSON imports - see
// docs/adr/0001-rule-and-corpus-data-format.md's flagged risk) into a real content-script
// context, before any actual detection feature is built on top of it (PR 3+).
//
// Content scripts run in an "isolated world": a separate JS scope from the page's own scripts,
// even though they share the same DOM. A test driving this from the page's main world (e.g.
// Playwright's page.evaluate()) can't see a JS global this script sets, only DOM changes - hence
// writing the result to a dataset attribute rather than, say, `window.__result = ...`.
import { detect } from "@guardian/engine-ts";

const SAMPLE_TEXT = "contact jane@example.com please";

const findings = detect(SAMPLE_TEXT, {
  appId: "probe",
  siteId: "probe",
  mode: "personal",
  ageProfile: "adult",
});

document.body.dataset.guardianProbeResult = JSON.stringify(findings);
