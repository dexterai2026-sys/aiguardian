# Store listing and review materials (PR 16)

Chrome Web Store and Edge Add-ons both require a single-purpose description, a permission
justification for every requested permission, a data-usage disclosure, and store-listing copy
(descriptions, icons, screenshots) before a submission can go through review. This doc collects
everything that can be written and verified from inside this repo. **Store-listing screenshots are
not included here** — see "What still needs the owner" at the end; nothing here should block on
them.

## Icon

`public/icons/icon-{16,32,48,128}.png`, wired into `manifest.json`'s `icons` and
`action.default_icon`. A shield-check glyph adapted from
[Lucide](https://lucide.dev)'s `shield-check.svg` (ISC-licensed — see
`apps/extension/THIRD_PARTY_NOTICES.md` for the required copyright notice), on a plain indigo
rounded-square background, rendered to each required size with a small script (not checked in —
this is a static asset, not build tooling). This is a first-pass icon, not a final brand decision:
it's easy to regenerate at a different color or with a different Lucide glyph if the owner wants
something else before submission, and the store listing's separate marketing image (see below)
still needs the owner regardless.

## Single purpose description

> Guardian detects personal information and hidden prompt-injection content in text you're about
> to send to an AI chat tool, and flags concerning content in what the AI sends back, entirely on
> your device.

Everything the extension does (PII/secret detection, injection warnings, family-mode content
flagging, AI-site allow/block, usage stats) serves this one purpose: protecting a person's
interaction with an AI chat tool. There is no unrelated second feature to disclose separately.

## Permission justifications

Reviewed against actual usage in `apps/extension/src` as of PR 16 — `activeTab` was removed from
`manifest.json` in this PR because nothing in the codebase calls `chrome.tabs.*` or
`chrome.scripting.*`; every content script is instead declared statically per-site, which needs no
runtime tab permission at all.

| Permission              | Used for                                                                                                                                                                                                           | Where                                                                                                                            |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| `storage`               | Local-only settings, encrypted vault, usage stats, site allow/block list, family mode/age profile, and the vault session cache — all `chrome.storage.local`/`.session`, never `.sync`, never transmitted anywhere. | `lib/vaultStorage.ts`, `lib/familyModeStorage.ts`, `lib/siteSettingsStorage.ts`, `lib/usageStats.ts`, `lib/vaultSessionCache.ts` |
| `declarativeNetRequest` | Blocks navigation to an AI site the person has chosen to block, via dynamic rules computed entirely on-device from their own settings.                                                                             | `background/index.ts`, `lib/blockRules.ts`                                                                                       |

Host permissions (declared per content script's `matches`, not as a separate `host_permissions`
block) break down the same way:

| Host pattern(s)                                                                                     | Used for                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `chat.openai.com`, `chatgpt.com`, `claude.ai`, `gemini.google.com`                                  | Dedicated per-site adapters (verified selectors) for PII/injection detection, send interception, response restore, and family-mode response flagging.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `copilot.microsoft.com`, `character.ai`, `beta.character.ai`, `perplexity.ai`, `poe.com`, `you.com` | The generic-fallback content script's site-agnostic compose-box detection, for AI sites without a dedicated adapter yet.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `https://*/*`, `http://*/*` (all sites)                                                             | `content-scripts/page-scanner.ts` only (PR 11) — watches the `copy` event site-wide to warn about hidden prompt-injection text a person might copy from _any_ page and paste into an AI chat, not just an AI site itself. This is the one deliberate broad-permission exception in the manifest; it was an explicit, owner-approved decision (`docs/phase-2-plan.md`'s PR 11 entry, dated 2026-09-25), and `src/manifest.test.ts` pins its match pattern so a future edit can't silently widen or narrow it without showing up in a diff. Re-reviewed here for PR 16 and left as-is: the underlying reasoning (hidden text can live on any page) hasn't changed, and there's no narrower Manifest V3 mechanism that covers the same real risk. |
| `http://localhost/*`                                                                                | This repo's own fixture-based e2e tests only (Playwright loads fixture pages from a local server) — never reachable outside a dev/CI checkout of this repo.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |

No permission here grants remote code execution, and the extension bundles no remote code — every
script is built into `dist/` at build time (see `apps/extension/vite.config.ts`); nothing is fetched
and `eval`'d or injected at runtime.

## Data usage disclosure (for the Chrome Web Store's Privacy practices form)

Per CLAUDE.md's non-negotiable privacy principles — prompt and response text never leaves the
device, no analytics/advertising SDKs, category-only alerts — the honest answer to every category
on the Store's data-usage questionnaire is **"we do not collect this data"**:

- Personally identifiable information — not collected (detected locally to protect the person; the
  detected text and any matches never leave the device).
- Health information, Financial and payment information, Authentication information, Personal
  communications, Location, Web history, User activity, Website content — not collected.

Certifications the extension can truthfully make:

- Does not sell or transfer user data to third parties, outside the approved use cases.
- Does not use or transfer user data for purposes unrelated to the item's single purpose.
- Does not use or transfer user data to determine creditworthiness or for lending purposes.

There is currently no backend at all (Phase 3, not started) — so today, literally nothing is
transmitted off the device by this extension, which is stronger than "collected but not shared."
This disclosure will need a real update once Phase 3 ships alerts/heartbeats/vault-sync traffic to
a backend; category-only alerts and E2E-encrypted vault ciphertext (per CLAUDE.md) keep the same
"no PII/content leaves the device" claim true even then, but the questionnaire's literal answers
will change from "not collected" to "collected, on-device only, categories/ciphertext only."

## Store listing copy

**Short description** (matches `manifest.json`'s `description`, kept in sync — see
`src/manifest.test.ts` if a check for this is added later):

> Detects personal info and hidden prompt-injection content before it reaches an AI, entirely on
> your device.

**Detailed description draft:**

> Guardian is a privacy layer for any AI chat tool you already use — ChatGPT, Claude, Gemini, and
> more. It runs entirely on your device:
>
> - **Catches personal info before you send it.** Names, addresses, phone numbers, card numbers,
>   API keys, and more are flagged as you type, with the option to mask them before sending.
> - **Warns about hidden instructions.** Some web pages hide extra text aimed at manipulating an AI
>   tool. Guardian warns you if you copy text that includes something hidden from view.
> - **Optional family mode** flags concerning content in an AI's replies (not just what you send),
>   for a shared or managed device — no data is sent to us or anyone else; this is an in-the-moment
>   signal to whoever is at the keyboard, not a monitoring or reporting tool (yet — a future,
>   separately-installed parent dashboard is planned, and will be disclosed clearly if and when it
>   ships).
> - **Nothing you type or receive ever leaves your device.** No accounts, no analytics, no ads.
>
> Guardian works alongside ChatGPT, Claude.ai, Gemini, and other AI chat sites — it doesn't replace
> or require switching the AI tool you already use.

This draft avoids two known store-policy traps: it doesn't claim to be a parental-monitoring app
(Google Play's Families policy and general "spyware" review flags — see CLAUDE.md's Distribution
notes on positioning for parents/adults, not as a children's app) and it doesn't overclaim what
family mode currently does (there is no alerting/dashboard yet — PR 16 is Phase 2 only).

## What still needs the owner

Not attempted here — these need real assets or a business decision, not something to fabricate:

- **Sign-off on the icon** above, or a different one — it's a reasonable first pass (a recognizable
  shield glyph, legible down to 16px), not a reviewed brand decision.
- **Store listing marketing image(s)** — separate from the extension icon itself, Edge Add-ons and
  the Chrome Web Store's promotional tile both have their own size requirements for the listing
  page's hero image, which a small toolbar icon doesn't satisfy on its own.
- **Screenshots** for both store listings (Chrome Web Store requires at least one, 1280×800 or
  640×400).
- **Support email / website URL** for both stores' developer/listing forms.
- **Store account setup**: a Chrome Web Store developer account (one-time fee) and a Microsoft
  Partner Center account, both under the owner's control, not something this repo or session can
  create.
- **Final sign-off on the listing copy above** — it's a draft grounded in what the code actually
  does, not a decision the owner has reviewed yet.

## Delivered in this PR

- Removed the unused `activeTab` permission from `manifest.json` (nothing in the codebase uses
  `chrome.tabs.*`/`chrome.scripting.*`; every content script is statically declared instead).
- Reviewed every other permission and host-permission entry against actual usage — all justified,
  see the table above. The all-sites `page-scanner` permission was re-examined specifically (it's
  the only broad grant) and left as-is, since PR 11's underlying reasoning still holds and there's
  no narrower mechanism that covers the same risk.
- This file: single-purpose description, per-permission justifications, a data-usage disclosure
  answer set, and draft store-listing copy — everything the store review forms ask for that doesn't
  require an image asset or a business/account decision.
- **A real icon set** (`public/icons/icon-{16,32,48,128}.png`), added once the owner pointed to
  Lucide as a free, appropriately-licensed icon source — see "Icon" above.
