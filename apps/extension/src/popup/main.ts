// Popup stub. Real UI (highlight settings, usage stats, AI site allow/block, family-mode
// toggle) lands in later Phase 2 PRs.
export {}; // Forces module scope: this file has no import/export otherwise, so its top-level
// `const` would collide with options/main.ts's under a single tsc program (both are ES modules
// at runtime, per their HTML's <script type="module">, but only look like one to TS with this).

const app = document.querySelector<HTMLDivElement>("#app");
if (app) {
  app.textContent = "Guardian — protection active";
}
