import { test, expect } from "./fixtures.js";
import { startFixtureServer } from "./localServer.js";

async function openFixture(context: import("@playwright/test").BrowserContext) {
  const server = await startFixtureServer("./fixtures/chatgpt.html");
  const page = await context.newPage();
  await page.goto(server.url);
  return { server, page };
}

test("highlights a finding in the ChatGPT compose box", async ({ context }) => {
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

test("intercepts the Send button even though it doesn't exist until text is typed", async ({
  context,
}) => {
  const { server, page } = await openFixture(context);
  try {
    const compose = page.locator('[role="textbox"]');
    await expect(page.locator('button[aria-label="Send"]')).toHaveCount(0);

    await compose.click();
    await compose.pressSequentially("email jane@example.com", { delay: 20 });
    await expect(page.locator('button[aria-label="Send"]')).toHaveCount(1);

    await page.locator('button[aria-label="Send"]').click();

    await expect(page.locator(".guardian-interception-panel")).toBeVisible();
    await expect(page.locator("[data-user-message-bubble]")).toHaveCount(0);
  } finally {
    await server.close();
  }
});

test('"Send masked" sends the masked text as the user bubble', async ({ context }) => {
  const { server, page } = await openFixture(context);
  try {
    const compose = page.locator('[role="textbox"]');
    await compose.click();
    await compose.pressSequentially("email jane@example.com", { delay: 20 });
    await page.locator('button[aria-label="Send"]').click();
    await page.locator(".guardian-btn-send-masked").click();

    await expect(page.locator("[data-user-message-bubble]")).toHaveText("email [EMAIL_1]");
  } finally {
    await server.close();
  }
});

test("restores a placeholder in the AI's response, but never in the user's own sent bubble", async ({
  context,
}) => {
  const { server, page } = await openFixture(context);
  try {
    const compose = page.locator('[role="textbox"]');
    await compose.click();
    await compose.pressSequentially("email jane@example.com", { delay: 20 });
    await page.locator('button[aria-label="Send"]').click();
    await page.locator(".guardian-btn-send-masked").click();

    await page.evaluate(() => {
      (window as unknown as { simulateAiResponse(text: string): void }).simulateAiResponse(
        "Sure, I'll reach out to [EMAIL_1] shortly.",
      );
    });

    await expect(page.locator("[data-markdown-text-style='assistant-message']")).toHaveText(
      "Sure, I'll reach out to jane@example.com shortly.",
    );
    // This is exactly the case generic-fallback.ts can't handle safely (see its docs and
    // docs/phase-2-plan.md's PR 7 notes) - the adapter's response-container selector is what
    // makes it safe here: the user's own echoed bubble must stay masked.
    await expect(page.locator("[data-user-message-bubble]")).toHaveText("email [EMAIL_1]");
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
    await page.locator('button[aria-label="Send"]').click();

    await expect(page.locator("[data-user-message-bubble]")).toHaveText("just a normal message");
    await expect(page.locator(".guardian-interception-panel")).toHaveCount(0);
  } finally {
    await server.close();
  }
});
