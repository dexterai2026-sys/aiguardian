import { test, expect } from "./fixtures.js";

async function openPopup(context: import("@playwright/test").BrowserContext, extensionId: string) {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/src/popup/index.html`);
  return page;
}

test("lists every known AI site, each allowed by default", async ({ context, extensionId }) => {
  const page = await openPopup(context, extensionId);

  const toggles = page.locator(".guardian-site-toggle");
  await expect(toggles).toHaveCount(8); // one per distinct site name in rules/ai-domains.json
  for (const toggle of await toggles.all()) {
    await expect(toggle).toBeChecked();
  }
  await expect(page.locator("#site-list")).toContainText("ChatGPT");
  await expect(page.locator("#site-list")).toContainText("Claude");
});

test("unchecking a site persists as blocked across a popup reopen", async ({
  context,
  extensionId,
}) => {
  const page = await openPopup(context, extensionId);
  await page.locator('.guardian-site-toggle[data-site="ChatGPT"]').uncheck();

  const reopened = await openPopup(context, extensionId);
  await expect(reopened.locator('.guardian-site-toggle[data-site="ChatGPT"]')).not.toBeChecked();
  // Every other site stays allowed - unchecking one doesn't affect the rest.
  await expect(reopened.locator('.guardian-site-toggle[data-site="Claude"]')).toBeChecked();
});

test("re-checking a previously blocked site re-allows it", async ({ context, extensionId }) => {
  const page = await openPopup(context, extensionId);
  await page.locator('.guardian-site-toggle[data-site="ChatGPT"]').uncheck();
  await page.locator('.guardian-site-toggle[data-site="ChatGPT"]').check();

  const reopened = await openPopup(context, extensionId);
  await expect(reopened.locator('.guardian-site-toggle[data-site="ChatGPT"]')).toBeChecked();
});

test("shows no browser notice on plain Chromium", async ({ context, extensionId }) => {
  const page = await openPopup(context, extensionId);
  await expect(page.locator("#browser-notice")).toBeHidden();
});

test("blocking a site actually registers a declarativeNetRequest rule for each of its domains", async ({
  context,
  extensionId,
}) => {
  const page = await openPopup(context, extensionId);
  await page.locator('.guardian-site-toggle[data-site="ChatGPT"]').uncheck();

  const [background] = context.serviceWorkers();
  await expect
    .poll(async () => {
      const rules = await background!.evaluate(() =>
        chrome.declarativeNetRequest.getDynamicRules(),
      );
      return rules.map((rule) => rule.condition.urlFilter).sort();
    })
    .toEqual(["||chat.openai.com^", "||chatgpt.com^"]);
});

test("re-allowing a site removes its declarativeNetRequest rules again", async ({
  context,
  extensionId,
}) => {
  const page = await openPopup(context, extensionId);
  await page.locator('.guardian-site-toggle[data-site="ChatGPT"]').uncheck();

  const [background] = context.serviceWorkers();
  await expect
    .poll(async () => {
      const rules = await background!.evaluate(() =>
        chrome.declarativeNetRequest.getDynamicRules(),
      );
      return rules.length;
    })
    .toBeGreaterThan(0);

  await page.locator('.guardian-site-toggle[data-site="ChatGPT"]').check();

  await expect
    .poll(async () => {
      const rules = await background!.evaluate(() =>
        chrome.declarativeNetRequest.getDynamicRules(),
      );
      return rules.length;
    })
    .toBe(0);
});
