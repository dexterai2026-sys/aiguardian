/**
 * Purely a testing convenience. Every fixture-based e2e test (per CLAUDE.md's adapter-testing
 * requirement) shares the same "http://localhost/*" match pattern across every content script
 * (see e2e/localServer.ts's docs), since a fixture server always binds an ephemeral port under
 * localhost. Without this, two content scripts (e.g. the generic fallback and an adapter) would
 * both fully attach - highlight overlay, send interception, file-upload interception - to the
 * same fixture page and conflict with each other (duplicate listeners double-handling the same
 * event). A fixture page opts into exactly one content script's behavior by setting this
 * attribute on `<html>` to that script's id. Every fixture that any content script's full setup
 * should run against sets it - a page with no attribute at all is treated as belonging to every
 * script (matches unconditionally), which is only safe for a fixture that predates this
 * convention and happens not to trigger any other script's unconditional setup (e.g. an empty
 * page with nothing resembling a compose box or file input).
 *
 * Real AI sites never set this attribute, so it has zero effect there - manifest.json's own
 * site-specific "matches" lists are what actually keep content scripts from double-covering a
 * real site in production.
 */
export function isFixtureTarget(id: string): boolean {
  const target = document.documentElement.dataset.guardianFixtureTarget;
  return target === undefined || target === id;
}
