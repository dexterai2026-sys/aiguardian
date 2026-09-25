import { test, expect } from "./fixtures.js";
import { startFixtureServer } from "./localServer.js";

async function openFixture(context: import("@playwright/test").BrowserContext) {
  const server = await startFixtureServer("./fixtures/gemini.html");
  const page = await context.newPage();
  await page.goto(server.url);
  return { server, page };
}

test("highlights a finding in the Gemini compose box", async ({ context }) => {
  const { server, page } = await openFixture(context);
  try {
    const compose = page.locator('[role="textbox"]');
    await compose.click();
    await compose.pressSequentially("email jane@example.com", { delay: 20 });
    await page.waitForTimeout(400);

    await expect(page.locator(".guardian-highlight-overlay mark")).toHaveCount(1);
  } finally {
    await server.close();
  }
});

test("intercepts the Send button when there are findings", async ({ context }) => {
  const { server, page } = await openFixture(context);
  try {
    const compose = page.locator('[role="textbox"]');
    await compose.click();
    await compose.pressSequentially("email jane@example.com", { delay: 20 });

    await page.locator('[aria-label="Send message"]').click();

    await expect(page.locator(".guardian-interception-panel")).toBeVisible();
    await expect(page.locator("user-query-content")).toHaveCount(0);
  } finally {
    await server.close();
  }
});

test('"Send masked" sends the masked text as the user query', async ({ context }) => {
  const { server, page } = await openFixture(context);
  try {
    const compose = page.locator('[role="textbox"]');
    await compose.click();
    await compose.pressSequentially("email jane@example.com", { delay: 20 });
    await page.locator('[aria-label="Send message"]').click();
    await page.locator(".guardian-btn-send-masked").click();

    await expect(page.locator("user-query-content")).toHaveText("email [EMAIL_1]");
  } finally {
    await server.close();
  }
});

test("restores a placeholder in Gemini's response, but never in the user's own sent query", async ({
  context,
}) => {
  const { server, page } = await openFixture(context);
  try {
    const compose = page.locator('[role="textbox"]');
    await compose.click();
    await compose.pressSequentially("email jane@example.com", { delay: 20 });
    await page.locator('[aria-label="Send message"]').click();
    await page.locator(".guardian-btn-send-masked").click();

    await page.evaluate(() => {
      (window as unknown as { simulateAiResponse(text: string): void }).simulateAiResponse(
        "Sure, I'll reach out to [EMAIL_1] shortly.",
      );
    });

    await expect(page.locator("message-content")).toHaveText(
      "Sure, I'll reach out to jane@example.com shortly.",
    );
    await expect(page.locator("user-query-content")).toHaveText("email [EMAIL_1]");
  } finally {
    await server.close();
  }
});

test("a message with no findings sends immediately, with no panel at all", async ({ context }) => {
  const { server, page } = await openFixture(context);
  try {
    const compose = page.locator('[role="textbox"]');
    await compose.click();
    await compose.pressSequentially("just a normal message", { delay: 20 });
    await page.locator('[aria-label="Send message"]').click();

    await expect(page.locator("user-query-content")).toHaveText("just a normal message");
    await expect(page.locator(".guardian-interception-panel")).toHaveCount(0);
  } finally {
    await server.close();
  }
});
