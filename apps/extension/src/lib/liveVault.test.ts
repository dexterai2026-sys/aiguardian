import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createLiveVault } from "./liveVault.js";
import * as vaultSessionCache from "./vaultSessionCache.js";

describe("createLiveVault", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("starts empty before the first background refresh resolves", () => {
    vi.spyOn(vaultSessionCache, "getVaultSessionCache").mockResolvedValue([
      { id: "1", category: "pii.home_address", value: "Maple Street" },
    ]);
    const getVault = createLiveVault();

    expect(getVault()).toEqual([]);
  });

  it("picks up the vault once the background refresh resolves", async () => {
    const entries = [{ id: "1", category: "pii.home_address" as const, value: "Maple Street" }];
    vi.spyOn(vaultSessionCache, "getVaultSessionCache").mockResolvedValue(entries);
    const getVault = createLiveVault();

    getVault(); // triggers the first refresh
    await vi.runOnlyPendingTimersAsync();

    expect(getVault()).toEqual(entries);
  });

  it("does not call getVaultSessionCache again before the throttle interval elapses", async () => {
    const spy = vi
      .spyOn(vaultSessionCache, "getVaultSessionCache")
      .mockResolvedValue([{ id: "1", category: "pii.home_address", value: "Maple Street" }]);
    const getVault = createLiveVault();

    getVault();
    await vi.runOnlyPendingTimersAsync();
    getVault();
    getVault();

    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("refreshes again once the throttle interval has elapsed", async () => {
    const spy = vi
      .spyOn(vaultSessionCache, "getVaultSessionCache")
      .mockResolvedValue([{ id: "1", category: "pii.home_address", value: "Maple Street" }]);
    const getVault = createLiveVault();

    getVault();
    await vi.runOnlyPendingTimersAsync();
    vi.advanceTimersByTime(5001);
    getVault();
    await vi.runOnlyPendingTimersAsync();

    expect(spy).toHaveBeenCalledTimes(2);
  });

  it("never refreshes at all if the caller never calls the getter", () => {
    const spy = vi.spyOn(vaultSessionCache, "getVaultSessionCache").mockResolvedValue([]);
    createLiveVault();

    expect(spy).not.toHaveBeenCalled();
  });
});
