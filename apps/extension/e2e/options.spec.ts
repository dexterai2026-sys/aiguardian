import { test, expect } from "./fixtures.js";

async function openOptions(
  context: import("@playwright/test").BrowserContext,
  extensionId: string,
) {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/src/options/index.html`);
  return page;
}

test("defaults to personal mode and adult age profile", async ({ context, extensionId }) => {
  const page = await openOptions(context, extensionId);
  await expect(page.locator("#mode-personal")).toBeChecked();
  await expect(page.locator("#age-profile")).toHaveValue("adult");
});

test("persists a mode switch to family across a reopen", async ({ context, extensionId }) => {
  const page = await openOptions(context, extensionId);
  await page.locator("#mode-family").check();

  const reopened = await openOptions(context, extensionId);
  await expect(reopened.locator("#mode-family")).toBeChecked();
});

test("persists an age profile change across a reopen", async ({ context, extensionId }) => {
  const page = await openOptions(context, extensionId);
  await page.locator("#age-profile").selectOption("teen");

  const reopened = await openOptions(context, extensionId);
  await expect(reopened.locator("#age-profile")).toHaveValue("teen");
});

test("first unlock attempt creates a new empty vault under that passphrase", async ({
  context,
  extensionId,
}) => {
  const page = await openOptions(context, extensionId);
  await page.locator("#vault-passphrase").fill("correct horse battery staple");
  await page.locator("#vault-unlock").click();

  await expect(page.locator("#vault-unlocked")).toBeVisible();
  await expect(page.locator("#vault-locked")).toBeHidden();
  await expect(page.locator("#vault-entry-list li")).toHaveCount(0);
});

test("adding a vault entry persists it, visible after locking and re-unlocking", async ({
  context,
  extensionId,
}) => {
  const page = await openOptions(context, extensionId);
  await page.locator("#vault-passphrase").fill("correct horse battery staple");
  await page.locator("#vault-unlock").click();

  await page.locator("#vault-add-category").selectOption("pii.name");
  await page.locator("#vault-add-value").fill("Jamie");
  await page.locator("#vault-add-submit").click();

  await expect(page.locator("#vault-entry-list li")).toHaveCount(1);
  await expect(page.locator("#vault-entry-list")).toContainText("Jamie");

  await page.locator("#vault-lock").click();
  await expect(page.locator("#vault-locked")).toBeVisible();

  const reopened = await openOptions(context, extensionId);
  await reopened.locator("#vault-passphrase").fill("correct horse battery staple");
  await reopened.locator("#vault-unlock").click();

  await expect(reopened.locator("#vault-entry-list li")).toHaveCount(1);
  await expect(reopened.locator("#vault-entry-list")).toContainText("Jamie");
});

test("removing a vault entry persists the removal", async ({ context, extensionId }) => {
  const page = await openOptions(context, extensionId);
  await page.locator("#vault-passphrase").fill("correct horse battery staple");
  await page.locator("#vault-unlock").click();
  await page.locator("#vault-add-category").selectOption("pii.name");
  await page.locator("#vault-add-value").fill("Jamie");
  await page.locator("#vault-add-submit").click();
  await expect(page.locator("#vault-entry-list li")).toHaveCount(1);

  await page.locator(".guardian-vault-remove").click();
  await expect(page.locator("#vault-entry-list li")).toHaveCount(0);

  const reopened = await openOptions(context, extensionId);
  await reopened.locator("#vault-passphrase").fill("correct horse battery staple");
  await reopened.locator("#vault-unlock").click();
  await expect(reopened.locator("#vault-entry-list li")).toHaveCount(0);
});

test("shows an error and stays locked when the passphrase is wrong", async ({
  context,
  extensionId,
}) => {
  const page = await openOptions(context, extensionId);
  await page.locator("#vault-passphrase").fill("correct horse battery staple");
  await page.locator("#vault-unlock").click();
  await expect(page.locator("#vault-unlocked")).toBeVisible();
  await page.locator("#vault-lock").click();

  await page.locator("#vault-passphrase").fill("the wrong passphrase entirely");
  await page.locator("#vault-unlock").click();

  await expect(page.locator("#vault-error")).toBeVisible();
  await expect(page.locator("#vault-error")).toContainText("Incorrect passphrase");
  await expect(page.locator("#vault-unlocked")).toBeHidden();
});

test("never writes the raw passphrase to chrome.storage.local", async ({
  context,
  extensionId,
}) => {
  const page = await openOptions(context, extensionId);
  const passphrase = "a very specific and identifiable passphrase 12345";
  await page.locator("#vault-passphrase").fill(passphrase);
  await page.locator("#vault-unlock").click();
  await expect(page.locator("#vault-unlocked")).toBeVisible();

  const [background] = context.serviceWorkers();
  const stored = await background!.evaluate(() => chrome.storage.local.get(null));
  expect(JSON.stringify(stored)).not.toContain(passphrase);
});
