import { test, expect } from "./fixtures.js";
import { startFixtureServer } from "./localServer.js";

/**
 * Vault matching (Tier 2) protecting outgoing text (not just, per PR 15, the AI's own replies) is
 * a real-world bug fix: registering a value in the vault never protected the compose box at all
 * before this, in either mode - see docs/adr/0007-local-vault-crypto-choices.md's addendum on why
 * this was widened, with the owner's sign-off, to cover personal mode too, not just family mode.
 */
async function openOptionsAndAddVaultEntry(
  context: import("@playwright/test").BrowserContext,
  extensionId: string,
  category: string,
  value: string,
): Promise<void> {
  const options = await context.newPage();
  await options.goto(`chrome-extension://${extensionId}/src/options/index.html`);
  await options.locator("#vault-passphrase").fill("correct horse battery staple");
  await options.locator("#vault-unlock").click();
  await expect(options.locator("#vault-unlocked")).toBeVisible();
  await options.locator("#vault-add-category").selectOption(category);
  await options.locator("#vault-add-value").fill(value);
  await options.locator("#vault-add-submit").click();
  await expect(options.locator("#vault-entry-list li")).toHaveCount(1);
}

test("a vault entry highlights when typed into the ChatGPT compose box, in personal mode (the default)", async ({
  context,
  extensionId,
}) => {
  await openOptionsAndAddVaultEntry(context, extensionId, "pii.home_address", "Maple Street");

  const server = await startFixtureServer("./fixtures/chatgpt.html");
  try {
    const page = await context.newPage();
    await page.goto(server.url);
    const compose = page.locator('[role="textbox"]');
    await compose.click();
    await compose.pressSequentially("I live on Maple Street", { delay: 20 });
    // The live vault (lib/liveVault.ts) starts empty and refreshes in the background on the first
    // call - this second keystroke, after a pause, guarantees a detection pass runs after that
    // refresh resolves, rather than racing it.
    await page.waitForTimeout(500);
    await compose.pressSequentially(".", { delay: 20 });

    await expect(page.locator(".guardian-highlight-overlay mark")).toHaveCount(1, {
      timeout: 3000,
    });
  } finally {
    await server.close();
  }
});

test("sending a vault entry from the ChatGPT compose box shows the review panel instead of sending", async ({
  context,
  extensionId,
}) => {
  await openOptionsAndAddVaultEntry(context, extensionId, "pii.home_address", "Maple Street");

  const server = await startFixtureServer("./fixtures/chatgpt.html");
  try {
    const page = await context.newPage();
    await page.goto(server.url);
    const compose = page.locator('[role="textbox"]');
    await compose.click();
    await compose.pressSequentially("I live on Maple Street", { delay: 20 });
    await page.waitForTimeout(500);
    await compose.pressSequentially(".", { delay: 20 });
    await page.waitForTimeout(400); // past the compose-box's own detection debounce

    await page.locator('button[aria-label="Send"]').click();

    await expect(page.locator(".guardian-interception-panel")).toBeVisible();
    await expect(page.locator("[data-user-message-bubble]")).toHaveCount(0);
  } finally {
    await server.close();
  }
});
