import { describe, expect, it } from "vitest";
import { detectBrowser, detectBrowserFromUserAgent, isBraveBrowser } from "./browserDetection.js";

const CHROME_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";
const EDGE_UA = `${CHROME_UA} Edg/128.0.0.0`;

describe("detectBrowserFromUserAgent", () => {
  it("detects Edge via its Edg/ token", () => {
    expect(detectBrowserFromUserAgent(EDGE_UA)).toBe("edge");
  });

  it("doesn't mistake plain Chrome for Edge", () => {
    expect(detectBrowserFromUserAgent(CHROME_UA)).toBe("other");
  });

  it("doesn't mistake legacy EdgeHTML's 'Edge/' token for Chromium Edge's 'Edg/'", () => {
    expect(detectBrowserFromUserAgent(`${CHROME_UA} Edge/18.19041`)).toBe("other");
  });
});

describe("isBraveBrowser", () => {
  it("is true when navigator.brave.isBrave() resolves true", async () => {
    const nav = { userAgent: CHROME_UA, brave: { isBrave: async () => true } };
    expect(await isBraveBrowser(nav)).toBe(true);
  });

  it("is false when there's no navigator.brave at all (Chrome, Edge)", async () => {
    expect(await isBraveBrowser({ userAgent: CHROME_UA })).toBe(false);
  });

  it("is false, not thrown, if navigator.brave.isBrave() rejects", async () => {
    const nav = {
      userAgent: CHROME_UA,
      brave: { isBrave: async () => Promise.reject(new Error("nope")) },
    };
    await expect(isBraveBrowser(nav)).resolves.toBe(false);
  });
});

describe("detectBrowser", () => {
  it("prefers Brave detection over the user agent's own (Chrome-mimicking) string", async () => {
    const nav = { userAgent: CHROME_UA, brave: { isBrave: async () => true } };
    expect(await detectBrowser(nav)).toBe("brave");
  });

  it("falls back to user-agent-based Edge detection when not Brave", async () => {
    expect(await detectBrowser({ userAgent: EDGE_UA })).toBe("edge");
  });

  it("is 'other' for plain Chrome", async () => {
    expect(await detectBrowser({ userAgent: CHROME_UA })).toBe("other");
  });
});
