# ADR 0006: Deferred - self-healing / self-discovering site adapters

**Status:** Deferred (raised during Phase 2 planning, PRs 0-3; not scheduled)

## Context

While discussing Phase 2's per-site adapters (PRs 8-10) and their known maintenance burden -
CLAUDE.md itself flags that "site adapters will break when AI sites change their layouts" - the
idea came up of having the extension improve its own site-detection over time rather than relying
solely on hand-written adapters: locally noticing which element on a given site reliably turns out
to be the real compose box, and potentially sharing that discovery across the install base so the
product gets more accurate at covering new or changed AI sites without a developer writing a new
adapter for each one.

This is a genuinely appealing idea - it directly addresses the adapter-maintenance problem the
architecture already anticipates, and framed as "the app gets smarter as more people use it," it's
a real potential product differentiator. It's recorded here, deferred rather than rejected, so the
reasoning isn't lost and doesn't need to be re-derived from scratch later.

## Why it's not being built now

Two independent reasons, of different character:

1. **No evidence it's needed yet.** PR 3's generic fallback (largest-visible
   `<textarea>`/`[contenteditable]`) just shipped. There's no data yet showing it actually picks
   the wrong element often enough, on real sites, to justify the complexity below. Building
   self-improvement logic against a hypothetical failure mode risks solving a problem that may not
   materialize, or solving the wrong version of it.

2. **The valuable version of this idea (cross-user sync) runs directly into CLAUDE.md's first
   non-negotiable privacy principle**: "no typed text, pasted text, AI response text, or file
   content is ever sent to our backend or any third party." A system that uploads _structural_
   information about a page (element shapes, selectors, attributes - never conversation content)
   to help other users' extensions is technically distinguishable from that principle, but close
   enough to it that it is not a decision to make unilaterally in an engineering PR. It needs
   explicit sign-off from the project owner, treated with the same weight as any other
   privacy-principle-adjacent change.

A third, smaller concern even for a purely **local** (non-synced) version: caching a
previously-successful guess per site trades today's stateless design (the same pure heuristic
function runs fresh on every page load, which is why it's been simple to reason about and test)
for a stateful one with real new failure modes - a cached selector going stale after a site
redesign and confidently pointing at the wrong element, which could be worse than the fresh
heuristic simply re-adapting on its own every time. That's added code surface and test cases
(cache hit/valid, cache hit/stale, cache miss, invalidation), not a performance concern - the
heuristic scan itself is already cheap (single-digit milliseconds, behind a 300ms debounce), so
caching would buy accuracy at the cost of complexity, not speed.

## What would change this

- **Local self-improvement** (no sync, no new privacy question) becomes worth considering once
  there's actual evidence - from real usage of PRs 3 and 8-10 together - that the generic fallback
  or the named adapters are getting the wrong element often enough to matter. If built, it needs a
  staleness/invalidation check from the start, not added after the first bad cache hit ships.
- **Cross-user sync of discovered adapters** is a separate, later, larger decision that depends on
  (a) local self-improvement already proving valuable, and (b) the project owner explicitly
  deciding the structural-data-only upload is an acceptable, well-scoped exception worth building
  carefully (anonymized fingerprints only, human review before anything is promoted into the
  existing `/rules`/`rule_versions` distribution mechanism CLAUDE.md's backend already plans for -
  never an automatic, unreviewed push to the install base). Nothing here should be read as
  pre-approval for that; it is explicitly the owner's call, not an engineering default.

## Consequences

- Phase 2 proceeds with hand-written adapters (PRs 8-10) and the stateless generic fallback (PR 3)
  as already planned, with no self-improvement logic.
- If adapter breakage or fallback misfires become a real, measured problem later, this ADR is
  where to start rather than a blank page - and it should be updated (or superseded) with the
  actual decision made at that point, not silently overridden.
