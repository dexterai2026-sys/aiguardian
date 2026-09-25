# Phase 2 Plan: Browser Extension (Personal Mode + Client-Only Family Scaffolding)

Source: `CLAUDE.md` roadmap, Phase 2 — "Browser extension (personal mode first, then family
hooks)", and the "Browser extension" component section. This document breaks that phase into
small, PR-sized tasks, following the same approach as `docs/phase-1-plan.md`. No code is written
as part of this plan; each task below becomes its own pull request when implemented.

## Goal

By the end of Phase 2:

- `/apps/extension` is a Manifest V3 extension (TypeScript, Vite build) that runs on Chrome, Edge,
  and Brave, loadable unpacked for local testing (the owner's workflow — see CLAUDE.md's
  Development environment section).
- **Personal mode is complete**: real-time highlighting, send interception (mask/edit/send
  anyway), paste and file-upload scanning, response restore, a hidden-injection page scanner, AI
  site allow/block, usage stats, and a visible "protection active" indicator — all backed by
  `@guardian/engine-ts` from Phase 1, running entirely on-device.
- Site adapters exist for ChatGPT, Claude.ai, Gemini, Copilot web, Character.AI, and Perplexity,
  plus a generic fallback for any other chat-style text box, per CLAUDE.md.
- **Family mode is client-only scaffolding**, per the scope decision below: a local mode toggle,
  a local (device-only, not synced) encrypted vault, and in-UI response flagging. No pairing, no
  alerts, no parent dashboard — those need Phase 3's backend and are explicitly deferred.
- CI builds the extension and runs Playwright e2e tests against it (per CLAUDE.md's testing
  conventions), on every PR.

## Scope boundary: family mode without a backend (owner decision)

Phase 3 (not started) is what makes family mode real: pairing, policy sync, category-only alerts
to a parent, and genuine end-to-end vault encryption with a family passphrase the server never
sees. None of that exists yet. Rather than defer all family-mode work to Phase 3 (which would
make Phase 2 personal-mode-only) or half-build it against a fake backend, the owner chose:
build the **client-only** pieces now (mode toggle, a local encrypted vault, in-UI response
flagging) with **no** pairing, alerts, or sync — those remain Phase 3 work, and the local vault
built here should be expected to be reworked (not necessarily reused as-is) once real backend
sync exists. This is a deliberate scope choice, not an oversight — record it in an ADR (PR 14).

Heartbeats are **not** part of Phase 2: CLAUDE.md defines them as "protection active" reports to
a parent dashboard, which requires the Phase 3 backend to receive and act on them. Building a
heartbeat sender with nothing listening isn't useful scaffolding, unlike the vault/toggle/flagging
above, which are independently useful in personal-mode-adjacent testing today.

## Constraints carried over from CLAUDE.md

- **Detection stays on-device.** The extension calls `@guardian/engine-ts`'s `detect`/`mask`/
  `restore` locally; no prompt/response/pasted text is ever sent anywhere, including to any
  telemetry.
- **Visible, never covert**: every surface (highlight, modal, badge) must be visible to the
  person using the browser. Personal mode reports to no one.
- **Never inspect password fields**, incognito/no-personalized-learning-flagged fields, or
  payment fields outside AI contexts.
- **No third-party analytics or ad SDKs.** Crash reporting (if any) is opt-in and scrubbed of
  user text.
- **Minimal permissions**, for both the non-negotiable data-minimization principle and Chrome Web
  Store / Edge Add-ons review (CLAUDE.md's Distribution notes).
- **Ask before adding a dependency**, changing the category enum, or touching a privacy
  principle. Several tasks below flag a likely new dependency (a Vite MV3 plugin, `@types/chrome`,
  `@playwright/test`) as an approval checkpoint, not a pre-approval.
- **Site adapters will break** when AI sites change layout — CLAUDE.md requires them isolated,
  small, and covered by fixture-based tests (saved DOM snapshots, not live network calls) so
  breakage is easy to localize.
- Every change ships with tests (Vitest for logic, Playwright for anything that needs a real
  loaded extension and page).

## Sequencing

| #   | PR                                                         | Depends on |
| --- | ---------------------------------------------------------- | ---------- |
| 0   | Extension scaffolding & build tooling                      | —          |
| 1   | Playwright e2e harness + CI                                | 0          |
| 2   | Engine integration                                         | 1          |
| 3   | Generic fallback: detection wiring                         | 2          |
| 4   | Real-time highlighting UI                                  | 3          |
| 5   | Send interception (mask/edit/send anyway)                  | 4          |
| 6   | Paste and file-upload scanning                             | 5          |
| 7   | Response restore                                           | 5          |
| 8   | Site adapter framework + ChatGPT adapter                   | 4, 5       |
| 9   | Claude.ai + Gemini adapters                                | 8          |
| 10  | Copilot web + Character.AI + Perplexity adapters           | 8          |
| 11  | Hidden-injection page scanner                              | 2          |
| 12  | AI site allow/block + visible protection indicator         | 1          |
| 13  | Local usage stats                                          | 3          |
| 14  | Local family-mode scaffolding (toggle, age profile, vault) | 2          |
| 15  | Family-mode response flagging in UI                        | 7, 14      |
| 16  | Store readiness                                            | all above  |

## Detailed tasks

### PR 0 — Extension scaffolding & build tooling

- Create `/apps/extension` with `package.json`, `tsconfig.json` (extends the root base config),
  and a Vite config targeting Manifest V3.
- **Dependency decision needed**: a Vite-to-MV3 plugin (e.g. `@crxjs/vite-plugin` or
  `vite-plugin-web-extension`) to handle manifest-driven multi-entry builds (background service
  worker, content scripts, popup, options page) — evaluate both for MV3 support and maintenance
  status before picking. Also add `@types/chrome` for typed `chrome.*` APIs.
- `manifest.json` (v3) skeleton: name, description, minimal initial permissions (`storage`,
  `activeTab`), no host permissions yet (added per-feature in later PRs, kept as narrow as each
  feature actually needs — not a blanket `<all_urls>` grant this early).
- Background service worker stub, popup stub (placeholder UI), options page stub.
- `pnpm build` produces an unpacked `dist/` directory; document loading it unpacked in Chrome
  (README section, matching the owner's actual testing workflow per CLAUDE.md).
- No detection logic yet.

### PR 1 — Playwright e2e harness + CI

- Add `@playwright/test` to `/apps/extension`. Set up `launchPersistentContext` loading the built
  unpacked extension (MV3 extensions need a persistent context, not `browser.newPage()`).
- **Verify empirically** whether headless Chromium (`--headless=new`) can load an MV3 extension
  in this environment, or whether CI needs a virtual display (e.g. `xvfb`) — record the answer
  and the working config, since this blocks every later e2e test in this phase.
- One smoke test: the extension loads, the background service worker registers, the popup opens
  and renders. No feature logic yet.
- Add a GitHub Actions job (or extend `.github/workflows/ci.yml`) building `/apps/extension` and
  running its Playwright suite, using the pre-installed Chromium the session's own CI runner
  provides where possible.

### PR 2 — Engine integration

- Add `@guardian/engine-ts` as a workspace dependency of `/apps/extension`.
- Confirm the Vite build correctly bundles the cross-package rule JSON imports flagged as a risk
  in `docs/adr/0001-rule-and-corpus-data-format.md` ("if Phase 2 adds a build step, must
  special-case rootDir/outDir or continue leaning on a bundler") — Vite should handle this
  natively as a JSON asset, but this PR is where that assumption gets proven, not assumed.
- One Playwright test: a content script calls `detect()` on a static string inside a real loaded
  page context and produces the expected finding — proves the whole pipeline (bundler → content
  script → engine) works before any real feature is built on top of it.

### PR 3 — Generic fallback: detection wiring

- A content script matching a broad-but-documented set of pages (start with a small
  manually-curated list of known AI sites from `/rules/ai-domains.json`, not `<all_urls>`, to
  keep permissions minimal — the "generic fallback" is about _UI pattern_ recognition on AI
  sites, not running on every page on the internet).
- Heuristic to find the chat-style compose box (large `<textarea>` or `contenteditable` element
  near a send-shaped button).
- Wire `detect()` (personal mode: `context.mode: "personal"`, no vault yet) to the compose box's
  input, debounced (CLAUDE.md: "must never make typing feel slow").
- No visible UI yet — this PR proves detection runs correctly against real typed input (unit +
  Playwright tests), decoupled from the rendering work in PR 4.

### PR 4 — Real-time highlighting UI

- Render findings visually over the compose box. `<textarea>` can't hold rich inline styling, so
  use a mirrored-overlay technique (an absolutely-positioned div replicating the textarea's text
  and font metrics, with highlighted spans, layered behind/over the real input) — a well-known
  pattern for this problem; `contenteditable` boxes can use native inline styling instead.
  **Implementation detail to nail down in this PR**, not assumed here.
- Tooltip or inline label showing the category on hover/focus (still without exposing masked
  content anywhere in code, logs, etc. — only the categorized label).
- Fixture-based tests: a saved static HTML page with a known compose-box shape, verifying
  highlight positions match finding offsets.

### PR 5 — Send interception (mask/edit/send anyway)

- Intercept the send action (Enter key and/or send button click) when findings exist.
- Modal/panel: shows the masked preview (`mask()`'s output), with options to send masked, go back
  and edit, or send the original text anyway (never blocks the user outright — CLAUDE.md's
  approach is "protect and teach," not restrict).
- Keep `restoreMap` in memory only for that tab/conversation, per CLAUDE.md — never write it to
  `chrome.storage` or send it anywhere.

### PR 6 — Paste and file-upload scanning

- Intercept `paste` events into the compose box; run the same detect/highlight/intercept path on
  pasted content before it lands in the box (or immediately after, re-scanning).
- For file uploads (drag-drop or `<input type="file">` into the AI site's own uploader): read
  text-based file content client-side (`FileReader`) and scan it the same way before the file is
  handed to the page, where feasible without breaking the site's own upload flow. Document any
  site where this isn't feasible (e.g. the site reads the file via a mechanism the content script
  can't intercept) as a known gap rather than silently skipping it.

### PR 7 — Response restore

- After the AI responds, scan the rendered response DOM for placeholder tokens
  (`[CATEGORY_N]`-shaped text) that match keys in the tab's current `restoreMap`.
- Replace them for on-screen display only (a rendering-layer substitution, not a DOM/storage
  mutation that could leak back into the page's own state or network requests) — since the AI
  itself only ever saw the masked text, this is purely a display convenience for the user who
  sent the masked version and now sees the AI's reply reference "\[EMAIL_1]" literally.
- Only ever restores within the same tab/session `restoreMap` — a placeholder-shaped string with
  no matching key (e.g. the AI hallucinated one, or it's a different conversation) is left as-is.

**Delivered, with a scope adjustment found during implementation:** `lib/responseRestore.ts` is
built and unit-tested exactly as described above (given a root and a `restoreMap`, it restores
placeholders in that root's text on mutation, excluding the compose box and Guardian's own UI).
It is **not** wired into the generic-fallback content script. Doing so surfaced a real bug, not
just a test failure: a typical chat site re-renders the person's own just-sent message as a
bubble too, and the generic fallback has no adapter knowledge to tell that bubble apart from the
AI's actual reply. Restoring inside the person's own "sent" bubble would visibly undo the masking
they just chose, on their own screen — defeating exactly the protection "Send masked" is meant to
provide against anyone looking at that screen (shoulder-surfing, screenshots, screen recording).
A timing-based heuristic (assume anything rendered within N ms of sending is the echo) was
considered and rejected as fragile guessing, inconsistent with this repo's adapter philosophy of
correctness over guessed DOM behavior. Per-site adapters (PR 8+), which know their site's real
response-container selector, are the first safe callers of `attachResponseRestore`.

### PR 8 — Site adapter framework + ChatGPT adapter

- Define the adapter interface: selectors/heuristics for the compose box, send control, and
  response container, plus a capability flag set (e.g. "supports file upload interception: yes/
  no") so adapters can differ in what they support.
- Adapters take precedence over the generic fallback on their matched site.
- ChatGPT adapter, with fixture-based tests: a saved snapshot of ChatGPT's DOM structure (not a
  live network call — CLAUDE.md requires adapters be tested in isolation so breakage is
  localized and doesn't depend on ChatGPT staying up or unchanged).

**Delivered.** The owner supplied two real, saved ChatGPT snapshots (an empty "new chat" screen
and an active conversation with one exchange), used to verify every selector in
`src/adapters/chatgpt.ts` rather than guessing — including the account's real conversation history
and account/user IDs, none of which are reproduced anywhere in the repo; only the compose-box,
send-button, and message-container structure was extracted, and further trimmed to just the
attributes the adapter's selectors key on for `chatgpt.test.ts` and `e2e/fixtures/chatgpt.html`.

Two real gaps surfaced and were fixed as part of this PR, not deferred:

- ChatGPT's Send button doesn't exist in the DOM at all until the compose box has content (with it
  empty, only "Dictate"/"Start Voice" render) — a button captured once at attach time, the way
  `lib/sendInterceptor.ts` originally worked, would never see it. `sendInterceptor.ts`'s
  `sendButton` option now also accepts a getter function, re-resolved on every click via
  document-level delegation instead of a listener bound to one fixed element (still capture-phase,
  so it keeps the same "wins the race against the site's own handler" guarantee). This is a
  generalization, not a ChatGPT-only special case — any future adapter with the same shape of
  problem can use it too.
- The conversation snapshot confirmed the concern PR 7 raised: ChatGPT re-renders the person's own
  sent message as a bubble (`[data-user-message-bubble]`) right alongside the AI's actual reply
  (`[data-markdown-text-style="assistant-message"]`). Because these are two distinct, verified
  selectors, the adapter can safely tell them apart — `lib/responseRestore.ts` gained an optional
  `responseContainerSelector` to scope restoration to only the second one, and
  `content-scripts/chatgpt.ts` is the first real caller, finally wiring in response restore for a
  site where it's actually safe to do so.

Also added `lib/fixtureTarget.ts`: a `data-guardian-fixture-target` attribute fixture pages set so
that only the content script under test fully attaches to them. Needed once more than one content
script could plausibly load on the same `http://localhost/*` fixture page (the generic fallback
and now the ChatGPT adapter) — without it, `chatgpt.ts`'s unconditional file-upload interceptor was
double-attaching alongside the generic fallback's own on every other fixture, which a real,
observed test failure caught before it shipped. Future adapters (PR 9+) use the same convention.

### PR 9 — Claude.ai + Gemini adapters

- Same pattern as PR 8, one PR covering both since the adapter framework already exists and each
  is a small, isolated addition. Split into two PRs instead if either site's DOM turns out to
  need materially more adapter-specific logic than expected.

**Delivered.** The owner supplied a real, saved Claude.ai conversation snapshot and a real, saved
Gemini conversation snapshot, used to verify every selector in `src/adapters/claude.ts` and
`src/adapters/gemini.ts` the same way as PR 8's ChatGPT adapter — including each account's real
sidebar chat history (both sites) and, for the Gemini snapshot, the account's real email address
in its account menu, none of which are reproduced anywhere in the repo.

Both turned out simpler than ChatGPT in one respect: neither site's send button has ChatGPT's
"doesn't exist until there's text" gap — Claude.ai's stays present at all times (state toggled via
attributes, not by adding/removing the node) and Gemini's likewise appears already present in the
saved snapshot. Both adapters still resolve it via a getter (matching `chatgpt.ts`'s pattern) since
that costs nothing and doesn't assume more about the button's mount behavior than the snapshot
actually verified.

Claude.ai's selectors are `data-testid` attributes (`chat-input`, `chat-input-send`, and the
distinct `user-message`/`assistant-message` pair) — the cleanest, most stable selectors of any
adapter so far. Gemini's are a mix of accessible-name selectors for the compose box and send
button (`[role="textbox"][aria-label="Enter a prompt for Gemini"]`,
`button[aria-label="Send message"]`) and its `<message-content>` custom element for the response,
verified distinct from its `<user-query-content>` element for the person's own sent message - the
same response/sent-message distinction PR 7 and PR 8 required, confirmed again on a third site.

### PR 10 — Copilot web + Character.AI + Perplexity adapters

- Same pattern, remaining sites from CLAUDE.md's example list. Split further if warranted.

**Deferred (owner decision, 2026-09-25).** Blocked on the same real-DOM-snapshot requirement as
PRs 8-9 (CLAUDE.md requires fixture-based adapter tests, not guessed markup) - no snapshots
supplied yet for Copilot web, Character.AI, or Perplexity. Not a blocker for anything else: each of
these three sites is currently served by the generic fallback (content-scripts/generic-fallback.ts)
exactly as it was before PR 8 existed, so nothing regresses or needs rework by skipping ahead - they
simply don't get an adapter's more precise compose-box detection or response restore until this PR
happens. Revisit whenever real snapshots (an empty compose screen plus an active conversation, one
per site) are available, pre- or post-launch; no code-level prerequisite blocks doing this later.

### PR 11 — Hidden-injection page scanner

- Distinct from compose-box detection: scans the **visible page** (e.g. a webpage or document the
  user is about to copy text from) for content hidden from human view but potentially read by an
  AI if pasted — CSS-hidden elements (`display: none`, `visibility: hidden`, zero-size,
  off-screen positioning), tiny/invisible-color text, in addition to the zero-width/bidi
  characters `injection.hidden_text` already catches in plain extracted text.
- Surface a warning (visible indicator) before/if the user copies such content, without silently
  stripping anything — the person decides what to do with the warning.

**Delivered, with an explicit owner-approved permissions decision.** The hidden text this PR
targets can live on _any_ webpage the person might copy from, not just an AI chat page — so unlike
every other content script in this extension, `content-scripts/page-scanner.ts` had to run
site-wide. Before writing any code, the owner was asked to choose between an all-sites content
script, an `activeTab`-only manually-invoked scanner, or narrowing scope to AI-site pages only; the
owner chose the all-sites content script (2026-09-25). `manifest.json` now has a
`"https://*/*", "http://*/*"` content script entry — a real permissions-footprint increase flagged
plainly here since Chrome Web Store review will show "Read and change all your data on all
websites you visit" for it, which nothing else in this extension has needed until now.

`lib/hiddenTextScanner.ts` inspects the DOM (computed style + bounding rect) of whatever the
person's current selection actually spans on `"copy"`, checking for `display:none`,
`visibility:hidden`, near-zero opacity, near-zero font size, foreground color equal to background,
zero-size (clipped) boxes, and off-screen positioning — deliberately heuristic and documented as
narrower than a full contrast-ratio/visibility engine, consistent with this codebase's existing
"honest, narrow, documented gap" pattern elsewhere (e.g. `secret.password`'s known false positive,
`pii.name`'s vault-only reachability). A new `createHiddenTextWarningPanel`
(`lib/interceptionPanel.ts`) shows what was found, with a single "Dismiss" action — there's nothing
to mask, cancel, or retry after a copy has already happened, and CLAUDE.md requires never silently
stripping or blocking, only informing.

### PR 12 — AI site allow/block + visible protection indicator

- Popup/options UI listing known AI sites (from `/rules/ai-domains.json`) with a per-site
  enable/disable toggle, enforced via `declarativeNetRequest` rules generated from that data.
  This is a **self-directed, personal-mode** control in Phase 2 (a person blocking a site for
  themselves) — parent-set blocking policy is Phase 3, once policies can sync from a backend.
- Toolbar icon state + an on-page indicator (e.g. a small badge near the compose box) showing
  protection is active, per the "visible, never covert" principle.
- Detect Edge/Brave and show a one-time notice that built-in browser AI sidebars (Copilot in
  Edge, Brave Leo) are not covered by content-script-based detection, per CLAUDE.md.

**Delivered.** `lib/aiSiteGroups.ts` groups `/rules/ai-domains.json`'s flat (domain, name) entries
by name (ChatGPT and Character.AI each span two domains) so the popup shows one toggle per site the
person recognizes, not one per domain. `lib/blockRules.ts` is the pure, unit-tested function turning
a list of blocked site names into `declarativeNetRequest` block rules (stable per-domain rule IDs,
scoped to `main_frame` navigation only); `background/index.ts` is the thin wiring calling
`chrome.declarativeNetRequest.updateDynamicRules` whenever `chrome.storage.onChanged` fires for the
blocked-sites key. `manifest.json` gained the `declarativeNetRequest` permission.

The popup (`src/popup/`) lists every site with a checkbox, persists a toggle via
`lib/siteSettingsStorage.ts` (a thin `chrome.storage.local` wrapper, deliberately not unit-tested -
exercised instead by e2e/popup.spec.ts in a real browser, including verifying the actual dynamic
rules registered via the background service worker's own `chrome.declarativeNetRequest.getDynamicRules()`).

`lib/protectionBadge.ts` is the on-page indicator: a permanent, unconditional element inserted
right after the compose box (same insert-after-element pattern as the review panels) on every AI
site content script - generic-fallback and all three adapters. The "toolbar icon state" piece is
intentionally minimal: `chrome.action.setTitle` on install, not a dynamic per-tab badge - there was
no clear additional signal to show once Chrome's own "site blocked" page already covers the blocked
case, and a badge here would only add noise ahead of PR 13's real usage-stats badge.

`lib/browserDetection.ts` detects Edge via its `Edg/` user-agent token and Brave via its
`navigator.brave.isBrave()` runtime API (Brave's user agent deliberately mimics Chrome's for
site-compatibility, so UA sniffing alone can't catch it) - both pure and unit-tested with an
injectable `navigator`-shaped object, since jsdom's real `navigator` has no `.brave`. The popup
shows the resulting one-time notice, dismissed and remembered via
`lib/siteSettingsStorage.ts`'s seen-flag.

### PR 13 — Local usage stats

- Local-only counters (per site, per category) of findings/masks over time, shown in the popup.
  Never transmitted anywhere (data-minimization principle) — stored in `chrome.storage.local`,
  with a manual "clear stats" control.

**Delivered.** Counters increment at the discrete moment a review panel is actually shown to the
person, not on every debounced re-scan while typing — `sendInterceptor.ts` gained an `onFindings`
callback (fired whenever a panel appears) and its existing `onMasked` callback now also receives
the triggering findings, so counting "shown" vs. "masked" doesn't need a second detection pass.
`fileUploadInterceptor.ts` gained the equivalent `onFindings` (there's no masked-file equivalent -
a file can only be canceled or uploaded unchanged). All four content scripts (generic-fallback and
the three adapters) wire both into `lib/usageStats.ts`.

The actual per-category counting (`lib/usageStatsTally.ts`) is pure and unit-tested; the
chrome.storage.local read/write around it (`lib/usageStats.ts`) is thin wiring, in the same
deliberately-untested-directly style as `lib/siteSettingsStorage.ts` — exercised instead by
`e2e/popup.spec.ts` triggering a real finding and a real masked send against a fixture page, then
checking the popup's stats table. The popup's "Clear stats" button removes the stored table
entirely; the empty state and the table are mutually exclusive, never both shown.

### PR 14 — Local family-mode scaffolding

- A mode toggle (personal/family) and age-profile setting, stored locally (`chrome.storage.local`
  or `.sync` — decide based on whether "sync across the person's own signed-in Chrome profile" is
  desired even without a backend; default to `.local` to avoid any cross-device data movement
  until Phase 3's real sync exists).
- A **local, device-only encrypted vault** UI (add/edit/remove registered values feeding
  `VaultEntry[]`): encrypted at rest with a locally-set passphrase via WebCrypto (Argon2id/PBKDF2
  - AES-GCM, mirroring the approach CLAUDE.md already specifies for the Phase 3 dashboard's vault
    crypto), even though nothing is synced — the non-negotiable vault-encryption principle applies
    to protecting the data at rest, not just in transit to a server that doesn't exist yet. No new
    dependency expected (WebCrypto is a browser built-in).
- Record this scope choice — and that this vault is expected to be reworked, not necessarily
  reused as-is, once Phase 3 adds real backend sync — as an ADR in `docs/adr/`.

**Delivered.** The owner was asked to choose the key-derivation algorithm before any code was
written (a real privacy-principle decision, not a default): PBKDF2 (native WebCrypto, 600,000
iterations, OWASP's current minimum) over Argon2id, since Argon2id isn't a WebCrypto built-in and
would mean a new dependency for a threat model (device-local access, not remote brute force) that
doesn't clearly need it yet - see `docs/adr/0007-local-vault-crypto-choices.md` for the full
reasoning, including why this is scoped to the local vault only and not a decision about the Phase
3 dashboard's vault. Mode/age-profile/vault all use `chrome.storage.local`, confirmed with the
owner, not `.sync`.

`lib/vaultCrypto.ts` (PBKDF2 + AES-GCM, fresh salt/IV per save) is unit-tested in isolation;
`lib/vaultStorage.ts` and `lib/familyModeStorage.ts` are thin chrome.storage.local wiring,
deliberately not unit-tested directly, exercised instead by `e2e/options.spec.ts` in a real
browser - including asserting the raw passphrase never appears anywhere in stored data. The
options page (`src/options/`) holds the passphrase and decrypted vault contents only in its own
memory for as long as it's open; closing or reloading it is itself a lock.

A real bug surfaced and was fixed during implementation, not just anticipated: clicking "Lock"
immediately after adding or removing a vault entry could clear in-memory state before the
previous save (PBKDF2 alone takes real, human-perceptible time) had finished, silently discarding
the edit - `options/main.ts` now tracks the latest pending save and waits for it before locking.

### PR 15 — Family-mode response flagging in UI

- When family mode is on (from PR 14), run `detect()` on the AI's response text with
  `context.mode: "family"` (activating `content.*` categories) and the local vault from PR 14.
- Visually flag matched spans in the rendered response (reusing PR 4's highlighting approach).
  **No alert is sent anywhere** — there is no parent, backend, or dashboard to send one to yet;
  this is strictly an in-the-moment, on-device signal to whoever is at the keyboard, consistent
  with personal mode's existing behavior. Document this limitation directly in the UI copy so it
  isn't misread as "a parent was notified."

**Delivered.** Full scope, both content-flag categories (Tier 1: self-harm/sexual/violence/
secrecy-from-parents) *and* vault matching (Tier 2) run against the AI's own reply — confirmed with
the owner as the required scope: a monitored conversation's protection has to cover both sides (the
compose box, already covered since PR 4, and the AI's reply, new here), not content-flags alone.

This required a real architecture decision, discussed with the owner before implementation: the
decrypted vault only ever lives in the options page's own JS memory (PR 14), a separate JS context
content scripts on AI sites can't reach at all. The chosen solution — a `chrome.storage.session`
cache of the decrypted vault, populated on unlock/edit only in family mode, with a 15-minute sliding
idle-timeout auto-lock (the same pattern password manager extensions use) — is recorded in
`docs/adr/0007-local-vault-crypto-choices.md`'s addendum, including the alternatives rejected (no
vault-matching on responses at all; re-deriving/re-prompting per tab) and why a manual "Lock now"
button was cut after the owner pushed back on adding UI the person has to think about for a feature
that should just work quietly.

`lib/vaultSessionCache.ts` (the session cache, with unit-tested pure idle-timeout logic),
`lib/familyContext.ts` (builds the `Context` each adapter's scan needs, or `null` when family-mode
detection shouldn't run at all), and `lib/familyResponseFlagging.ts` (the actual DOM scan/flag,
text-node-safe so it never disturbs the response's own rendered HTML) are new. Wired into the
ChatGPT, Claude, and Gemini adapters only — not the generic fallback, for the same reason response
restore (PR 7) isn't: only an adapter's verified response-container selector reliably isolates the
AI's own reply from the site's own echo of what was sent.

The vault (Tier 2) and the vault-free `content.*` categories (Tier 1) are deliberately decoupled in
`lib/familyContext.ts`: the session cache being locked, expired, or never unlocked this browser
session falls back to an empty vault (`vault: []`) rather than disabling detection outright, so
family mode's baseline (vault-free) protection never silently depends on whether the vault happens
to be unlocked right now. A real startup race was found through this work, not just anticipated: a
content script can run before the background worker's `chrome.storage.session.setAccessLevel`
grant (needed at all, since content scripts are "untrusted" contexts for session storage by
default) completes; `getVaultSessionCache()` now treats any such storage-access failure as "cache
unavailable" via try/catch, rather than letting it throw and silently abort the entire scan.

### PR 16 — Store readiness

- Audit final manifest permissions against what's actually used; narrow anywhere possible.
- Privacy disclosure text (what the extension does and doesn't collect/transmit — should be easy
  to write accurately given the on-device-only architecture), single-purpose description, icons,
  and store listing copy for Chrome Web Store and Edge Add-ons, per CLAUDE.md's Distribution
  notes.
- Not a code-heavy PR; mostly config, copy, and assets.

## Open questions for the owner (surface at the relevant PR, not all at once)

- Vite MV3 plugin choice: `@crxjs/vite-plugin` vs `vite-plugin-web-extension` vs a manual
  multi-entry config (PR 0).
- Whether headless Chromium can load an MV3 extension in this environment for CI, or whether a
  virtual display is needed (PR 1).
- The compose-box highlighting technique for `<textarea>` elements (mirrored overlay vs an
  alternative) (PR 4).
- Whether local family-mode settings use `chrome.storage.local` or `.sync` (PR 14).
- Whether any additional AI sites beyond CLAUDE.md's example list should get a named adapter
  before Phase 2 closes out (PRs 8–10).
