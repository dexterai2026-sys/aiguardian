import type { Context } from "@guardian/engine-ts";
import { getAgeProfile, getMode } from "./familyModeStorage.js";
import { getVaultSessionCache } from "./vaultSessionCache.js";

/**
 * Builds the `Context` family-mode response flagging (lib/familyResponseFlagging.ts, PR 15) needs
 * to run detect() against an AI's reply - or `null` when it shouldn't run at all right now.
 * Shared by every adapter content script rather than duplicated in each, since the logic is
 * identical everywhere: personal mode never runs family-mode detection at all (CLAUDE.md: personal
 * mode reports to no one) - re-checked on every call, never cached here, so a mode switch takes
 * effect on the very next scan.
 *
 * The vault (Tier 2) and the `content.*` categories (Tier 1, self-harm/sexual/violence/secrecy)
 * are deliberately *not* coupled: the vault's session cache having auto-locked, or never having
 * been unlocked this browser session (see lib/vaultSessionCache.ts), means vault matching finds
 * nothing to match against - it must not also silently disable the content-flag categories, which
 * need no vault at all. `vault` falls back to an empty array rather than this function returning
 * `null`, so family mode's baseline protection never depends on whether the vault happens to be
 * unlocked right now.
 */
export async function getFamilyContext(appId: string): Promise<Context | null> {
  const mode = await getMode();
  if (mode !== "family") {
    return null;
  }

  const vault = (await getVaultSessionCache()) ?? [];
  const ageProfile = await getAgeProfile();
  return { appId, siteId: location.hostname, mode: "family", ageProfile, vault };
}
