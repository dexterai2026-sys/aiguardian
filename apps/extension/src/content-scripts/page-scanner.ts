// Hidden-injection page scanner (docs/phase-2-plan.md, PR 11): runs on every page the person
// visits (manifest.json's "https://*/*"/"http://*/*" match, an explicit permissions-footprint
// decision the owner made for PR 11, not a default) - distinct from every other content script in
// this extension, which only run on the AI sites themselves. Watches for the "copy" event and, if
// the just-copied selection includes text that's present in the DOM but not actually visible (see
// lib/hiddenTextScanner.ts), shows a visible warning. Never blocks or alters the clipboard - only
// informs, per CLAUDE.md's "protect and teach, don't restrict" approach and PR 11's own scope
// ("surface a warning... without silently stripping anything - the person decides").
import { findHiddenTextInSelection } from "../lib/hiddenTextScanner.js";
import { createHiddenTextWarningPanel } from "../lib/interceptionPanel.js";
import { isFixtureTarget } from "../lib/fixtureTarget.js";

let activePanel: ReturnType<typeof createHiddenTextWarningPanel> | null = null;

function handleCopy(): void {
  // Read on the next tick: at the moment "copy" fires, `window.getSelection()` already reflects
  // what's being copied (unlike a "paste" event, nothing here waits on browser-applied content),
  // but yielding first avoids ever doing this work inside the same synchronous pass as the site's
  // own copy handler, keeping this purely observational.
  setTimeout(() => {
    const hiddenText = findHiddenTextInSelection(document.getSelection());
    if (hiddenText.length === 0) {
      return;
    }

    activePanel?.remove();
    activePanel = createHiddenTextWarningPanel(document, hiddenText.join("\n\n"), {
      onDismiss(): void {
        activePanel?.remove();
        activePanel = null;
      },
    });
    document.body.insertBefore(activePanel.element, document.body.firstChild);
  }, 0);
}

if (isFixtureTarget("page-scanner")) {
  document.addEventListener("copy", handleCopy);
}
