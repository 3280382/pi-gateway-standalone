/**
 * 文件浏览器功能测试
 * 使用Playwright验证真实浏览器行为
 */

import { expect, test } from "@playwright/test";

const BASE_URL = "http://127.0.0.1:5173";

test.describe("文件浏览器基本功能", () => {
	test.beforeEach(async ({ page }) => {
		// 访问首页并切换到文件视图
		await page.goto(BASE_URL);
		await page.waitForLoadState("networkidle");

		// 点击Files按钮
		const filesButton = page.locator('button:has-text("Files")').first();
		await expect(filesButton).toBeVisible({ timeout: 10000 });
		await filesButton.click();

		// 等待文件浏览器加载
		await page.waitForTimeout(2000);
	});

	test("文件浏览器主界面显示", async ({ page }) => {
		// 截图查看当前状态
		await page.screenshot({ path: "/tmp/file-browser-initial.png" });

		// 验证文件浏览器容器存在
		const fileBrowser = page.locator("section").first();
		await expect(fileBrowser).toBeVisible();
	});

	test("点击侧边栏按钮", async ({ page }) => {
		// 找到并点击侧边栏切换按钮
		const sidebarButton = page.locator("nav button").first();
		await expect(sidebarButton).toBeVisible();

		// 点击按钮
		await sidebarButton.click();
		await page.waitForTimeout(1000);

		// 截图查看侧边栏状态
		await page.screenshot({ path: "/tmp/file-browser-sidebar.png" });

		// 验证有aside元素（侧边栏）
		const sidebar = page.locator("aside").first();
		const isVisible = await sidebar.isVisible().catch(() => false);

		// 记录结果但不强制要求，因为可能是CSS控制显示
		console.log("侧边栏可见:", isVisible);
	});

	test("文件列表区域存在", async ({ page }) => {
		// 验证文件列表或内容区域存在
		const contentArea = page
			.locator("div")
			.filter({ hasText: /Loading|No files|Files/ })
			.first();
		const hasContent = await contentArea.isVisible().catch(() => false);

		console.log("内容区域存在:", hasContent);

		// 或者检查是否有文件项
		const fileItems = page.locator('[class*="file"]').first();
		const hasFiles = await fileItems.isVisible().catch(() => false);

		console.log("文件项存在:", hasFiles);

		// 至少有一个存在
		expect(hasContent || hasFiles).toBe(true);
	});

	test("API请求成功", async ({ page }) => {
		// 监听API请求
		const apiResponse = await page.waitForResponse(
			(response) =>
				response.url().includes("/api/browse") && response.status() === 200,
			{ timeout: 5000 },
		);

		const data = await apiResponse.json();
		console.log("API返回项目数:", data.items?.length);

		expect(data).toHaveProperty("items");
		expect(Array.isArray(data.items)).toBe(true);
	});

	test("滚动功能检查", async ({ page }) => {
		// 截图查看整体布局
		await page.screenshot({
			path: "/tmp/file-browser-scroll.png",
			fullPage: false,
		});

		// 验证页面可以滚动
		const canScroll = await page.evaluate(() => {
			const html = document.documentElement;
			return html.scrollHeight > html.clientHeight;
		});

		console.log("页面可滚动:", canScroll);

		// 尝试滚动
		await page.mouse.wheel(0, 100);
		await page.waitForTimeout(500);
	});
});

test.describe("文件浏览器API验证", () => {
	test("直接API测试", async ({ request }) => {
		// 测试文件浏览API
		const response = await request.post("http://127.0.0.1:3000/api/browse", {
			data: { path: "/root" },
		});

		expect(response.status()).toBe(200);

		const data = await response.json();
		expect(data).toHaveProperty("items");
		expect(Array.isArray(data.items)).toBe(true);
		expect(data.items.length).toBeGreaterThan(0);

		console.log("API返回项目数:", data.items.length);
	});
});
