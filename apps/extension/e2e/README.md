# Extension e2e tests (Playwright)

## Why `launchPersistentContext`, not `browser.newPage()`

A Manifest V3 extension only loads into a real browser profile via
`chromium.launchPersistentContext()` with `--load-extension`/`--disable-extensions-except`
pointed at the built `dist/` directory — see `fixtures.ts`. `test.extend` there also exposes
`extensionId`, read off the background service worker's URL, for tests that need to open an
extension page directly (e.g. the popup, via `chrome-extension://<id>/src/popup/index.html`).

## Headless: it works here, but verify before assuming it does elsewhere

This environment has no virtual display at all (`$DISPLAY` unset) — `headless: false` fails
immediately with "Missing X server or \$DISPLAY", before ever getting to the extension. The
concern going in (per `docs/phase-2-plan.md`'s open question) was the opposite: that headless
mode might not support loading extensions at all, historically true for Chrome's old headless
mode.

Verified empirically instead of assumed: with `headless: true`, this Chromium build's **default**
headless mode is the newer one ("headless: new" internally), which does support
`--load-extension` and does register the background service worker — the smoke test
(`smoke.spec.ts`) passes. So no virtual display (Xvfb, etc.) is needed for this suite, in CI or
locally, at least with this Chromium version. If a future Playwright/Chromium upgrade changes
this, this suite will fail loudly (the fixture throws if no service worker registers), not
silently pass against a broken setup.

## Running

```sh
pnpm --filter @guardian/extension build   # e2e tests run against the built dist/, not source
pnpm --filter @guardian/extension test
```

The extension must be rebuilt before running the suite if source files changed — Playwright loads
whatever's currently in `dist/`, it doesn't trigger a build itself.
