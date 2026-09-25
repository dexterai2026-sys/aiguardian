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
