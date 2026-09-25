import { test, expect } from "./fixtures.js";
import { startFixtureServer } from "./localServer.js";

test("highlights a finding in an overlay positioned behind the compose box", async ({
  context,
}) => {
  const server = await startFixtureServer("./fixtures/compose-box.html");
  try {
    const page = await context.newPage();
    await page.goto(server.url);

    const compose = page.locator("#compose");
    await compose.click();
    await compose.pressSequentially("email me at jane@example.com", { delay: 20 });

    // Wait for the debounced detection + highlight render, then inspect the overlay Playwright
    // finds as the compose box's previous sibling (see lib/highlightOverlay.ts).
    await expect(compose).toHaveAttribute("data-guardian-findings", /.+/, { timeout: 2000 });

    const overlay = page.locator("#compose").locator("xpath=preceding-sibling::div[1]");
    await expect(overlay).toHaveClass("guardian-highlight-overlay");

    const mark = overlay.locator("mark");
    await expect(mark).toHaveText("jane@example.com");
    await expect(mark).toHaveAttribute("data-category", "pii.email");

    // The overlay must never intercept clicks/typing meant for the real compose box.
    await expect(overlay).toHaveCSS("pointer-events", "none");
  } finally {
    await server.close();
  }
});

test("clears the highlight when the flagged text is removed", async ({ context }) => {
  const server = await startFixtureServer("./fixtures/compose-box.html");
  try {
    const page = await context.newPage();
    await page.goto(server.url);

    const compose = page.locator("#compose");
    await compose.click();
    await compose.pressSequentially("jane@example.com", { delay: 20 });
    await expect(compose).toHaveAttribute("data-guardian-findings", /pii\.email/, {
      timeout: 2000,
    });

    await compose.fill("");
    await compose.pressSequentially("x", { delay: 20 });
    await expect(compose).toHaveAttribute("data-guardian-findings", "[]", { timeout: 2000 });

    const overlay = page.locator("#compose").locator("xpath=preceding-sibling::div[1]");
    await expect(overlay.locator("mark")).toHaveCount(0);
  } finally {
    await server.close();
  }
});
