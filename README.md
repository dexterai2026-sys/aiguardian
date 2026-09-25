# Guardian (working name)

[![CI](https://github.com/dexterai2026-sys/aiguardian/actions/workflows/ci.yml/badge.svg)](https://github.com/dexterai2026-sys/aiguardian/actions/workflows/ci.yml)

A tool-agnostic AI safety layer for families and individuals: detects personal information and
prompt-injection content before it reaches an AI, and (in family mode) gives parents
category-only alerts about concerning AI interactions — without ever sending prompt or response
text off the device.

This repository is proprietary. All rights reserved.

See [`CLAUDE.md`](./CLAUDE.md) for the full project overview, architecture, privacy principles,
and development conventions. See [`docs/phase-1-plan.md`](./docs/phase-1-plan.md) for Phase 1's
PR-by-PR history, [`docs/adr/`](./docs/adr/) for significant design decisions, and
[`packages/engine-ts/README.md`](./packages/engine-ts/README.md) for the detection engine's own
docs.

**Status:** Phase 1 (shared detection rules, test corpus, TypeScript engine, CI) — done. See
`CLAUDE.md`'s roadmap for what's next.
