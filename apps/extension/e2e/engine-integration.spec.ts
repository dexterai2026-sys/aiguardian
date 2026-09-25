import { test, expect } from "./fixtures.js";
import { startFixtureServer } from "./localServer.js";

test("the content script's bundled @guardian/engine-ts runs detect() and finds the expected PII", async ({
  context,
}) => {
  const server = await startFixtureServer("./fixtures/probe.html");
  try {
    const page = await context.newPage();
    await page.goto(server.url);

    // The content script (src/content-scripts/probe.ts) runs detect() on a fixed string
    // ("contact jane@example.com please") as soon as it's injected and writes the result to a
    // dataset attribute - see that file for why not a JS global.
    const resultAttribute = page.locator("body");
    await expect(resultAttribute).toHaveAttribute("data-guardian-probe-result", /.+/);

    const raw = await resultAttribute.getAttribute("data-guardian-probe-result");
    const findings = JSON.parse(raw!);

    expect(findings).toEqual([
      {
        category: "pii.email",
        start: 8,
        end: 24,
        confidence: 0.95,
        tier: 1,
        suggestedPlaceholder: "EMAIL",
      },
    ]);
  } finally {
    await server.close();
  }
});
