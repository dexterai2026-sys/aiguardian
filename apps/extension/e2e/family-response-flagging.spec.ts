import { test, expect } from "./fixtures.js";
import { startFixtureServer } from "./localServer.js";

async function openOptions(
  context: import("@playwright/test").BrowserContext,
  extensionId: string,
) {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/src/options/index.html`);
  return page;
}

async function enableFamilyModeWithVaultEntry(
  options: import("@playwright/test").Page,
  category: string,
  value: string,
): Promise<void> {
  await options.locator("#mode-family").check();
  await options.locator("#vault-passphrase").fill("correct horse battery staple");
  await options.locator("#vault-unlock").click();
  await expect(options.locator("#vault-unlocked")).toBeVisible();
  await options.locator("#vault-add-category").selectOption(category);
  await options.locator("#vault-add-value").fill(value);
  await options.locator("#vault-add-submit").click();
  await expect(options.locator("#vault-entry-list li")).toHaveCount(1);
}

/** Checking the mode radio fires an async chrome.storage.local write (options/main.ts's
 * onModeChange) - waits for it to actually land before proceeding, rather than racing a new tab's
 * content script (which reads mode fresh on every scan) against that write. */
async function waitForModeToPersist(
  context: import("@playwright/test").BrowserContext,
  mode: "personal" | "family",
): Promise<void> {
  const [background] = context.serviceWorkers();
  await expect
    .poll(
      async () =>
        (await background!.evaluate(() => chrome.storage.local.get("guardianMode"))).guardianMode,
    )
    .toBe(mode);
}

async function simulateAiResponse(
  page: import("@playwright/test").Page,
  text: string,
): Promise<void> {
  await page.evaluate((responseText) => {
    (window as unknown as { simulateAiResponse(text: string): void }).simulateAiResponse(
      responseText,
    );
  }, text);
}

test("flags a vault entry the AI echoes back, once family mode is on and the vault has that entry", async ({
  context,
  extensionId,
}) => {
  const options = await openOptions(context, extensionId);
  await enableFamilyModeWithVaultEntry(options, "pii.home_address", "Maple Street");

  const server = await startFixtureServer("./fixtures/chatgpt.html");
  try {
    const page = await context.newPage();
    await page.goto(server.url);
    await simulateAiResponse(page, "You mentioned Maple Street earlier.");

    await expect(page.locator(".guardian-family-flag")).toBeVisible({ timeout: 3000 });
    const mark = page.locator(".guardian-family-flag");
    await expect(mark).toHaveAttribute("data-category", "vault.match");
    await expect(mark).toHaveText("Maple Street");
  } finally {
    await server.close();
  }
});

test("flags a concerning content-category phrase, needing no vault entry at all", async ({
  context,
  extensionId,
}) => {
  const options = await openOptions(context, extensionId);
  await options.locator("#mode-family").check();
  await waitForModeToPersist(context, "family");

  const server = await startFixtureServer("./fixtures/chatgpt.html");
  try {
    const page = await context.newPage();
    await page.goto(server.url);
    await simulateAiResponse(page, "Sure, this stays between us.");

    await expect(page.locator(".guardian-family-flag")).toBeVisible({ timeout: 3000 });
    await expect(page.locator(".guardian-family-flag")).toHaveAttribute(
      "data-category",
      "content.secrecy_from_parents",
    );
  } finally {
    await server.close();
  }
});

test("never flags anything in personal mode (the default)", async ({ context, extensionId }) => {
  // No options page interaction at all - personal mode is the default.
  void extensionId;
  const server = await startFixtureServer("./fixtures/chatgpt.html");
  try {
    const page = await context.newPage();
    await page.goto(server.url);
    await simulateAiResponse(page, "Sure, this stays between us.");
    await page.waitForTimeout(1000);

    await expect(page.locator(".guardian-family-flag")).toHaveCount(0);
  } finally {
    await server.close();
  }
});

test("never flags vault content in family mode if the vault was never unlocked this session", async ({
  context,
  extensionId,
}) => {
  const options = await openOptions(context, extensionId);
  await options.locator("#mode-family").check();
  await waitForModeToPersist(context, "family");
  // Family mode is on, but the vault itself is never unlocked here.

  const server = await startFixtureServer("./fixtures/chatgpt.html");
  try {
    const page = await context.newPage();
    await page.goto(server.url);
    await simulateAiResponse(page, "You mentioned Maple Street earlier.");
    await page.waitForTimeout(1000);

    await expect(page.locator(".guardian-family-flag")).toHaveCount(0);
  } finally {
    await server.close();
  }
});

test("never flags the person's own echoed sent message, only the AI's reply", async ({
  context,
  extensionId,
}) => {
  const options = await openOptions(context, extensionId);
  await enableFamilyModeWithVaultEntry(options, "pii.home_address", "Maple Street");

  const server = await startFixtureServer("./fixtures/chatgpt.html");
  try {
    const page = await context.newPage();
    await page.goto(server.url);

    const compose = page.locator('[role="textbox"]');
    await compose.click();
    await compose.pressSequentially("I live on Maple Street", { delay: 20 });
    await page.locator('button[aria-label="Send"]').click();
    await page.waitForTimeout(1000);

    await expect(page.locator(".guardian-family-flag")).toHaveCount(0);
    await expect(page.locator("[data-user-message-bubble]")).toHaveText("I live on Maple Street");
  } finally {
    await server.close();
  }
});
