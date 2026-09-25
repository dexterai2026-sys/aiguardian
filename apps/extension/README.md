# @guardian/extension

Guardian's browser extension: Manifest V3, built with Vite (via `vite-plugin-web-extension`).
Targets Chrome, Edge, and Brave — see `docs/adr/` for why that plugin was chosen over the
alternatives considered.

**Status:** scaffolding only (Phase 2 PR 0). No detection logic is wired up yet — see
`docs/phase-2-plan.md` for what's coming.

## Building

```sh
pnpm --filter @guardian/extension build     # or: pnpm build (from the repo root)
```

Output goes to `apps/extension/dist/`.

## Loading unpacked in Chrome (or Edge/Brave)

This is how the extension is tested during development — there's no packaged `.crx` build yet.

1. Run the build above.
2. Open `chrome://extensions` (or the equivalent `edge://extensions`, `brave://extensions`).
3. Enable **Developer mode** (top-right toggle).
4. Click **Load unpacked** and select `apps/extension/dist`.
5. After a code change, re-run the build, then click the refresh icon on the extension's card in
   `chrome://extensions` to pick up the new build. (`pnpm dev` gives faster rebuilds during
   development, but you still need to click refresh on the extension card — Vite dev-server HMR
   doesn't reach into a loaded extension the way it does a normal web page.)

## Structure

- `manifest.json` — the Manifest V3 manifest. `vite-plugin-web-extension` reads the source paths
  in here (e.g. `background.service_worker: "src/background/index.ts"`) and rewrites them to the
  built output paths in `dist/manifest.json` automatically.
- `src/background/` — the background service worker.
- `src/popup/` — the toolbar popup (`action.default_popup`).
- `src/options/` — the full-page settings UI (`options_page`).

Content scripts, once added (Phase 2 PR 3+), get their own `src/content-scripts/` directory and
manifest entries following the same pattern.
