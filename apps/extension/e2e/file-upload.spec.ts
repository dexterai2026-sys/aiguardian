import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test, expect } from "./fixtures.js";
import { startFixtureServer } from "./localServer.js";

async function openFixture(context: import("@playwright/test").BrowserContext) {
  const server = await startFixtureServer("./fixtures/file-upload.html");
  const page = await context.newPage();
  await page.goto(server.url);
  return { server, page };
}

function writeTempFile(name: string, content: string): string {
  const dir = mkdtempSync(join(tmpdir(), "guardian-e2e-"));
  const path = join(dir, name);
  writeFileSync(path, content);
  return path;
}

test("a scannable file with a finding is blocked and shows the file-warning panel instead of reaching the site", async ({
  context,
}) => {
  const { server, page } = await openFixture(context);
  try {
    const filePath = writeTempFile("notes.txt", "contact jane@example.com");

    await page.locator("#upload").setInputFiles(filePath);

    await expect(page.locator(".guardian-file-warning-panel")).toBeVisible();
    await expect(page.locator(".guardian-file-warning-summary")).toContainText("notes.txt");
    await expect(page.locator(".guardian-file-warning-summary")).toContainText("pii.email");
    await expect(page.locator(".uploaded-files")).toHaveCount(0);
  } finally {
    await server.close();
  }
});

test('"Cancel upload" clears the selection and never lets it reach the site', async ({
  context,
}) => {
  const { server, page } = await openFixture(context);
  try {
    const filePath = writeTempFile("notes.txt", "contact jane@example.com");
    await page.locator("#upload").setInputFiles(filePath);
    await expect(page.locator(".guardian-file-warning-panel")).toBeVisible();

    await page.locator(".guardian-btn-cancel-upload").click();

    await expect(page.locator(".guardian-file-warning-panel")).toHaveCount(0);
    await expect(page.locator(".uploaded-files")).toHaveCount(0);
    await expect(page.locator("#upload")).toHaveValue("");
  } finally {
    await server.close();
  }
});

test('"Upload anyway" replays the selection so the site receives the original file', async ({
  context,
}) => {
  const { server, page } = await openFixture(context);
  try {
    const filePath = writeTempFile("notes.txt", "contact jane@example.com");
    await page.locator("#upload").setInputFiles(filePath);
    await expect(page.locator(".guardian-file-warning-panel")).toBeVisible();

    await page.locator(".guardian-btn-upload-anyway").click();

    await expect(page.locator(".guardian-file-warning-panel")).toHaveCount(0);
    await expect(page.locator(".uploaded-files")).toHaveText("notes.txt");
  } finally {
    await server.close();
  }
});

test("a non-scannable file passes straight through, with no panel at all", async ({ context }) => {
  const { server, page } = await openFixture(context);
  try {
    const filePath = writeTempFile("photo.jpg", "not a real jpeg, just needs a matching extension");

    await page.locator("#upload").setInputFiles(filePath);

    await expect(page.locator(".uploaded-files")).toHaveText("photo.jpg");
    await expect(page.locator(".guardian-file-warning-panel")).toHaveCount(0);
  } finally {
    await server.close();
  }
});

test("a scannable file with no findings passes straight through, with no panel at all", async ({
  context,
}) => {
  const { server, page } = await openFixture(context);
  try {
    const filePath = writeTempFile("notes.txt", "nothing sensitive in here");

    await page.locator("#upload").setInputFiles(filePath);

    await expect(page.locator(".uploaded-files")).toHaveText("notes.txt");
    await expect(page.locator(".guardian-file-warning-panel")).toHaveCount(0);
  } finally {
    await server.close();
  }
});
