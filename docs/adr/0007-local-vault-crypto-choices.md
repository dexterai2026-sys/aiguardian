# ADR 0007: Local vault crypto choices (PR 14)

**Status:** Accepted (Phase 2, PR 14)

## Context

CLAUDE.md's non-negotiable privacy principles require the protected-values vault to be encrypted
at rest with a key derived from a passphrase, and state that a lost passphrase means a lost vault
by design. Phase 3's dashboard vault is the canonical case this was written for, but
`docs/phase-2-plan.md`'s PR 14 calls for a **local, device-only** vault now, in the browser
extension itself, before any backend exists - the same at-rest-encryption principle applies to
protecting this data on disk, not just in transit to a server that doesn't exist yet.

This meant a real decision, not a default: CLAUDE.md's own wording for the dashboard vault says
"Argon2id preferred, PBKDF2 fallback." Argon2id isn't a WebCrypto built-in, so using it here would
mean adding a new dependency (a WASM Argon2id library), which itself needs approval under
CLAUDE.md's "ask before adding a dependency" rule. This ADR was discussed with, and the choice
below made by, the project owner before any code was written.

## Decision: PBKDF2 (native WebCrypto), not Argon2id, for the local extension vault

- **Key derivation:** PBKDF2-HMAC-SHA256, 600,000 iterations (OWASP's current, 2023, minimum
  recommendation), via `crypto.subtle` - no new dependency.
- **Encryption:** AES-GCM, 256-bit key, a fresh random salt and IV generated on every save (never
  reused across saves, even for identical plaintext under the same passphrase).
- **Storage format** (`lib/vaultCrypto.ts`'s `EncryptedVaultBlob`, persisted via
  `lib/vaultStorage.ts` in `chrome.storage.local`): base64 `salt`, `iv`, `ciphertext`, and the
  `iterations` count used, so a future iteration-count increase doesn't break decrypting
  already-saved vaults. The passphrase itself, and the decrypted vault contents, are held only in
  the options page's own memory for as long as it stays open (see `options/main.ts`) - never
  written to storage, `chrome.storage.session`, or any dataset attribute.

**Why not Argon2id now:** the realistic threat model for this vault is someone with access to the
device itself, or to a copy of the encrypted blob - not a remote attacker who can run unlimited
guesses against a network service. PBKDF2 at this iteration count is a solid, standards-based
answer to that threat model, ships with zero new dependencies (important for a browser extension's
bundle size and Chrome Web Store review surface, per CLAUDE.md's Distribution notes), and is
already the accepted fallback CLAUDE.md itself names for exactly this kind of tradeoff.

**Decision, not closed:** revisit Argon2id specifically for the Phase 3 dashboard vault, where the
stakes are meaningfully different - that vault's ciphertext lives on a server (a more attractive,
reachable target than a single device), a whole family shares one passphrase, and a dashboard's JS
bundle already routinely includes heavier dependencies than a browser extension's content
scripts/background worker do. This ADR does not decide that case; it only accepts PBKDF2 for the
local, device-only vault described here.

## Decision: `chrome.storage.local`, not `.sync`, for mode/age-profile/vault storage

Matches `lib/siteSettingsStorage.ts`'s existing reasoning (the site allow/block list) and
`docs/phase-2-plan.md`'s own stated default for PR 14: avoids any cross-device data movement before
Phase 3's real backend sync exists, and sidesteps `chrome.storage.sync`'s ~100KB total quota, which
a vault with more than a handful of entries could plausibly approach.

## Decision: no passphrase recovery mechanism

Per CLAUDE.md's explicit design intent, forgetting the passphrase means the vault's contents are
permanently unrecoverable - there is no "reset" that preserves existing entries, only starting a
new, empty vault (`lib/vaultStorage.ts`'s `deleteVault()`). This was confirmed with the project
owner as an accepted tradeoff, not an oversight, before implementing PR 14.

## Consequences

- This vault is expected to be **reworked, not necessarily reused as-is**, once Phase 3 adds real
  backend sync and a shared family passphrase - this ADR's PBKDF2 choice is scoped to the local,
  single-device case only, per the "why not Argon2id now" reasoning above.
- `lib/vaultCrypto.ts` is unit-tested in isolation (round-trip, wrong passphrase, tampered
  ciphertext via AES-GCM's authentication tag, fresh salt/IV per save, non-ASCII plaintext); the
  chrome.storage.local wiring around it is exercised by `e2e/options.spec.ts` in a real browser,
  including asserting the raw passphrase never appears anywhere in stored data.
- A real bug was found and fixed while implementing this, not just anticipated: clicking "Lock"
  immediately after adding or removing a vault entry could clear the in-memory vault state before
  the previous save (PBKDF2 alone takes real, human-perceptible time) had finished, silently
  discarding the edit. `options/main.ts` now tracks the latest pending save and waits for it before
  actually locking.

## Addendum (PR 15): a session-only cache so content scripts can read the vault too

PR 15 (family-mode response flagging) needs to check the AI's own replies against the vault (Tier
2), not just the person's own outgoing text. But the decrypted vault only ever exists in the
options page's own JS memory (per the decision above) - a separate, unreachable JS context from the
content scripts running on chatgpt.com, claude.ai, etc. This is the same kind of real tradeoff as
the PBKDF2-vs-Argon2id choice above, so it went through the same explicit-discussion process with
the project owner before implementation, not a default picked silently.

**Options considered:**

- **Do nothing; scope PR 15 to content-flag categories only, skip vault-matching on responses.**
  Rejected: the owner's explicit ask was that both sides of a monitored conversation be protected,
  including vault matches (a parent's whole reason to register a child's address/school in the
  vault is to catch it coming back from either direction).
- **Re-derive/decrypt the vault inside every content script.** Rejected: would mean either passing
  the passphrase to content scripts (defeating the point of scoping it to the options page) or
  re-prompting for it on every AI site tab, which fails the "no extra hardship on the user, must
  not feel bulky" requirement.
- **Cache the decrypted vault in `chrome.storage.session`, populated once on unlock.** Chosen. This
  is memory-only storage (cleared automatically on full browser close, never written to disk), and
  it's what makes decrypted vault contents reachable from a content script's separate JS context at
  all.

**Decision: `chrome.storage.session`, with an "unlock once, auto-lock on inactivity" sliding
expiration - the same pattern password manager extensions use for exactly this problem.**

- Populated by `options/main.ts` only when family mode is on, right after a successful unlock and
  after every vault edit (add/remove entry) - personal-mode users get zero additional exposure from
  this cache existing at all.
- `lib/vaultSessionCache.ts` auto-expires the cache after 15 minutes of no reads (`IDLE_TIMEOUT_MS`,
  a sliding window - every read extends it), so active use is never interrupted but the cache
  reliably clears itself if the person walks away. A manual "Lock now" button was considered and
  explicitly rejected by the owner: it would be UI the person has to think about for a feature that
  should just work quietly in the background, and the idle timeout already covers the real risk
  (the device being left unattended) without asking anything of the user.
- The options page's own "Lock" button (locking that page's own in-memory view) deliberately does
  **not** clear this cache - the two have independent lifetimes by design, since locking the options
  page is a per-tab UI action, not a statement that family-mode protection on other open AI-site
  tabs should stop working until the owner re-opens options and re-unlocks.
- By default, `chrome.storage.session` is readable only from "trusted" extension contexts (the
  background service worker, extension pages) - content scripts count as "untrusted" for this
  purpose even though they're this same extension's own code, and can't read it at all until
  `background/index.ts` calls `chrome.storage.session.setAccessLevel({accessLevel:
  "TRUSTED_AND_UNTRUSTED_CONTEXTS"})`.
- The vault (Tier 2) and the vault-free `content.*` categories (self-harm/sexual/violence/secrecy,
  Tier 1) are deliberately decoupled (`lib/familyContext.ts`): the cache being locked, expired, or
  simply never unlocked this browser session must not also silently disable the vault-free content
  categories, which need no vault at all. A real startup race was found this way, not just
  anticipated: a content script can run before the background worker's `setAccessLevel` grant has
  completed, so `lib/vaultSessionCache.ts`'s reads are wrapped in a try/catch that treats any
  storage-access failure the same as "cache unavailable" (`null`), rather than letting it throw and
  silently abort the entire scan (vault-free categories included).

This addendum does not change any decision above it - PBKDF2, `chrome.storage.local` for the
encrypted-at-rest blob, and no recovery mechanism all stand as originally decided. It only adds a
second, deliberately weaker-lived, memory-only copy of the *decrypted* vault, scoped to family mode
and to the current browser session.
