import { describe, expect, it } from "vitest";
import { IDLE_TIMEOUT_MS, isSessionCacheExpired } from "./vaultSessionCache.js";

describe("isSessionCacheExpired", () => {
  it("is not expired immediately after use", () => {
    const now = 1_000_000;
    expect(isSessionCacheExpired(now, now)).toBe(false);
  });

  it("is not expired just under the idle timeout", () => {
    const lastUsedAt = 1_000_000;
    const now = lastUsedAt + IDLE_TIMEOUT_MS - 1;
    expect(isSessionCacheExpired(lastUsedAt, now)).toBe(false);
  });

  it("is expired just over the idle timeout", () => {
    const lastUsedAt = 1_000_000;
    const now = lastUsedAt + IDLE_TIMEOUT_MS + 1;
    expect(isSessionCacheExpired(lastUsedAt, now)).toBe(true);
  });

  it("is expired well past the idle timeout", () => {
    const lastUsedAt = 1_000_000;
    const now = lastUsedAt + IDLE_TIMEOUT_MS * 10;
    expect(isSessionCacheExpired(lastUsedAt, now)).toBe(true);
  });
});
