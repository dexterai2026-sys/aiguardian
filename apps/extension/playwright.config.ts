import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false, // each test launches its own persistent browser context; keep serial for now
  retries: 0,
  reporter: "list",
});
