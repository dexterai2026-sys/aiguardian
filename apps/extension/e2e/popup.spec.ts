import { test, expect } from "./fixtures.js";
import { startFixtureServer } from "./localServer.js";

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

test("shows no usage stats before anything has ever been flagged", async ({
  context,
  extensionId,
}) => {
  const page = await openPopup(context, extensionId);
  await expect(page.locator("#usage-stats-empty")).toBeVisible();
  await expect(page.locator("#usage-stats-table")).toBeHidden();
});

test("records a finding-shown and a masked-send in usage stats, then clears them", async ({
  context,
  extensionId,
}) => {
  const server = await startFixtureServer("./fixtures/send-interception.html");
  try {
    const page = await context.newPage();
    await page.goto(server.url);
    const compose = page.locator("#compose");
    await compose.click();
    await compose.pressSequentially("email jane@example.com", { delay: 20 });
    await compose.press("Enter");
    await page.locator(".guardian-btn-send-masked").click();

    const popup = await openPopup(context, extensionId);
    await expect(popup.locator("#usage-stats-table")).toBeVisible();
    const row = popup.locator("#usage-stats-body tr");
    await expect(row).toHaveCount(1);
    await expect(row).toContainText("localhost");
    await expect(row).toContainText("pii.email");
    const cells = row.locator("td");
    await expect(cells.nth(2)).toHaveText("1"); // findings
    await expect(cells.nth(3)).toHaveText("1"); // masked

    await popup.locator("#clear-usage-stats").click();
    await expect(popup.locator("#usage-stats-empty")).toBeVisible();
    await expect(popup.locator("#usage-stats-table")).toBeHidden();

    const reopened = await openPopup(context, extensionId);
    await expect(reopened.locator("#usage-stats-empty")).toBeVisible();
  } finally {
    await server.close();
  }
});
