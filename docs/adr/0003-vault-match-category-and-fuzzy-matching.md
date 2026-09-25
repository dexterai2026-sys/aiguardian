# ADR 0003: Vault match category/placeholder split, and fuzzy-matching scope

**Status:** Accepted (Phase 1, PR 9)

## Context

Tier 2 (personal vault) matches a family's registered values (child's name, school, street,
etc.) against text. Two open questions from `docs/phase-1-plan.md`'s PR 9 needed resolving:
whether `Finding` needed a new field to record which vault category matched, and how "fuzzy"
matching should work.

## Decision 1: `Finding.category` is always `"vault.match"`

Every vault match uses `category: "vault.match"` - the literal category CLAUDE.md's enum defines
for this tier - regardless of the underlying vault entry's own category (e.g. `pii.name`).
`Finding.suggestedPlaceholder` carries the human-readable, per-entry-category label instead (e.g.
`"NAME"`, `"ADDRESS"`, via a lookup table in `vault.ts`), so masking still produces a readable
`[NAME_1]` rather than a generic `[VAULT_1]`.

This means the existing `Finding` shape didn't need extending: the field CLAUDE.md already
specifies for the placeholder label was enough to carry the distinction the alerting/masking
layers need, once the category itself is treated as the literal enum value rather than a proxy
for "what type of thing was this."

A consequence worth naming: `pii.name` and `pii.school` never appear as a `Finding.category` in
this engine - they exist in the category enum only as `VaultEntry.category` labels. Nothing in
Phase 1 detects a name or a school name outside the vault (no regex makes sense for either), so
this is intentional, not a coverage gap - see the Phase 1 close-out notes in `CLAUDE.md`.

## Decision 2: fuzzy matching is typo tolerance, not nickname handling

Fuzzy matching uses a hand-written Levenshtein edit-distance function
(`packages/engine-ts/src/detectors/levenshtein.ts`), not a library - discussed with the project
owner, who confirmed a correct implementation of an exact (non-approximate) algorithm is exactly
as accurate as a library one; vaults are small (tens of entries per family) so performance was
never a concern either way.

The threshold scales with value length (exact-only for values <=3 characters, since short
strings collide with too many unrelated words) and is applied only to single-word values;
multi-word values (e.g. a street address) are exact-substring match only. This catches a
misspelling ("Jonathon" for "Jonathan", edit distance 1) but not a nickname ("Jonny" for
"Jonathan", edit distance 5) - nickname/alias handling would need a separate registered-alias
list, which is out of scope for Phase 1 and not attempted here.

## Consequences

- Any future feature that needs to know _which_ vault category matched (e.g. a more detailed
  parent-facing alert) can read `suggestedPlaceholder` or, if that proves insufficient, this ADR
  is the place to record extending `Finding` - not a silent workaround elsewhere.
- Nickname handling, if wanted later, is a new feature (an alias list per vault entry), not a
  fuzzy-matching tuning change.
