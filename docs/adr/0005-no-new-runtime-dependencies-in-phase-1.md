# ADR 0005: No new runtime dependencies added during Phase 1's detector work

**Status:** Accepted (Phase 1, PRs 5, 9)

## Context

CLAUDE.md requires asking before adding a dependency. Two points in Phase 1 had an obvious
candidate dependency and needed an explicit decision:

- **Phone numbers** (PR 5): CLAUDE.md's Tier 1 description suggests "libphonenumber or
  equivalent."
- **Fuzzy vault matching** (PR 9): needs an edit-distance implementation.

`@types/node` (PR 3) is the one dependency actually added in this phase, for the corpus/rules
loaders' `node:fs` usage - type-only, dev-only, never shipped to a browser bundle.

## Decisions

- **Phone numbers**: hand-rolled North America-only regex (`/rules/patterns/pii-structured.json`),
  not `libphonenumber-js`. Decided with the project owner: avoids a real dependency shipped into
  every consumer (extension, dashboard) for a Phase 1 scope that doesn't yet need international
  number support. Revisit if/when Guardian supports families outside North America.
- **Fuzzy matching**: hand-rolled Levenshtein distance (`levenshtein.ts`), not a library. Decided
  with the project owner after confirming there's no accuracy tradeoff for a correct
  implementation of this exact algorithm - see ADR 0003.

## Consequences

- `packages/engine-ts`'s only non-dev dependency footprint is zero: the runtime detection code
  (everything reachable from `detect()`/`mask()`/`restore()`) has no third-party dependencies at
  all, which is a clean starting point for the Phase 2 browser extension bundle (smaller bundle,
  no transitive-dependency license/security surface to review).
- Both decisions trade some capability (international phone formats, nickname-style fuzzy
  matching) for that. Each limitation is documented at its source (the rule's `description`
  field, or ADR 0003) rather than only living here, so a future contributor hits the explanation
  where the limitation actually shows up, not just in this ADR.
