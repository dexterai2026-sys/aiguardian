# Phase 1 Plan: Shared Rules, Test Corpus, TypeScript Engine (Tiers 1–2), CI

Source: `CLAUDE.md` roadmap, Phase 1 — "Shared rules, test corpus, TypeScript engine (Tiers 1–2), CI".
This document breaks that phase into small, PR-sized tasks. No code is written as part of this
plan; each task below becomes its own pull request when implemented.

## Goal

By the end of Phase 1:

- `/rules` holds versioned, language-agnostic detection rule data and AI domain lists.
- `/test-corpus` holds a labeled JSONL corpus covering every category in the initial enum,
  including hard negatives.
- `/packages/engine-ts` implements `detect()`, `mask()`, `restore()` per the interface in
  `CLAUDE.md`, covering Tier 1 (pattern rules) and Tier 2 (personal vault matching). Tier 3
  (on-device ML) is explicitly out of scope.
- CI runs lint, typecheck, unit tests, and the corpus-based precision/recall report on every PR,
  and fails the build if Tier 1 structured-PII targets (precision ≥ 0.95, recall ≥ 0.90) regress.
- The roadmap table in `CLAUDE.md` is updated to mark Phase 1 complete.

## Constraints carried over from CLAUDE.md

- Detection runs entirely on-device / in-process — nothing in the engine calls out to a network
  service, even in tests.
- No content is ever logged; test corpus entries are fixtures, not user data, so this doesn't
  block using realistic-looking sample text.
- `strict: true` TypeScript, no `any` without a justifying comment.
- Every change ships with tests (Vitest).
- Conventional Commits; one concern per PR.
- **Ask before adding any new dependency.** Several tasks below identify a candidate library —
  each is a separate approval checkpoint, not a blanket pre-approval. Where feasible, prefer a
  small hand-written implementation over a dependency, per the "data minimization" instinct that
  runs through the whole project.
- Category enum changes require updating the list in `CLAUDE.md`, `/rules`, `/test-corpus`, and
  (later, Phase 3) the backend enum together. Phase 1 should not need to change the enum, only
  implement detectors for the categories already listed.

## Sequencing

Tasks are ordered so each PR builds on a merged, tested predecessor. Rule schema and corpus
format land before any detector code, since detectors and corpus tests both depend on them.

| #   | PR                                                               | Depends on                        |
| --- | ---------------------------------------------------------------- | --------------------------------- |
| 0   | Commit `CLAUDE.md` and repo scaffolding                          | —                                 |
| 1   | Monorepo tooling (pnpm, TS, lint/format)                         | 0                                 |
| 2   | `engine-ts` package skeleton + shared types                      | 1                                 |
| 3   | Test corpus format, loader, and validation                       | 2                                 |
| 4   | Shared rules schema (`/rules`) + AI domain list                  | 2                                 |
| 5   | Tier 1: structured PII detectors (card, SSN, phone, email)       | 3, 4                              |
| 6   | Tier 1: address, secrets, DOB, government ID, bank, medical      | 5                                 |
| 7   | Tier 1: prompt-injection detectors                               | 5                                 |
| 8   | Tier 1: family-mode content-flag detectors                       | 5                                 |
| 9   | Tier 2: personal vault matching                                  | 3, 4                              |
| 10  | `mask()` / `restore()`                                           | 5–9 (needs real findings to mask) |
| 11  | `detect()` orchestration, overlap resolution, perf               | 5–10                              |
| 12  | CI pipeline (lint, typecheck, test, corpus report, quality gate) | 11                                |
| 13  | Docs, ADRs, roadmap update, Phase 1 close-out                    | 12                                |

## Detailed tasks

### PR 0 — Commit `CLAUDE.md` and minimal repo scaffolding

- Add `CLAUDE.md` (already drafted) to the repo root.
- Add a short root `README.md` that states the project name/status and points to `CLAUDE.md`.
- Add `.gitignore` (node_modules, build output, `.env`, editor files).
- Add `.env.example` (empty for now — no secrets exist yet in Phase 1).
- License: proprietary, all rights reserved (owner decision). No `LICENSE` file is added; this
  is documented in `CLAUDE.md` and `README.md` instead, along with a note to ask before adding
  any dependency whose license would require disclosing or relicensing this repo's source (e.g.
  GPL-family licenses).
- No tests needed (no code yet). Acceptance: repo has an initial commit history and a human
  reading the repo root understands what it is.

### PR 1 — Monorepo tooling

- `pnpm-workspace.yaml` declaring `packages/*` and `apps/*`.
- Root `package.json` with workspace scripts (`lint`, `typecheck`, `test`, `build`) that fan out
  to workspace packages.
- Root `tsconfig.base.json` with `strict: true`, referenced by package-level configs.
- ESLint + Prettier config shared at the root (flat config), with a rule that flags bare `any`.
- `.editorconfig`.
- No functional code. Acceptance: `pnpm install` succeeds on an empty workspace; `pnpm lint` and
  `pnpm typecheck` run (with nothing to check yet) and exit 0.
- Dependency approval needed: ESLint, Prettier, TypeScript, pnpm itself, and their plugins —
  flag as the first "new dependency" batch since none exist yet.

### PR 2 — `engine-ts` package skeleton + shared types

- Create `/packages/engine-ts` with its own `package.json`, `tsconfig.json` (extends root base),
  and `vitest.config.ts`.
- Define shared types in `src/types.ts` matching the CLAUDE.md interface exactly:
  - `Category` union/enum with the 20 initial values listed in CLAUDE.md.
  - `Tier` (`1 | 2 | 3`, or a named union).
  - `Finding { category, start, end, confidence, tier, suggestedPlaceholder }`.
  - `Context { appId, siteId, mode: "personal" | "family", ageProfile, vault }`.
  - `RestoreMap` type (in-memory only; document with a comment that it must never be persisted
    or transmitted, per the privacy principles).
- Stub (not implement) `detect`, `mask`, `restore` function signatures that throw
  "not implemented" — this makes the package compile and importable for the corpus-loader work
  in PR 3 without pre-empting detector design.
- Tests: a type-level smoke test that the stubs compile and can be imported; a trivial unit test
  per stub asserting it throws.
- Dependency approval needed: Vitest (already implied by CLAUDE.md tooling conventions, but
  confirm exact version to pin).

### PR 3 — Test corpus format, loader, and validation

- Create `/test-corpus/README.md` documenting the JSONL schema from CLAUDE.md (`id`, `text`,
  `expected[]` with `category`/`start`/`end`, optional `notes`), plus conventions: one file per
  category group, hard negatives live alongside positives (not a separate "negatives" ghetto)
  so precision is measured honestly, and every case must be a synthetic/fixture example — never
  real user data.
- Add a `corpus-schema.ts` (or JSON Schema file) and a loader in `engine-ts`
  (`loadCorpus(path): CorpusCase[]`) that parses JSONL and validates each line against the
  schema, failing loudly on malformed entries (bad category name, out-of-range offsets, etc.).
- Seed exactly one placeholder file, e.g. `test-corpus/smoke.jsonl`, with 2–3 trivial cases (one
  positive, one hard negative) purely to exercise the loader — real category coverage comes in
  PRs 5–8.
- Tests: loader unit tests covering valid input, malformed JSON line, unknown category, offsets
  outside text bounds.
- Dependency approval needed: only if a schema-validation library (e.g., Zod) is chosen instead
  of hand-written checks — flag this choice explicitly for approval before implementing.

### PR 4 — Shared rules schema (`/rules`) and AI domain list

- `/rules/README.md` documenting the rule file format and how it's shared across future Kotlin
  and Rust implementations (data, not code — no TypeScript-specific constructs).
- `/rules/patterns/*.json` (or YAML): one rule definition per Tier-1 category with fields like
  `category`, `pattern` (regex source as a string, engine-agnostic), `validation` (name of a
  named validator such as `luhn`, or none), `confidence`, `placeholderPrefix`.
- `/rules/ai-domains.json`: initial list of known AI site domains (ChatGPT, Claude.ai, Gemini,
  Copilot, Character.AI, Perplexity, etc.) for later use by the extension (Phase 2) and Android
  DNS filtering (Phase 4); Phase 1 only needs the data file and a loader, not a consumer.
- A small `engine-ts` loader that reads and validates `/rules/patterns/*.json` against a schema
  (mirrors the corpus validation approach from PR 3) so a malformed rule file fails CI rather
  than silently loading zero rules.
- Tests: rules loader validates the seed files; a test asserting every category in the shared
  `Category` type that has a Tier-1 detector has a corresponding rule entry (keeps rules and
  types from drifting apart).
- No detection logic yet — this PR only makes rule _data_ loadable and validated.

### PR 5 — Tier 1: structured PII detectors (card, SSN, phone, email)

- Implement detectors consuming the rule data from PR 4 for: `pii.payment_card` (regex +
  Luhn check), `pii.ssn` (format rules, including exclusion of obviously-invalid ranges),
  `pii.phone`, `pii.email`.
- Decide phone-number handling: CLAUDE.md suggests "libphonenumber or equivalent" — **ask
  before adding** `libphonenumber-js` (or similar); the alternative is a narrower hand-rolled
  regex set for common formats (US-centric first, ask whether international support is in scope
  for Phase 1).
- Add real corpus cases to `/test-corpus/pii-structured.jsonl` covering true positives, hard
  negatives (e.g., a 16-digit non-Luhn-valid number, a phone-shaped SSN, order numbers that look
  like cards), and multi-finding lines.
- Add a corpus-driven precision/recall test harness (`scripts/eval-corpus.ts` or a Vitest test)
  that runs `detect()` against the corpus subset for these categories and asserts precision ≥
  0.95 / recall ≥ 0.90, per the CLAUDE.md quality target. This harness is reused unchanged by
  PRs 6–9.
- This is the first PR with real detection behavior — keep it tightly scoped to these four
  categories only.

### PR 6 — Tier 1: address, secrets, DOB, government ID, bank account, medical

- Extend the pattern rules and detectors for: `pii.home_address` (heuristic: number + street
  suffix, aware it will have lower precision than structured PII — document this as a known
  limitation), `pii.dob`, `pii.government_id`, `pii.bank_account`, `pii.medical` (keyword/phrase
  based), `secret.api_key` (common vendor prefixes: `sk-`, `AKIA`, `ghp_`, etc., plus a generic
  high-entropy-string fallback), `secret.password` (context-based: flag only when near a
  password-looking label in _non_-password-field text, never inspect actual password fields per
  the privacy principle — clarify in code comments that this detector is about text _content_
  mentioning credentials, not form-field inspection, which is an extension/app concern for later
  phases).
- Expand corpus files accordingly, with generous hard negatives for address and medical (highest
  false-positive risk).
- Run the precision/recall harness from PR 5 against these categories; if targets can't be met
  for address/medical (likely, given the note in CLAUDE.md that quality targets are stated for
  "structured PII"), document actual measured numbers in the PR description rather than forcing
  the test to pass artificially.

### PR 7 — Tier 1: prompt-injection detectors

- `injection.hidden_text`: detect zero-width characters, suspicious Unicode homoglyphs, and
  markup/CSS-hiding patterns in already-extracted text (e.g., `display:none` markers if the
  input includes HTML, tiny/invisible font-size hints) — scope this to what plain-text `detect()`
  can see; page-DOM scanning is an extension concern (Phase 2), not this engine.
- `injection.instruction_pattern`: keyword/regex heuristics for common jailbreak/injection
  phrasing ("ignore previous instructions", "you are now DAN", "disregard the system prompt",
  etc.), sourced as data in `/rules/patterns/injection.json` so the list can grow without code
  changes.
- Corpus: `/test-corpus/injection.jsonl` with clear positives, and hard negatives (legitimate
  text that discusses AI instructions without being an injection attempt, e.g., a student asking
  "how do system prompts work?").
- Precision/recall are not part of the CLAUDE.md hard quality target (that's scoped to
  structured PII), but still measure and report them in CI output per PR 12.

### PR 8 — Tier 1: family-mode content-flag detectors

- `content.self_harm`, `content.sexual`, `content.violence`, `content.secrecy_from_parents`
  (e.g., phrases like "don't tell my parents", "keep this between us").
- These are keyword/phrase-based only in Phase 1 (Tier 3 ML is explicitly later). Document
  clearly in the PR and in code comments that this tier will have materially lower recall than
  structured PII and is meant as a first pass, not a moderation-grade classifier.
- Corpus with realistic kid phrasing per CLAUDE.md guidance, plus hard negatives (e.g., discussing
  a violent movie plot vs. an actual threat) — keep all corpus text fixture/synthetic, not scraped
  real content.
- These categories are `context.mode === "family"`-gated in the detector layer, since personal
  mode should not surface family content flags (confirm this gating in a test).

### PR 9 — Tier 2: personal vault matching

- Implement vault matching against `context.vault` (structure TBD in this PR — a simple
  `{ id, category, value }[]` of registered values: child's name, school, street, team,
  siblings).
- Exact match first; then fuzzy match for minor variants (nicknames, misspellings, case/spacing
  differences). **Ask before adding** a fuzzy-matching dependency (e.g., a Levenshtein-distance
  library); alternative is a small hand-written edit-distance function given the likely small
  vault sizes (tens of entries, not thousands) — flag the tradeoff for owner input.
- All vault matches produce `category: "vault.match"` with a `confidence` and reference back to
  which vault category matched (name vs. school vs. address, etc.) — clarify in the `Finding`
  type or a follow-up whether the specific vault category should be preserved as metadata; if
  CLAUDE.md's `Finding` shape doesn't have room for it, flag this as a design question for the
  owner rather than silently extending the shared interface.
- Corpus/tests use an in-memory mock vault fixture (never a real family's data, consistent with
  data-minimization).

### PR 10 — `mask()` / `restore()`

- Implement `mask(text, findings) -> { maskedText, restoreMap }`: replace each finding's span
  with a numbered placeholder (`[NAME_1]`, `[ADDRESS_1]`, etc.), numbering independently per
  category, processed in a stable order (e.g., left-to-right by `start`) so numbering is
  deterministic and testable.
- Handle overlapping/adjacent findings from different detectors (e.g., a vault name match
  inside a longer address match) with a clear, tested precedence rule — document the rule
  (likely: prefer the higher-tier/higher-confidence finding, drop the fully-contained lower one).
- Implement `restore(text, restoreMap) -> text` as the inverse operation.
- Explicit test that `restoreMap` is a plain in-memory object/Map with no serialization helper
  provided — a deliberate omission, not an oversight, so nothing downstream is tempted to persist
  it.
- Round-trip tests: `restore(mask(text, findings).maskedText, restoreMap) === text` across the
  corpus.

### PR 11 — `detect()` orchestration, overlap resolution, performance

- Wire Tier 1 (PRs 5–8) and Tier 2 (PR 9) detectors into the single `detect(text, context)`
  entry point specified in CLAUDE.md, respecting `context.mode` gating for family-only
  categories.
- Apply the same overlap-resolution rule used by `mask()` (PR 10) so `detect()`'s own output is
  already de-duplicated/precedence-ordered before a caller ever masks it.
- Add a performance benchmark (Vitest bench or a small script) measuring `detect()` latency on
  a 2,000-character sample; log the result in CI output. Note honestly in the PR that CI runner
  hardware isn't equivalent to "a mid-range device" — treat the CLAUDE.md's <20ms target as a
  logged, tracked metric here, not a hard CI gate, and flag to the owner whether a hard gate on
  CI hardware is wanted once a baseline exists.
- This PR is the integration point — full corpus precision/recall (all categories, not just
  structured PII) is measured here for the first time end-to-end.

### PR 12 — CI pipeline

- GitHub Actions workflow (`.github/workflows/ci.yml`): on push/PR, `pnpm install` (cached),
  `pnpm lint`, `pnpm typecheck`, `pnpm test` (Vitest across workspaces).
- A dedicated CI step runs the corpus evaluation harness (from PR 5/11) and prints a
  per-category precision/recall table to the job summary.
- CI fails if Tier 1 structured-PII precision drops below 0.95 or recall below 0.90 (the one
  CLAUDE.md-mandated hard gate); other categories are reported but not gated in Phase 1, per the
  honesty notes in PRs 6–8.
- No deploy/build steps yet (nothing to build/ship in Phase 1 — extension/backend CI comes with
  their own phases).

### PR 13 — Docs, ADRs, roadmap update, Phase 1 close-out

- Add `/docs/adr/` entries for the significant decisions made along the way: rule schema format,
  corpus format, overlap-resolution precedence rule, any dependency chosen in PRs 5/9, and the
  CI quality-gate scope.
- Add a short `packages/engine-ts/README.md` covering the public API (`detect`/`mask`/`restore`)
  and how to add a new rule + corpus case together.
- Update the roadmap table in `CLAUDE.md`: mark Phase 1 **Done**, note any deferred items (e.g.,
  international phone support, address precision) as explicit follow-ups for Phase 2+ rather
  than silently dropped.
- Sanity-check the whole phase: run the full corpus report one more time, confirm all categories
  in the enum have at least a Tier 1 or Tier 2 detector (Tier 3-only categories, if any, are
  explicitly listed as "not yet detected" rather than silently absent).

## Open questions for the owner (surface before/at the relevant PR, not all at once)

- Phone-number library vs. hand-rolled regex, and whether international numbers are in scope
  for Phase 1 (PR 5).
- Fuzzy-matching approach/dependency for vault matching (PR 9).
- Whether vault-match findings need to carry which vault category matched, which may require
  extending the shared `Finding` type beyond what's currently specified in CLAUDE.md (PR 9).
- Whether the <20ms latency target should become a hard CI gate once a baseline is established,
  and on what reference hardware (PR 11).
