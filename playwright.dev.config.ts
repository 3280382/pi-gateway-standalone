import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright 配置 - 开发环境测试
 * 使用已运行的开发服务器 (http://127.0.0.1:5173)
 */

export default defineConfig({
  testDir: "./test",
  testMatch: "**/*-dev.test.ts", // 匹配 dev 测试文件
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [["list"], ["html", { outputFolder: "test-results/playwright-dev-report" }]],
  use: {
    // 使用开发服务器
    baseURL: "http://127.0.0.1:5273",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  timeout: 60000,

  // 不启动 webServer，使用外部开发服务器
  // webServer: { ... }
});
