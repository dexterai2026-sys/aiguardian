import { test, expect } from "./fixtures.js";

test("the extension loads and its background service worker registers", async ({
  context,
  extensionId,
}) => {
  expect(extensionId).toMatch(/^[a-z]{32}$/);

  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/src/popup/index.html`);
  await expect(page.locator("#app")).toHaveText("Guardian — protection active");
});
