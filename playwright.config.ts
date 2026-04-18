import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./test",
  fullyParallel: false, // Run tests sequentially for terminal tests
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // Single worker for terminal tests
  reporter: [
    ["html", { outputFolder: "test-results/playwright-report" }],
    ["json", { outputFile: "test-results/playwright-results.json" }],
    ["list"],
  ],
  use: {
    baseURL: "http://127.0.0.1:3002",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  timeout: 60000, // 60s timeout for tests
});
