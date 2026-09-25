import { test, expect } from "./fixtures.js";
import { startFixtureServer } from "./localServer.js";

async function openFixture(context: import("@playwright/test").BrowserContext) {
  const server = await startFixtureServer("./fixtures/send-interception.html");
  const page = await context.newPage();
  await page.goto(server.url);
  return { server, page };
}

test("pressing Enter with a finding present shows the review panel instead of sending", async ({
  context,
}) => {
  const { server, page } = await openFixture(context);
  try {
    const compose = page.locator("#compose");
    await compose.click();
    await compose.pressSequentially("email jane@example.com", { delay: 20 });
    await page.waitForTimeout(400); // let debounced highlighting settle first, doesn't gate interception

    await compose.press("Enter");

    await expect(page.locator(".guardian-interception-panel")).toBeVisible();
    await expect(page.locator(".sent-message")).toHaveCount(0);
  } finally {
    await server.close();
  }
});

test('"Send masked" sends the masked text and closes the panel', async ({ context }) => {
  const { server, page } = await openFixture(context);
  try {
    const compose = page.locator("#compose");
    await compose.click();
    await compose.pressSequentially("email jane@example.com", { delay: 20 });
    await compose.press("Enter");
    await expect(page.locator(".guardian-interception-panel")).toBeVisible();

    await page.locator(".guardian-btn-send-masked").click();

    await expect(page.locator(".guardian-interception-panel")).toHaveCount(0);
    await expect(page.locator(".sent-message")).toHaveText("email [EMAIL_1]");
    await expect(compose).toHaveValue("");
  } finally {
    await server.close();
  }
});

test('"Send anyway" sends the original, unmasked text', async ({ context }) => {
  const { server, page } = await openFixture(context);
  try {
    const compose = page.locator("#compose");
    await compose.click();
    await compose.pressSequentially("email jane@example.com", { delay: 20 });
    await compose.press("Enter");
    await expect(page.locator(".guardian-interception-panel")).toBeVisible();

    await page.locator(".guardian-btn-send-anyway").click();

    await expect(page.locator(".guardian-interception-panel")).toHaveCount(0);
    await expect(page.locator(".sent-message")).toHaveText("email jane@example.com");
  } finally {
    await server.close();
  }
});

test('"Edit" closes the panel without sending or changing the text', async ({ context }) => {
  const { server, page } = await openFixture(context);
  try {
    const compose = page.locator("#compose");
    await compose.click();
    await compose.pressSequentially("email jane@example.com", { delay: 20 });
    await compose.press("Enter");
    await expect(page.locator(".guardian-interception-panel")).toBeVisible();

    await page.locator(".guardian-btn-edit").click();

    await expect(page.locator(".guardian-interception-panel")).toHaveCount(0);
    await expect(page.locator(".sent-message")).toHaveCount(0);
    await expect(compose).toHaveValue("email jane@example.com");
  } finally {
    await server.close();
  }
});

test("clicking the send button with a finding present intercepts it the same way as Enter", async ({
  context,
}) => {
  const { server, page } = await openFixture(context);
  try {
    const compose = page.locator("#compose");
    await compose.click();
    await compose.pressSequentially("email jane@example.com", { delay: 20 });

    await page.locator("#send").click();

    await expect(page.locator(".guardian-interception-panel")).toBeVisible();
    await expect(page.locator(".sent-message")).toHaveCount(0);
  } finally {
    await server.close();
  }
});

test("a message with no findings sends immediately, with no panel at all", async ({ context }) => {
  const { server, page } = await openFixture(context);
  try {
    const compose = page.locator("#compose");
    await compose.click();
    await compose.pressSequentially("just a normal message", { delay: 20 });
    await compose.press("Enter");

    await expect(page.locator(".sent-message")).toHaveText("just a normal message");
    await expect(page.locator(".guardian-interception-panel")).toHaveCount(0);
  } finally {
    await server.close();
  }
});
