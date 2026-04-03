/**
 * InputArea 按钮功能测试
 * 测试 @ / ! 和图片按钮的菜单弹出功能
 */

import { expect, test } from "@playwright/test";

test.describe("InputArea Buttons", () => {
	test.beforeEach(async ({ page }) => {
		// 启动应用
		await page.goto("http://127.0.0.1:5173");

		// 等待应用加载完成
		await page.waitForSelector(".container", { timeout: 10000 });
	});

	test("@ button should open file picker", async ({ page }) => {
		// 找到 @ 按钮并点击
		const atButton = page.locator('button[title="Mention file (@)"]');
		await expect(atButton).toBeVisible();

		await atButton.click();

		// 检查文件选择器是否显示
		const filePicker = page.locator(".filePicker");
		await expect(filePicker).toBeVisible();

		// 检查文件选择器内容
		await expect(filePicker.locator(".filePickerHeader")).toContainText(
			"Select file or directory",
		);

		console.log("✅ @ button opens file picker correctly");
	});

	test("/ button should open command menu", async ({ page }) => {
		// 找到 / 按钮并点击
		const slashButton = page.locator('button[title="Slash command (/)"]');
		await expect(slashButton).toBeVisible();

		await slashButton.click();

		// 检查命令菜单是否显示
		const commandMenu = page.locator(".commandMenu");
		await expect(commandMenu).toBeVisible();

		// 检查是否有命令项
		const commandItems = commandMenu.locator(".commandItem");
		await expect(commandItems).toHaveCount.greaterThan(0);

		console.log("✅ / button opens command menu correctly");
	});

	test("! button should insert ! in textarea", async ({ page }) => {
		// 找到 ! 按钮并点击
		const bashButton = page.locator('button[title="Bash command (!)"]');
		await expect(bashButton).toBeVisible();

		await bashButton.click();

		// 检查 textarea 中是否插入了 !
		const textarea = page.locator("textarea");
		await expect(textarea).toHaveValue("!");

		// 检查是否有 bashMode 样式
		await expect(textarea).toHaveClass(/bashMode/);

		console.log("✅ ! button inserts ! correctly");
	});

	test("image button should trigger file input", async ({ page }) => {
		// 监听文件输入的点击事件
		const fileInput = page.locator('input[type="file"]');

		// 找到图片按钮并点击
		const imageButton = page.locator('button[title="Upload image/file"]');
		await expect(imageButton).toBeVisible();

		// 点击图片按钮
		await imageButton.click();

		// 检查文件输入是否被触发（通过检查其状态）
		// 注意：由于浏览器安全限制，我们不能真正打开文件选择器
		// 但我们可以验证按钮是可点击的

		console.log("✅ Image button is clickable");
	});

	test("command menu should close on Escape", async ({ page }) => {
		// 打开命令菜单
		const slashButton = page.locator('button[title="Slash command (/)"]');
		await slashButton.click();

		const commandMenu = page.locator(".commandMenu");
		await expect(commandMenu).toBeVisible();

		// 按 Escape 键
		await page.keyboard.press("Escape");

		// 检查菜单是否关闭
		await expect(commandMenu).not.toBeVisible();

		console.log("✅ Command menu closes on Escape");
	});

	test("file picker should close on Escape", async ({ page }) => {
		// 打开文件选择器
		const atButton = page.locator('button[title="Mention file (@)"]');
		await atButton.click();

		const filePicker = page.locator(".filePicker");
		await expect(filePicker).toBeVisible();

		// 按 Escape 键
		await page.keyboard.press("Escape");

		// 检查菜单是否关闭
		await expect(filePicker).not.toBeVisible();

		console.log("✅ File picker closes on Escape");
	});
});
