import { test, expect } from "./fixtures.js";
import { startFixtureServer } from "./localServer.js";

test("finds the larger compose box and runs debounced detection on real typed input", async ({
  context,
}) => {
  const server = await startFixtureServer("./fixtures/compose-box.html");
  try {
    const page = await context.newPage();
    await page.goto(server.url);

    // The protection badge (PR 12) is unconditional, present as soon as the compose box is found -
    // not gated on typing or findings.
    await expect(page.locator(".guardian-protection-badge")).toBeVisible();

    const compose = page.locator("#compose");
    await compose.click();
    await compose.pressSequentially("email me at jane@example.com", { delay: 20 });

    // The content script debounces detection by 300ms after the last input event; typing itself
    // takes time too (20ms/char here), so give it real margin rather than a knife-edge wait.
    await expect(compose).toHaveAttribute("data-guardian-findings", /.+/, { timeout: 2000 });

    const raw = await compose.getAttribute("data-guardian-findings");
    const findings = JSON.parse(raw!);

    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ category: "pii.email", suggestedPlaceholder: "EMAIL" });

    // The decoy textarea is too small to be picked as the compose box, so it must never get a
    // findings attribute at all, debounce or not.
    await expect(page.locator("#decoy")).not.toHaveAttribute("data-guardian-findings");
  } finally {
    await server.close();
  }
});
