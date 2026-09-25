import { describe, expect, it } from "vitest";
import type { AiSiteGroup } from "./aiSiteGroups.js";
import { buildBlockRulesForDomains, domainsForBlockedSites } from "./blockRules.js";

describe("buildBlockRulesForDomains", () => {
  it("builds one block rule per domain, targeting only top-level navigation", () => {
    const rules = buildBlockRulesForDomains(["chatgpt.com", "chat.openai.com"]);
    expect(rules).toHaveLength(2);
    for (const rule of rules) {
      expect(rule.action.type).toBe("block");
      expect(rule.condition.resourceTypes).toEqual(["main_frame"]);
    }
    expect(rules[0]!.condition.urlFilter).toBe("||chatgpt.com^");
    expect(rules[1]!.condition.urlFilter).toBe("||chat.openai.com^");
  });

  it("gives every rule a distinct, positive integer id", () => {
    const rules = buildBlockRulesForDomains([
      "chatgpt.com",
      "chat.openai.com",
      "claude.ai",
      "gemini.google.com",
    ]);
    const ids = rules.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(Number.isInteger(id)).toBe(true);
      expect(id).toBeGreaterThan(0);
    }
  });

  it("returns the same id for the same domain across calls (stable, not reassigned)", () => {
    const first = buildBlockRulesForDomains(["chatgpt.com"])[0]!.id;
    const second = buildBlockRulesForDomains(["claude.ai", "chatgpt.com"])[1]!.id;
    expect(first).toBe(second);
  });

  it("returns an empty array for an empty domain list", () => {
    expect(buildBlockRulesForDomains([])).toEqual([]);
  });
});

describe("domainsForBlockedSites", () => {
  const groups: AiSiteGroup[] = [
    { name: "ChatGPT", domains: ["chat.openai.com", "chatgpt.com"] },
    { name: "Claude", domains: ["claude.ai"] },
    { name: "Character.AI", domains: ["character.ai", "beta.character.ai"] },
  ];

  it("expands a blocked site name to every domain in its group", () => {
    expect(domainsForBlockedSites(["ChatGPT"], groups).sort()).toEqual([
      "chat.openai.com",
      "chatgpt.com",
    ]);
  });

  it("expands multiple blocked sites", () => {
    expect(domainsForBlockedSites(["ChatGPT", "Claude"], groups).sort()).toEqual([
      "chat.openai.com",
      "chatgpt.com",
      "claude.ai",
    ]);
  });

  it("ignores an unknown site name rather than throwing", () => {
    expect(domainsForBlockedSites(["NotARealSite"], groups)).toEqual([]);
  });

  it("returns no domains when nothing is blocked", () => {
    expect(domainsForBlockedSites([], groups)).toEqual([]);
  });
});
