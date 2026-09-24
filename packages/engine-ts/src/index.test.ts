import { describe, expect, it } from "vitest";
import * as engine from "./index.js";

describe("package entry point", () => {
  it("exports detect, mask, and restore", () => {
    expect(typeof engine.detect).toBe("function");
    expect(typeof engine.mask).toBe("function");
    expect(typeof engine.restore).toBe("function");
  });
});
