# @guardian/engine-ts

The shared TypeScript detection engine: Tiers 1 (pattern rules) and 2 (personal vault) of
CLAUDE.md's detection engine. Consumed by the browser extension and parent dashboard (Phase 2+).

## Public API

```ts
import { detect, mask, restore } from "@guardian/engine-ts";

const findings = detect(text, context);
const { maskedText, restoreMap } = mask(text, findings);
const original = restore(maskedText, restoreMap);
```

- **`detect(text, context)`** runs every Tier 1 and Tier 2 detector and returns a combined,
  overlap-resolved `Finding[]`. `context.mode` gates family-only categories (`content.*`)
  internally - pass `mode: "personal"` and they're simply never returned. `context.vault`
  enables Tier 2; omit it (or pass `[]`) to disable vault matching.
- **`mask(text, findings)`** replaces each finding's span with a numbered placeholder
  (`[EMAIL_1]`, `[NAME_1]`, ...) and returns a `restoreMap`. Keep that map in memory only for the
  current conversation - CLAUDE.md requires it never be persisted or transmitted, and no
  (de)serialization helper is provided for it on purpose.
- **`restore(text, restoreMap)`** is the inverse of `mask()`.

All three are pure functions with no I/O: no network calls, no filesystem access, nothing that
would be unsafe to run in a browser extension content script.

## Everything else in `src/` is internal

`src/detectors/*`, `src/corpus/*`, `src/rules/*`, `src/eval/*`, and `src/overlap.ts` are not
re-exported from the package root. Two different reasons:

- `src/corpus/*` and `src/rules/*` use `node:fs` to load and validate `/test-corpus` and `/rules`
  files - dev/test/CI tooling, never something a browser bundle should include.
- `src/detectors/*` and `src/overlap.ts` are `detect()`'s implementation. CLAUDE.md's interface
  is `detect`/`mask`/`restore`, not "here are six detector functions, wire them up yourself" -
  keeping them internal means that contract can't accidentally be bypassed by a consumer calling
  `detectStructuredPii()` directly and forgetting overlap resolution, family-mode gating, or a
  future Tier 3 detector once one exists.

## Adding a new Tier 1 category (or extending an existing one)

Rule data and corpus cases are meant to evolve together, in the same PR:

1. Add or edit the rule in the relevant `/rules/patterns/*.json` file (see `/rules/README.md` for
   the schema). Pick the file grouped with similar categories, or start a new one if none fit.
2. Add or edit cases in the matching `/test-corpus/*.jsonl` file (see `/test-corpus/README.md`):
   true positives, hard negatives, and any multi-finding cases worth covering.
3. If this is a new category group (new rule file + new corpus file), add a detector module in
   `src/detectors/` following the existing pattern (see `structuredPii.ts` for the simplest
   example): import the rule JSON as a bundled data module (not via the `node:fs` loader -
   that's dev tooling only), validate it at module load with `validatePatternRule`, compile with
   `compilePatternRule`, and run with `runPatternRules`.
4. Wire the new detector into `detect.ts`'s fan-out list.
5. Add a `*.test.ts` (direct unit tests) and a `*.eval.test.ts` (corpus-driven precision/recall,
   using `evaluateDetector` from `src/eval/evaluate.ts`). Only structured PII and `vault.match`
   are asserted against CLAUDE.md's 0.95/0.90 target (see `docs/adr/0004-quality-gate-scope.md`);
   other categories should still report their numbers via `console.log`, not skip the eval test
   entirely.

A category with no Tier 1 rule at all (currently `pii.name` and `pii.school` - see
`docs/adr/0003-vault-match-category-and-fuzzy-matching.md`) is intentional when no regex makes
sense for it; it's still expected to be reachable via the vault (Tier 2).

## Tests

```sh
pnpm --filter @guardian/engine-ts test       # or: pnpm test (from the repo root)
pnpm --filter @guardian/engine-ts typecheck
```

`*.eval.test.ts` files print per-category precision/recall to stdout even when not asserting a
threshold - useful for spotting a regression locally before it shows up in CI's job summary.
