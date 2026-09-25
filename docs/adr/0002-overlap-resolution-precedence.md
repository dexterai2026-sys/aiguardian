# ADR 0002: Overlap resolution precedence between findings

**Status:** Accepted (Phase 1, PRs 10-11)

## Context

`detect()` runs six independent detectors over the same text; their findings can overlap (e.g. a
Tier 1 `pii.home_address` guess spanning "42 Maple Street" and a Tier 2 vault match for just
"Maple Street"). CLAUDE.md doesn't specify a precedence rule, and `mask()` needs one to decide
what to replace when spans conflict - masking both would either double-replace text or produce a
garbled, overlapping result.

## Decision

`resolveOverlaps()` (`packages/engine-ts/src/overlap.ts`) drops a lower-precedence finding
whenever it overlaps (including full containment) a higher-precedence one. Precedence, in order:

1. **Higher tier wins.** Tier 2 (personal vault) beats Tier 1 (pattern rules) beats a
   hypothetical future Tier 3 (on-device ML). A vault match is checked against a value the
   family explicitly registered, so it's more trusted than a generic pattern guess.
2. **Higher confidence wins**, when tiers are equal.
3. **Whichever appeared first in the input array wins**, as a final, arbitrary but deterministic
   tiebreak (stable sort), so output is reproducible given the same detector run order.

The algorithm is greedy O(n²): sort candidates by precedence, keep a finding only if it doesn't
overlap anything already kept. Both `mask()` and `detect()` use it, so a caller of either entry
point sees the same de-duplicated result.

## Alternatives considered

- **Keep both, let the caller decide**: rejected - CLAUDE.md's interface returns a flat
  `Finding[]`, with no grouping mechanism for "these two conflict," so callers would have no way
  to know two findings needed reconciling.
- **Merge overlapping spans into one finding**: rejected for Phase 1 - deciding which
  category/placeholder should represent a merged span is itself a policy question (e.g. does a
  merged address+name span mask as `[ADDRESS_1]` or `[NAME_1]`?) that tier/confidence precedence
  answers more simply by just picking one finding outright.

## Consequences

- This is a real design decision with no single objectively "correct" answer; it's recorded here
  so a future change (e.g. once Tier 3 exists) is a deliberate revision of this ADR, not an
  accidental behavior change.
- Performance is fine at realistic per-message finding counts (single digits to low tens); this
  would need revisiting only if a caller ever ran `detect()` over something with thousands of
  findings in one call, which isn't a Phase 1 use case.
