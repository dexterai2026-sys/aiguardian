import { describe, expect, it } from "vitest";
import { getAiSiteGroups } from "./aiSiteGroups.js";

describe("getAiSiteGroups", () => {
  const groups = getAiSiteGroups();

  it("groups ChatGPT's two domains under one entry", () => {
    const chatgpt = groups.find((g) => g.name === "ChatGPT");
    expect(chatgpt).toBeDefined();
    expect(chatgpt!.domains.sort()).toEqual(["chat.openai.com", "chatgpt.com"]);
  });

  it("groups Character.AI's two domains under one entry", () => {
    const characterAi = groups.find((g) => g.name === "Character.AI");
    expect(characterAi).toBeDefined();
    expect(characterAi!.domains.sort()).toEqual(["beta.character.ai", "character.ai"]);
  });

  it("keeps a single-domain site as its own one-domain group", () => {
    const claude = groups.find((g) => g.name === "Claude");
    expect(claude).toBeDefined();
    expect(claude!.domains).toEqual(["claude.ai"]);
  });

  it("produces exactly one group per distinct site name", () => {
    const names = groups.map((g) => g.name);
    expect(new Set(names).size).toBe(names.length);
  });
});
