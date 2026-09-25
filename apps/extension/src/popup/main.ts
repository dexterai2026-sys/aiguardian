// Popup UI (docs/phase-2-plan.md, PR 12): lists every known AI site (grouped by
// lib/aiSiteGroups.ts) with a per-site allow/block toggle, and a one-time notice for Edge/Brave
// explaining that their built-in AI sidebars (Copilot, Brave Leo) aren't covered by this
// extension's content-script-based detection. Real chrome.storage/chrome.declarativeNetRequest
// wiring lives here and in background/index.ts; the underlying logic (grouping, rule generation,
// browser detection) is pure and unit-tested elsewhere (lib/aiSiteGroups.ts, lib/blockRules.ts,
// lib/browserDetection.ts).
export {}; // Forces module scope: this file and options/main.ts are both ES modules at runtime
// (per their HTML's <script type="module">), but only look like one to TS under a single tsc
// program without this, since neither otherwise has a top-level import/export.

import { getAiSiteGroups, type AiSiteGroup } from "../lib/aiSiteGroups.js";
import { detectBrowser } from "../lib/browserDetection.js";
import {
  getBlockedSites,
  hasSeenBrowserNotice,
  markBrowserNoticeSeen,
  setSiteBlocked,
} from "../lib/siteSettingsStorage.js";

const BROWSER_NOTICE_TEXT: Record<"edge" | "brave", string> = {
  edge: "Edge's built-in Copilot sidebar isn't a regular web page Guardian can inject into, so it isn't protected. Guardian still protects chatgpt.com, claude.ai, and the other sites listed below.",
  brave:
    "Brave's built-in Leo sidebar isn't a regular web page Guardian can inject into, so it isn't protected. Guardian still protects chatgpt.com, claude.ai, and the other sites listed below.",
};

function renderSiteList(
  listElement: HTMLUListElement,
  groups: AiSiteGroup[],
  blockedSites: Set<string>,
): void {
  listElement.innerHTML = "";
  for (const group of groups) {
    const item = document.createElement("li");

    const label = document.createElement("label");
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "guardian-site-toggle";
    checkbox.dataset.site = group.name;
    checkbox.checked = !blockedSites.has(group.name);

    checkbox.addEventListener("change", () => {
      void setSiteBlocked(group.name, !checkbox.checked);
    });

    label.appendChild(checkbox);
    label.append(` ${group.name}`);
    item.appendChild(label);
    listElement.appendChild(item);
  }
}

async function renderBrowserNotice(
  noticeElement: HTMLElement,
  textElement: HTMLElement,
  dismissButton: HTMLButtonElement,
): Promise<void> {
  const [browser, alreadySeen] = await Promise.all([
    detectBrowser(navigator),
    hasSeenBrowserNotice(),
  ]);

  if (alreadySeen || (browser !== "edge" && browser !== "brave")) {
    return;
  }

  textElement.textContent = BROWSER_NOTICE_TEXT[browser];
  noticeElement.hidden = false;
  dismissButton.addEventListener("click", () => {
    noticeElement.hidden = true;
    void markBrowserNoticeSeen();
  });
}

async function init(): Promise<void> {
  const siteList = document.querySelector<HTMLUListElement>("#site-list");
  const browserNotice = document.querySelector<HTMLElement>("#browser-notice");
  const browserNoticeText = document.querySelector<HTMLElement>("#browser-notice-text");
  const browserNoticeDismiss = document.querySelector<HTMLButtonElement>("#browser-notice-dismiss");

  if (siteList) {
    const groups = getAiSiteGroups();
    const blockedSites = await getBlockedSites();
    renderSiteList(siteList, groups, new Set(blockedSites));
  }

  if (browserNotice && browserNoticeText && browserNoticeDismiss) {
    await renderBrowserNotice(browserNotice, browserNoticeText, browserNoticeDismiss);
  }
}

void init();
