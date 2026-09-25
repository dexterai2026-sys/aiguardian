import type { AgeProfile, Mode } from "@guardian/engine-ts";

/**
 * Thin wrapper over chrome.storage.local for the mode toggle and age profile (PR 14).
 * chrome.storage.local, not .sync: avoids any cross-device data movement before Phase 3's real
 * backend sync exists (docs/phase-2-plan.md's PR 14 notes, and the same reasoning
 * lib/siteSettingsStorage.ts already applies to the site allow/block list). Deliberately not
 * unit-tested directly - thin real-API wiring, exercised by the extension's own e2e tests.
 */
const MODE_KEY = "guardianMode";
const AGE_PROFILE_KEY = "guardianAgeProfile";

const DEFAULT_MODE: Mode = "personal";
const DEFAULT_AGE_PROFILE: AgeProfile = "adult";

export async function getMode(): Promise<Mode> {
  const result = await chrome.storage.local.get(MODE_KEY);
  return result[MODE_KEY] === "family" ? "family" : DEFAULT_MODE;
}

export async function setMode(mode: Mode): Promise<void> {
  await chrome.storage.local.set({ [MODE_KEY]: mode });
}

const VALID_AGE_PROFILES: readonly AgeProfile[] = ["child", "teen", "adult"];

export async function getAgeProfile(): Promise<AgeProfile> {
  const result = await chrome.storage.local.get(AGE_PROFILE_KEY);
  const value: unknown = result[AGE_PROFILE_KEY];
  return typeof value === "string" && (VALID_AGE_PROFILES as string[]).includes(value)
    ? (value as AgeProfile)
    : DEFAULT_AGE_PROFILE;
}

export async function setAgeProfile(ageProfile: AgeProfile): Promise<void> {
  await chrome.storage.local.set({ [AGE_PROFILE_KEY]: ageProfile });
}
