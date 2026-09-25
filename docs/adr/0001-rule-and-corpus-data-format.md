# ADR 0001: Rule and corpus data formats, and how the engine loads them

**Status:** Accepted (Phase 1, PRs 3-5)

## Context

CLAUDE.md requires detection rules and the test corpus to be shared, engine-agnostic data in
`/rules` and `/test-corpus`, consumed identically by every language implementation (TypeScript
now, Kotlin and Rust later). We needed to pick concrete file formats, a validation strategy, and
— specific to the TypeScript engine — a way to get that data into the compiled runtime code
without breaking the "detection never touches the network or the filesystem at runtime" shape
the browser extension will eventually need.

## Decisions

- **Corpus format**: JSONL (`/test-corpus/*.jsonl`), one case per line, exactly as specified in
  CLAUDE.md. Grouped one file per category theme (`pii-structured.jsonl`, `pii-misc.jsonl`,
  `secrets.jsonl`, `injection.jsonl`, `content-flags.jsonl`, `vault.jsonl`), plus a `smoke.jsonl`
  reserved for exercising the loader only, not category coverage.
- **Rule format**: plain JSON arrays (`/rules/patterns/*.json`), not JSONL - rule files are
  small, hand-edited, and benefit from a single readable array rather than append-only lines.
  Each rule is `{ category, pattern, flags?, validation?, confidence, placeholderPrefix,
description? }` (see `/rules/README.md`).
- **Validation**: hand-written validators (`validateCorpusCase`, `validatePatternRule`,
  `validateAiDomainEntry` in `packages/engine-ts/src/corpus/schema.ts` and
  `src/rules/schema.ts`), not a schema library (e.g. Zod). They're simple enough that a library
  would add a dependency without saving meaningful code, and hand-written checks can produce
  exact, actionable error messages (file:line, which field, why).
- **Loading split in two, by purpose**:
  - `corpus/loader.ts` and `rules/loader.ts` use `node:fs` and are dev/test/CI tooling only -
    deliberately not exported from the package's main `index.ts`, and never imported by a
    detector.
  - Detectors that need rule data at runtime (`structuredPii.ts`, `piiMisc.ts`, `secrets.ts`,
    `injection.ts`, `contentFlags.ts`) import their rule file directly as a bundled data module
    (`import rulesData from "../../../../rules/patterns/x.json"`), relying on
    `resolveJsonModule` - the same mechanism a bundler (Vite, in Phase 2's extension) uses for a
    JSON asset. This keeps the runtime detection path free of `node:fs`, so it stays valid to
    ship into a browser bundle later, while still reading the single shared source of truth in
    `/rules` rather than a duplicated copy inside `packages/engine-ts`.
  - Each such detector re-validates its rule data at module load time with the same schema
    validator the loader uses, so a malformed rule file fails loudly (throws on import) instead
    of silently disabling a category.

## Consequences

- Adding a category's Tier 1 rule means touching exactly one rule file and one corpus file,
  reviewable together in one PR (see `packages/engine-ts/README.md`).
- The cross-package JSON import (`packages/engine-ts/src/detectors/*.ts` importing
  `../../../../rules/...`) works today because the package only runs through `tsc --noEmit`
  (typecheck) and Vitest/Vite (which both resolve JSON imports natively); there is no `tsc`
  build step yet. If Phase 2 adds one, it must either special-case the package's `rootDir`/
  `outDir` or continue leaning on a bundler rather than raw `tsc` for anything that imports rule
  JSON - flagged here so it isn't a surprise later.
