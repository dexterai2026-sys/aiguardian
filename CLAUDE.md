# CLAUDE.md

This file gives Claude Code the context it needs to work on this project. Read it fully at the start of every session. Keep it current: when a phase completes or a decision changes, update the relevant section in the same PR.

## Project overview

**Working name:** Guardian (placeholder, will be renamed)

Guardian is a tool-agnostic AI safety layer for families and individuals. It protects people while they use any AI app or website by:

1. Detecting personal information (PII) before it is sent to an AI, and offering to mask it.
2. Warning about hidden prompt-injection content aimed at AI tools.
3. In family mode, flagging concerning AI responses and giving parents category-only alerts.
4. Showing and controlling which AI services are used on a device.

Most people, especially kids, do not understand the risks of sharing personal data with AI or how prompt injection works. Guardian protects them in the moment and teaches them why, without requiring them to change which AI tools they use.

### Target users (in priority order)

1. **Families:** parents protecting children ages roughly 9–17.
2. **Schools:** managed Chromebooks where the extension can be force-installed.
3. **Individual adults:** personal privacy coaching.

## Non-negotiable privacy principles

These rules override convenience, features, and deadlines. If a task seems to require breaking one, stop and ask the owner.

- **Prompt and response text never leaves the device.** All detection runs locally on each endpoint. No typed text, pasted text, AI response text, or file content is ever sent to our backend or any third party.
- **Alerts are category-only.** An alert says _what kind_ of event happened, where, and when (e.g., `pii.home_address`, `android`, timestamp), never the content. The database schema must make storing content impossible (enum categories, no free-text payload fields).
- **The protected-values vault is end-to-end encrypted.** It is encrypted on-device with a key derived from the family passphrase. The server stores ciphertext only and can never decrypt it. A lost passphrase means a lost vault, by design.
- **Never inspect password fields**, fields flagged as incognito/no-personalized-learning, or payment fields in non-AI contexts.
- **No third-party analytics or advertising SDKs** in any endpoint. Crash reporting must be opt-in for release builds and scrubbed of any user text.
- **Visible, never covert.** Every endpoint shows a clear indicator that protection is active. Adult (personal) mode is self-installed and reports to no one. Family mode is for devices a parent manages. Never build features that hide the product from the person using the device.
- **Data minimization.** Collect the least data needed. Children's data is subject to COPPA; treat all family-mode data as sensitive.

## Architecture

Hub-and-spoke. Endpoints never talk to each other; each talks only to the backend.

```
[Browser extension]   [Android app]   [Desktop app (later)]
        \                  |                  /
         \   policies, vault ciphertext,     /
          \  rule updates  ↓   ↑  alerts,   /
           \                   heartbeats  /
            -------- [Family backend] ------
                            |
                   [Parent dashboard]
```

- **Endpoints** run the detection engine locally and make all protection decisions in real time. They must keep working offline or if the backend is down.
- **Down to devices:** policies (strictness, blocked/allowed AI services, age profile), rule and AI-domain-list updates, encrypted vault.
- **Up from devices:** category-only alert events and heartbeats (every few minutes, "protection active"). Missing heartbeats trigger a "protection disabled" alert to the parent.

## Repository layout

```
/rules                 Shared detection rules and AI domain lists (data, not code)
/test-corpus           Shared labeled test prompts (JSONL) every engine must pass
/packages/engine-ts    TypeScript detection engine (extension, dashboard)
/apps/extension        Chrome/Edge/Brave extension (Manifest V3)
/apps/backend          Supabase: migrations, RLS policies, edge functions
/apps/dashboard        Parent web dashboard
/android               Android app: keyboard + DNS VPN (Phase 4)
/desktop               Tauri desktop app (Phase 5)
/docs                  Architecture notes, decisions (ADRs), store policy notes
/.github/workflows     CI: tests, builds, APK and desktop builds
```

## Detection engine

The engine is implemented separately per platform (TypeScript first, then Kotlin, then Rust). Consistency is guaranteed by **shared rule data in `/rules`** and **the shared test corpus in `/test-corpus`**. Every implementation must pass the same corpus. Never change engine behavior in one implementation without updating the corpus and the other implementations (or opening an issue for them).

### Interface (conceptual, same across languages)

```
detect(text, context) -> Finding[]
  context: { appId, siteId, mode: "personal" | "family", ageProfile, vault }
  Finding: { category, start, end, confidence, tier, suggestedPlaceholder }

mask(text, findings) -> { maskedText, restoreMap }
restore(text, restoreMap) -> text
```

- `restoreMap` lives in memory only for the current conversation. Never persist or transmit it.
- Placeholders are readable and numbered: `[NAME_1]`, `[SCHOOL_1]`, `[ADDRESS_1]`.

### Tiers

1. **Pattern rules:** regexes with validation (Luhn for cards, SSN format rules, phone numbers via libphonenumber or equivalent, emails, street addresses, API keys/secrets).
2. **Personal vault:** exact and fuzzy matching against user-registered values (child's name, school, street, team, siblings). Highest-value tier for families.
3. **On-device ML (later):** named-entity model for names and locations not in the vault. ML Kit Entity Extraction on Android; ONNX/transformers.js in the browser. Not in Phase 1.

### Category enum (initial)

`pii.name`, `pii.home_address`, `pii.school`, `pii.phone`, `pii.email`, `pii.ssn`, `pii.payment_card`, `pii.bank_account`, `pii.dob`, `pii.medical`, `pii.government_id`, `secret.api_key`, `secret.password`, `vault.match`, `injection.hidden_text`, `injection.instruction_pattern`, `content.self_harm`, `content.sexual`, `content.secrecy_from_parents`, `content.violence`.

Add categories only by updating this list, the shared rules, the corpus, and the backend enum together.

### Initial quality targets

- Tier 1 precision ≥ 0.95 on the corpus; recall ≥ 0.90 for structured PII (cards, SSNs, phones, emails).
- Tier 1 + 2 latency < 20 ms for 2,000 characters on a mid-range device. Detection must never make typing feel slow; debounce and run off the main thread where possible.
- Report precision/recall per category in CI output.

### Test corpus format

`/test-corpus/*.jsonl`, one case per line:

```json
{
  "id": "addr-001",
  "text": "we live at 42 Maple Street",
  "expected": [{ "category": "pii.home_address", "start": 11, "end": 26 }],
  "notes": "basic street address"
}
```

Include hard negatives (text that looks like PII but is not), realistic kid and adult phrasing, and multi-finding cases.

## Components and tech stack

### Browser extension (`/apps/extension`), Phase 2

- TypeScript, Manifest V3, Vite build. Same build targets Chrome, Edge, Brave (and other Chromium browsers). Firefox port later.
- **Content scripts** on AI sites: per-site adapters (ChatGPT, Claude, Gemini, Copilot web, Character.AI, Perplexity, etc.) plus a **generic fallback** for chat-style text boxes on AI-related sites.
- Features: real-time highlighting, send interception (mask / edit / send anyway), paste and text-file upload scanning, response restore of masked values, hidden-injection page scanner, family-mode response flagging, AI site allow/block via `declarativeNetRequest`, usage stats, heartbeats.
- Detect Edge/Brave and inform users that built-in browser AI sidebars are not covered.
- Site adapters will break when AI sites change their layouts. Keep adapters isolated, small, and covered by fixture-based tests so breakage is easy to find and fix.

### Backend (`/apps/backend`), Phase 3

- Supabase (Postgres, Auth, Edge Functions). All schema changes via migrations in the repo.
- **Row Level Security on every table**, no exceptions. Include RLS tests.
- Core tables: `families`, `members`, `devices`, `pairing_codes`, `policies`, `vault_blobs` (ciphertext only), `alerts` (enum category, device, timestamp; no content fields), `heartbeats`, `rule_versions`.
- Device pairing via short-lived codes / QR.
- Push notifications for alerts (e.g., FCM / web push).

### Parent dashboard (`/apps/dashboard`), Phase 3

- React + TypeScript + Vite, deployed to Vercel or Netlify from GitHub.
- Features: family setup, device pairing, policy settings, vault management (encrypt/decrypt client-side only), alert feed, device protection status.
- Vault crypto in the browser via WebCrypto: key derived from passphrase (Argon2id preferred, PBKDF2 fallback), AES-GCM encryption.

### Android app (`/android`), Phase 4

- Kotlin, Jetpack Compose, multi-module Gradle (`:core-detection`, `:keyboard`, `:vpn`, `:app`).
- Keyboard: fork of FlorisBoard (Apache 2.0) with a protection layer via `InputMethodService`. Do not use GPL-licensed code.
- DNS-only VPN via `VpnService` for AI service visibility and blocking.
- Room + SQLCipher for encrypted local logs, DataStore for settings, Android Keystore for keys, WorkManager for background updates.
- Built-in debug screen showing the app's own logs (debug builds).
- Accessibility service is **Phase 6** and ships only in the direct-download edition, never in the Play Store build, unless policy review says otherwise.

### Desktop app (`/desktop`), Phase 5

- Tauri (Rust core + web UI). Windows first, then macOS.
- UI Automation (Windows) / Accessibility API (macOS) to read AI app text; send interception scoped only to AI apps in focus; clipboard checks; DNS filtering; optional Edge/Brave AI policy application; runs as a service so standard (child) accounts cannot disable it.
- Rust implementation of the detection engine passing the shared corpus.

## Roadmap and current status

| Phase | Scope                                                                  | Status          |
| ----- | ---------------------------------------------------------------------- | --------------- |
| 1     | Shared rules, test corpus, TypeScript engine (Tiers 1–2), CI           | **In progress** |
| 2     | Browser extension (personal mode first, then family hooks)             | Not started     |
| 3     | Backend + parent dashboard, pairing, alerts, heartbeats                | Not started     |
| 4     | Android app (keyboard + DNS VPN), APK via GitHub Actions               | Not started     |
| 5     | Desktop app (Windows, then macOS)                                      | Not started     |
| 6     | Android accessibility (direct-download edition), ML tier, iOS research | Not started     |

Update this table when phases start or finish.

## Development environment

- Work happens primarily in **Claude Code cloud sessions** on Anthropic-managed VMs, connected to this GitHub repo. The owner prefers not to install development tools locally.
- There is **no Android emulator or physical device** available to Claude. Android builds run in GitHub Actions; the owner installs APKs on a real phone and reports results. Design Android work so that as much as possible is verifiable through unit tests and CI emulator tests.
- The owner tests the extension by loading the built extension unpacked in Chrome.
- Prefer tasks and designs that can be verified by automated tests in the cloud session.

## Tooling and conventions

- **Monorepo:** pnpm workspaces for all TypeScript packages.
- **TypeScript:** `strict: true`. No `any` without a comment explaining why.
- **Testing:** Vitest for TypeScript units; Playwright for extension end-to-end tests (Chromium with the extension loaded); JUnit for Kotlin; `cargo test` for Rust. Every change ships with tests.
- **Linting/formatting:** ESLint + Prettier (TS), ktlint (Kotlin), rustfmt + clippy (Rust).
- **Commits:** Conventional Commits (`feat:`, `fix:`, `test:`, `docs:`, `chore:`).
- **PRs:** small and focused, one concern per PR, with a short description of what changed and how it was tested.
- **Decisions:** record significant architectural decisions as short ADRs in `/docs/adr/`.

## Rules for Claude

- Read this file and any relevant `/docs` before starting a task.
- **Ask before** adding a new dependency, adding any third-party service or SDK, changing the category enum, or changing anything touching the privacy principles.
- Never commit secrets. Use environment variables and document required ones in `.env.example`.
- Never add code that logs, stores, or transmits user text outside the local detection path, including in debug logging. Debug logs record events and categories, not content.
- When a task is ambiguous, state your assumption in the PR description rather than guessing silently.
- Keep this file up to date as part of the work.

## Licensing

This repository is proprietary. All rights reserved — no open-source license is granted. Do not add a `LICENSE` file implying otherwise, and do not include dependencies whose license terms would require this repository's source to be disclosed or relicensed (e.g., GPL-family licenses) without first asking the owner.

## Distribution notes (keep in mind from day one)

- **Chrome Web Store / Edge Add-ons:** clear single-purpose description, minimal permissions, accurate privacy disclosures.
- **Google Play:** keyboard is standard; `VpnService` requires a declaration (parental control / device security use); accessibility is high-risk and excluded from the Play build. Position the app for parents and adults, not as a children's app, to avoid Families-policy scope.
- **Android developer verification** applies to direct-download builds too; the owner will complete developer verification.
- **Desktop:** code signing required (Apple Developer ID + notarization; Windows signing service).
