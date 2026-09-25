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
 * The generic-fallback content script's manifest "matches" list is hand-copied from
 * /rules/ai-domains.json (manifest.json is static JSON, not run through the same TS/bundler
 * pipeline that could import it directly), which is a real drift risk if either list is edited
 * without the other. This test catches that drift instead of trusting the copy stays correct.
 */
describe("generic-fallback content script matches /rules/ai-domains.json", () => {
  const manifest = readJson<{ content_scripts: ContentScriptEntry[] }>("../manifest.json");
  const aiDomains = readJson<{ domain: string }[]>("../../../rules/ai-domains.json");

  const genericFallback = manifest.content_scripts.find((entry) =>
    entry.js.includes("src/content-scripts/generic-fallback.ts"),
  );

  it("has a generic-fallback content script entry", () => {
    expect(genericFallback).toBeDefined();
  });

  it("includes every domain from /rules/ai-domains.json as an https match pattern", () => {
    const matches = new Set(genericFallback!.matches);
    for (const { domain } of aiDomains) {
      expect(matches.has(`https://${domain}/*`)).toBe(true);
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
  });
});
