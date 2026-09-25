/**
 * Detects Edge and Brave so the popup can show a one-time notice (PR 12) that Guardian's
 * content-script-based detection never sees text typed into a browser's own built-in AI sidebar
 * (Copilot in Edge, Brave Leo) - those aren't web pages Guardian's content scripts are injected
 * into at all, so there's no way to protect that surface today, and the person should know rather
 * than assume they're covered everywhere.
 *
 * Edge is detectable from the user agent string alone ("Edg/", Microsoft's own token - not to be
 * confused with the legacy "Edge/" token from pre-Chromium EdgeHTML, which this extension doesn't
 * target since Manifest V3 requires the Chromium-based rewrite). Brave deliberately keeps its user
 * agent identical to Chrome's for site-compatibility, so it can only be detected via its own
 * runtime API (`navigator.brave.isBrave()`) - a separate, async check.
 */
export type BrowserKind = "edge" | "brave" | "other";

export function detectBrowserFromUserAgent(userAgent: string): "edge" | "other" {
  return /\bEdg\//.test(userAgent) ? "edge" : "other";
}

/** `nav` is injectable (rather than always reading the global `navigator`) so this is testable
 * with a fake object, since jsdom's real `navigator` never has a `.brave` property. */
export async function isBraveBrowser(
  nav: Pick<Navigator, "userAgent"> & { brave?: { isBrave?: () => Promise<boolean> } },
): Promise<boolean> {
  if (typeof nav.brave?.isBrave !== "function") {
    return false;
  }
  try {
    return await nav.brave.isBrave();
  } catch {
    return false; // an unexpected rejection is not evidence either way - default to "not Brave"
  }
}

export async function detectBrowser(
  nav: Pick<Navigator, "userAgent"> & { brave?: { isBrave?: () => Promise<boolean> } },
): Promise<BrowserKind> {
  if (await isBraveBrowser(nav)) {
    return "brave";
  }
  return detectBrowserFromUserAgent(nav.userAgent) === "edge" ? "edge" : "other";
}
