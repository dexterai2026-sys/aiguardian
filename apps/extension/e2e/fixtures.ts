import { test as base, chromium, type BrowserContext } from "@playwright/test";
import { fileURLToPath } from "node:url";

const EXTENSION_PATH = fileURLToPath(new URL("../dist", import.meta.url));

// Pre-installed Chromium in this environment's dev containers (see the session's own
// environment notes): PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers. Falls back to Playwright's own
// managed browser (undefined executablePath) elsewhere, e.g. a CI runner that installed its own.
const CHROMIUM_EXECUTABLE_PATH = process.env.PLAYWRIGHT_BROWSERS_PATH
  ? `${process.env.PLAYWRIGHT_BROWSERS_PATH}/chromium`
  : undefined;

/**
 * An MV3 extension only loads via `launchPersistentContext` (not `browser.newPage()`).
 *
 * `headless: true` is required in this environment (no virtual display exists at all -
 * `headless: false` fails outright with "Missing X server or $DISPLAY"), and it works: this
 * Chromium build's default headless mode ("the new headless", not the old
 * extension-incompatible one) does load `--load-extension` and register the background service
 * worker, verified empirically (see e2e/README.md). This means CI needs no virtual display
 * (Xvfb etc.) for this suite - a pleasant surprise, not the assumption docs/phase-2-plan.md
 * started with.
 */
export const test = base.extend<{
  context: BrowserContext;
  extensionId: string;
}>({
  // eslint-disable-next-line no-empty-pattern -- Playwright's fixture API requires this shape.
  context: async ({}, use) => {
    const context = await chromium.launchPersistentContext("", {
      headless: true,
      executablePath: CHROMIUM_EXECUTABLE_PATH,
      args: [`--disable-extensions-except=${EXTENSION_PATH}`, `--load-extension=${EXTENSION_PATH}`],
    });
    await use(context);
    await context.close();
  },

  extensionId: async ({ context }, use) => {
    let [background] = context.serviceWorkers();
    if (!background) {
      background = await context.waitForEvent("serviceworker");
    }
    const extensionId = background.url().split("/")[2]!;
    await use(extensionId);
  },
});

export const expect = test.expect;
