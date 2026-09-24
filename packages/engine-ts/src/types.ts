/**
 * Shared types for the detection engine, mirroring the conceptual interface in CLAUDE.md
 * ("Detection engine" section). Every language implementation (TypeScript, later Kotlin and
 * Rust) must agree on these shapes, since they are validated against the same `/rules` data
 * and `/test-corpus` fixtures.
 */

/**
 * The initial category enum from CLAUDE.md. Categories may only be added by updating this
 * list, the shared rules in /rules, the shared corpus in /test-corpus, and (from Phase 3
 * onward) the backend enum, all together.
 */
export type Category =
  | "pii.name"
  | "pii.home_address"
  | "pii.school"
  | "pii.phone"
  | "pii.email"
  | "pii.ssn"
  | "pii.payment_card"
  | "pii.bank_account"
  | "pii.dob"
  | "pii.medical"
  | "pii.government_id"
  | "secret.api_key"
  | "secret.password"
  | "vault.match"
  | "injection.hidden_text"
  | "injection.instruction_pattern"
  | "content.self_harm"
  | "content.sexual"
  | "content.secrecy_from_parents"
  | "content.violence";

/**
 * Detection tier that produced a finding. Tier 3 (on-device ML) is out of scope for Phase 1
 * but is part of the type now so `Finding.tier` doesn't need to change shape when it lands.
 */
export type Tier = 1 | 2 | 3;

export type Mode = "personal" | "family";

/**
 * Ambient age band for the person using the device. CLAUDE.md's target users are children
 * roughly 9-17 and adults; this assumes a coarse three-band split is enough for Phase 1
 * detectors (e.g. gating family content-flag categories) rather than a specific age number.
 * This is an assumption, not a decision recorded elsewhere — revisit if a detector needs finer
 * granularity.
 */
export type AgeProfile = "child" | "teen" | "adult";

/**
 * A single registered value in the personal vault (Tier 2), e.g. a child's name, school, or
 * street. The full vault shape (fuzzy-match tuning, multiple values per category, etc.) is
 * finalized in Phase 1 PR 9; this minimal shape only exists so `Context` can be typed now.
 */
export interface VaultEntry {
  id: string;
  category: Category;
  value: string;
}

export interface Context {
  appId: string;
  siteId: string;
  mode: Mode;
  ageProfile: AgeProfile;
  /** Registered personal values for Tier 2 matching. Empty/omitted disables Tier 2. */
  vault?: VaultEntry[];
}

export interface Finding {
  category: Category;
  /** Start offset (inclusive) into the detected text, in UTF-16 code units. */
  start: number;
  /** End offset (exclusive) into the detected text, in UTF-16 code units. */
  end: number;
  /** Detector confidence in [0, 1]. */
  confidence: number;
  tier: Tier;
  /** Placeholder label without numbering, e.g. "NAME", "ADDRESS" — mask() adds the "[..._N]" numbering. */
  suggestedPlaceholder: string;
}

/**
 * Maps a numbered placeholder (e.g. "[NAME_1]") back to the original text it replaced.
 * Lives in memory only for the current conversation — CLAUDE.md requires this never be
 * persisted or transmitted, so no (de)serialization helpers are provided for it.
 */
export type RestoreMap = Map<string, string>;

export interface MaskResult {
  maskedText: string;
  restoreMap: RestoreMap;
}
