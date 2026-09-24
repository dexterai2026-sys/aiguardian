# Test corpus

Shared, labeled test prompts that every detection engine implementation (TypeScript now, later
Kotlin and Rust) must pass. This is what keeps engines behaviorally consistent across platforms,
per `CLAUDE.md`.

## Format

One JSON object per line (`.jsonl`), blank lines ignored:

```json
{
  "id": "addr-001",
  "text": "we live at 42 Maple Street",
  "expected": [{ "category": "pii.home_address", "start": 11, "end": 26 }],
  "notes": "basic street address"
}
```

- `id` — unique, stable string. Prefix by category/topic (e.g. `addr-001`, `card-neg-003`) so
  IDs sort near related cases and survive reordering.
- `text` — the fixture prompt. Always synthetic/invented text, never real user data, even
  though nothing here is treated as sensitive by the pipeline.
- `expected` — zero or more findings, each with:
  - `category` — must be one of the categories in `CLAUDE.md`'s category enum.
  - `start` / `end` — offsets into `text`, in UTF-16 code units (`start` inclusive, `end`
    exclusive), matching JavaScript string indexing.
- `notes` — optional, free text explaining what the case is testing.

A case with an **empty `expected` array is a hard negative**: text that looks like it might
contain PII/injection/etc. but should not produce a finding. Hard negatives live in the same
file as their related positives (not a separate "negatives" file) so precision is measured
honestly against a realistic mix.

## File layout

One file per category group, added as Phase 1 detectors are implemented (see
`docs/phase-1-plan.md`):

- `smoke.jsonl` — a handful of trivial cases used only to exercise the loader itself. Not a
  real coverage source; do not add category coverage here.
- `pii-structured.jsonl` — payment cards, SSNs, phone numbers, emails (PR 5).
- Further files (address, secrets, injection, family content flags, vault) are added in the
  PRs that implement those detectors.

## Conventions

- Include hard negatives, realistic kid and adult phrasing, and multi-finding cases (more than
  one `expected` entry per case), per `CLAUDE.md`.
- Keep every case fixture/synthetic — never paste in real personal data, even as a shortcut.
- When adding a case for a new detector, add or update the corresponding rule in `/rules` in
  the same PR — the two are meant to evolve together.

## Loading the corpus

`packages/engine-ts/src/corpus/loader.ts` (`parseCorpus`, `loadCorpusFile`) parses and
validates these files against the schema in `packages/engine-ts/src/corpus/schema.ts`, failing
loudly (naming the file, line, and problem) on a malformed case rather than silently skipping
it.
