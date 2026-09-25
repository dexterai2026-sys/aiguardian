import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

interface ContentScriptEntry {
  matches: string[];
  js: string[];
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf-8")) as T;
}

/**
 * Every domain in /rules/ai-domains.json must be covered by exactly one content script: either a
 * dedicated adapter (PR 8+ - takes precedence per CLAUDE.md, since it uses selectors verified
 * against that site's real DOM instead of the generic fallback's heuristics) or, for every site
 * without one yet, the generic fallback. manifest.json is static JSON (not run through the same
 * TS/bundler pipeline that could import ai-domains.json directly), so its "matches" lists are
 * hand-copied - a real drift risk this test catches instead of trusting the copy stays correct.
 *
 * Add a new entry to ADAPTER_CONTENT_SCRIPTS here whenever a new adapter's content script is added
 * (PR 9+), and remove its domain(s) from the generic fallback's own matches at the same time.
 */
const ADAPTER_CONTENT_SCRIPTS = ["src/content-scripts/chatgpt.ts"];

describe("every AI domain is covered by exactly one content script", () => {
  const manifest = readJson<{ content_scripts: ContentScriptEntry[] }>("../manifest.json");
  const aiDomains = readJson<{ domain: string }[]>("../../../rules/ai-domains.json");

  const genericFallback = manifest.content_scripts.find((entry) =>
    entry.js.includes("src/content-scripts/generic-fallback.ts"),
  );
  const adapterEntries = manifest.content_scripts.filter((entry) =>
    entry.js.some((js) => ADAPTER_CONTENT_SCRIPTS.includes(js)),
  );
  const adapterMatches = new Set(adapterEntries.flatMap((entry) => entry.matches));

  it("has a generic-fallback content script entry", () => {
    expect(genericFallback).toBeDefined();
  });

  it("has a content script entry for every known adapter", () => {
    expect(adapterEntries).toHaveLength(ADAPTER_CONTENT_SCRIPTS.length);
  });

  it("covers every domain from /rules/ai-domains.json with exactly one of (an adapter, the generic fallback)", () => {
    const genericMatches = new Set(genericFallback!.matches);
    for (const { domain } of aiDomains) {
      const pattern = `https://${domain}/*`;
      const inAdapter = adapterMatches.has(pattern);
      const inGeneric = genericMatches.has(pattern);
      expect(inAdapter || inGeneric).toBe(true); // covered by at least one
      expect(inAdapter && inGeneric).toBe(false); // never double-covered
    }
  });

  it("has no extra AI-site matches beyond /rules/ai-domains.json and the localhost test pattern", () => {
    const expected = new Set([
      ...aiDomains.map(({ domain }) => `https://${domain}/*`),
      "http://localhost/*", // for this repo's own fixture-based e2e tests only - see PR 3's notes
    ]);
    for (const pattern of genericFallback!.matches) {
      expect(expected.has(pattern)).toBe(true);
    }
    for (const pattern of adapterMatches) {
      expect(expected.has(pattern)).toBe(true);
    }
  });
});
