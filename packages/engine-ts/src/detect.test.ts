import { describe, expect, it } from "vitest";
import { detect } from "./detect.js";
import type { Context } from "./types.js";

const context: Context = {
  appId: "test-app",
  siteId: "test-site",
  mode: "personal",
  ageProfile: "adult",
};

describe("detect", () => {
  it("is not implemented yet", () => {
    expect(() => detect("hello", context)).toThrow(/not implemented/);
  });
});
