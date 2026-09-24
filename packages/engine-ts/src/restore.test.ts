import { describe, expect, it } from "vitest";
import { restore } from "./restore.js";

describe("restore", () => {
  it("is not implemented yet", () => {
    expect(() => restore("hello", new Map())).toThrow(/not implemented/);
  });
});
