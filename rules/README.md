# Shared detection rules

Language-agnostic **data**, not code — every engine implementation (TypeScript now, later
Kotlin and Rust) loads the same files here, so pattern changes and AI-domain updates apply to
every platform without touching per-language code. See `CLAUDE.md`'s "Detection engine"
section for the tiers this supports.

## `patterns/*.json`

Each file is a JSON array of Tier-1 pattern rules, grouped thematically (e.g.
`pii-structured.json` for card/SSN/phone/email). One rule per category — a category must not
appear in more than one rule across all pattern files.

```json
{
  "category": "pii.payment_card",
  "pattern": "\\b(?:\\d[ -]?){13,19}\\b",
  "validation": "luhn",
  "confidence": 0.9,
  "placeholderPrefix": "CARD",
  "description": "Digit sequences shaped like a card number; luhn validation narrows false positives."
}
```

Fields:

- `category` — must be one of the categories in `CLAUDE.md`'s category enum.
- `pattern` — a regex source string (no delimiters, no embedded flags). The loader always
  applies the `g` and `u` flags; add others via `flags` if needed.
- `flags` — optional, additional regex flags beyond `gu` (e.g. `"i"`).
- `validation` — optional name of a secondary validator a detector applies after a pattern
  match, to cut false positives (e.g. `"luhn"` for card numbers). Detector code (Phase 1 PRs
  5-8) looks the name up; adding a new validator name here means implementing it there in the
  same PR.
- `confidence` — the detector's confidence in [0, 1] when this rule matches (before any
  `validation` step further adjusts it).
- `placeholderPrefix` — the label `mask()` uses before numbering, e.g. `"CARD"` becomes
  `[CARD_1]`, `[CARD_2]`, ...
- `description` — optional, free text.

Rule data here does not implement detection by itself — see `packages/engine-ts/src/rules` for
the loader/validator, and the Phase 1 detector PRs (`docs/phase-1-plan.md`) for the code that
consumes it.

## `ai-domains.json`

A JSON array of known AI site domains, used by the browser extension (Phase 2) to scope content
scripts and `declarativeNetRequest` blocking, and by the Android DNS VPN (Phase 4). Phase 1 only
defines and validates this data; nothing consumes it yet.

```json
{ "domain": "chat.openai.com", "name": "ChatGPT" }
```

- `domain` — a bare hostname (no scheme, no path, no wildcard).
- `name` — a short human-readable service name, for UI display.

## Keeping rules and the corpus in sync

Whenever a rule is added or changed here, add or update matching cases in the corresponding
`/test-corpus/*.jsonl` file in the same PR — the two are meant to evolve together. A rule
without corpus coverage has no evidence it works; corpus cases for a category with no rule test
nothing.
