import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright 配置文件
 * 用于文件浏览器E2E测试
 */

export default defineConfig({
	testDir: "./test/e2e",
	fullyParallel: false, // 串行执行避免冲突
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	workers: 1, // 单worker避免端口冲突
	reporter: "html",

	use: {
		baseURL: "http://127.0.0.1:5173",
		trace: "on-first-retry",
		screenshot: "only-on-failure",
		video: "retain-on-failure",
	},

	projects: [
		{
			name: "chromium",
			use: {
				...devices["Desktop Chrome"],
				viewport: { width: 1280, height: 720 },
			},
		},
		{
			name: "Mobile Chrome",
			use: {
				...devices["Pixel 5"],
			},
		},
	],

	// 不需要webServer配置，因为我们使用tmux启动的服务
});
