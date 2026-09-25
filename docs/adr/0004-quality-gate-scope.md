# ADR 0004: Quality gate is scoped to structured PII and vault.match only

**Status:** Accepted (Phase 1, PRs 5-12)

## Context

CLAUDE.md sets one explicit, numeric quality target: "Tier 1 precision >= 0.95 on the corpus;
recall >= 0.90 for structured PII (cards, SSNs, phones, emails)." It also says to "report
precision/recall per category in CI output" - which reads as broader than the four structured-PII
categories, but doesn't say every category must meet the same numeric bar.

Several Phase 1 categories are fundamentally lower-precision by nature of what they detect:
`pii.home_address`, `pii.dob`, `pii.government_id`, `pii.bank_account`, `pii.medical` (keyword/
shape heuristics, no validation check equivalent to Luhn), `secret.password` (any word after
"password is" matches), `injection.*` and `content.*` (deliberately narrow phrase lists, trading
recall for precision against paraphrased attacks). Forcing these to 0.95/0.90 would mean either
writing a misleadingly narrow corpus (only easy cases) or writing detector code that overfits to
the corpus rather than generalizing - both worse than reporting an honest, lower number.

## Decision

The 0.95 precision / 0.90 recall gate is asserted only for:

- Structured PII (`pii.payment_card`, `pii.ssn`, `pii.phone`, `pii.email`) - per CLAUDE.md's own
  text, first enforced in PR 5's `structuredPii.eval.test.ts`.
- `vault.match` - not named in CLAUDE.md's target, but added in PR 9 on the reasoning that
  matching against a small, known, explicitly-registered set of values is at least as
  constrained as structured PII, so there's no reason to accept a lower bar for it.

Every other category's precision/recall is computed and printed (each detector's own
`*.eval.test.ts`, and the combined `detect.eval.test.ts` in PR 11) but not asserted against a
threshold. PR 12's CI job summary publishes all of them together regardless of gating, so a
regression in a non-gated category is still visible, just not build-breaking.

Where a detector has a **known, specific** false positive (not just "recall is imperfect" but a
concrete input that the current rule matches incorrectly), the corpus keeps the true ground truth
(`expected: []`) and the eval test asserts the false positive is present, rather than either
hiding the case or mislabeling it as a true positive to force a passing number. See
`secret.password` (PR 6), `content.violence` and `content.secrecy_from_parents` (PR 8).

## Consequences

- CI failing always means either lint/typecheck/format broke, or one of these two gated groups
  regressed - a clear, small signal.
- Improving a non-gated category's precision/recall is real, valuable work for later phases, but
  its numbers moving (up or down) doesn't block a PR by itself; a reviewer has to actually look
  at the job summary to notice a regression there.
- If a later phase decides a currently-ungated category needs the same hard bar (e.g. before
  family-mode content flags ship in the extension), that's a deliberate change to make here and
  in PR 12's workflow, not something to infer from the corpus alone.
