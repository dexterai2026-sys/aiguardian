// Options page stub. Real settings (family mode toggle, age profile, local vault, AI site
// allow/block) land in later Phase 2 PRs.
export {}; // See src/popup/main.ts for why this is needed.

const app = document.querySelector<HTMLDivElement>("#app");
if (app) {
  app.textContent = "Guardian settings — nothing configurable yet.";
}
