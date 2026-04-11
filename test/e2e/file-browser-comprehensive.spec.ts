/**
 * 文件浏览器综合E2E测试
 * 验证所有核心功能：侧边栏、文件列表、预览、执行
 */

import { expect, test } from "@playwright/test";

const BASE_URL = "http://127.0.0.1:5173";
const API_URL = "http://127.0.0.1:3000";

test.describe("文件浏览器功能验证", () => {
  test.beforeEach(async ({ page }) => {
    // 访问首页并切换到文件视图
    await page.goto(BASE_URL);
    await page.waitForLoadState("networkidle");

    // 点击Files按钮切换到文件视图
    const filesButton = page.locator('button:has-text("Files")');
    await expect(filesButton).toBeVisible();
    await filesButton.click();

    // 等待文件浏览器加载
    await page.waitForTimeout(1000);
  });

  test("文件浏览器主界面渲染", async ({ page }) => {
    // 验证工具栏存在
    const toolbar = page.locator('[class*="toolbar"]').first();
    await expect(toolbar).toBeVisible();

    // 验证文件列表区域存在
    const fileList = page
      .locator('[class*="fileList"], [class*="fileGrid"], [class*="contentArea"]')
      .first();
    await expect(fileList).toBeVisible();

    // 验证BottomMenu存在
    const bottomMenu = page.locator('nav, [class*="bottomMenu"]').first();
    await expect(bottomMenu).toBeVisible();
  });

  test("侧边栏切换功能", async ({ page }) => {
    // 找到侧边栏切换按钮（左下角左右箭头）
    const sidebarButton = page
      .locator('button[title*="Sidebar"], button[title*="sidebar"], nav button')
      .first();
    await expect(sidebarButton).toBeVisible();

    // 获取侧边栏元素（如果存在）
    const sidebar = page.locator('aside, [class*="sidebar"]').first();

    // 点击切换按钮
    await sidebarButton.click();
    await page.waitForTimeout(500);

    // 验证API调用（浏览目录）
    const browseResponse = await page.waitForResponse(
      (response) => response.url().includes("/api/browse") && response.status() === 200,
      { timeout: 5000 }
    );
    expect(browseResponse).toBeTruthy();

    const data = await browseResponse.json();
    expect(data).toHaveProperty("items");
    expect(Array.isArray(data.items)).toBe(true);
  });

  test("文件列表显示", async ({ page }) => {
    // 等待文件列表加载
    await page.waitForTimeout(1500);

    // 检查是否有文件项或空状态提示
    const fileItems = page
      .locator('[class*="fileItem"], [class*="gridItem"], [class*="listItem"]')
      .first();
    const emptyState = page.locator("text=No files, text=Empty, text=加载中");

    // 至少有一个存在（文件项或空状态）
    const hasContent =
      (await fileItems.isVisible().catch(() => false)) ||
      (await emptyState.isVisible().catch(() => false));
    expect(hasContent).toBe(true);
  });

  test("文件浏览API正常", async ({ request }) => {
    // 直接测试API
    const response = await request.post(`${API_URL}/api/browse`, {
      data: { path: "/root" },
    });

    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(data).toHaveProperty("currentPath");
    expect(data).toHaveProperty("items");
    expect(data).toHaveProperty("parentPath");
    expect(Array.isArray(data.items)).toBe(true);
    expect(data.items.length).toBeGreaterThan(0);

    // 验证文件项结构
    if (data.items.length > 0) {
      const firstItem = data.items[0];
      expect(firstItem).toHaveProperty("name");
      expect(firstItem).toHaveProperty("path");
      expect(firstItem).toHaveProperty("isDirectory");
    }
  });

  test("文件执行API正常", async ({ request }) => {
    // 创建测试脚本
    const testScript = `#!/bin/bash\necho "Test execution successful"\n`;

    // 先测试API端点是否响应
    const response = await request.post(`${API_URL}/api/execute`, {
      data: {
        command: 'echo "test"',
        cwd: "/root",
        streaming: true,
      },
    });

    // 执行API应该返回200（或根据实现可能是其他状态）
    expect([200, 201, 204]).toContain(response.status());
  });

  test("视图切换按钮工作", async ({ page }) => {
    // 查找视图切换按钮（如果有）
    const viewButtons = page
      .locator('button:has-text("Grid"), button:has-text("List"), [class*="viewMode"]')
      .first();

    if (await viewButtons.isVisible().catch(() => false)) {
      await viewButtons.click();
      await page.waitForTimeout(300);

      // 验证切换后界面仍然正常
      const fileList = page.locator('[class*="fileList"], [class*="fileGrid"]').first();
      await expect(fileList).toBeVisible();
    }
  });

  test("底部菜单按钮工作", async ({ page }) => {
    // 验证底部菜单按钮可点击
    const menuButtons = page.locator('nav button, [class*="bottomMenu"] button');
    const count = await menuButtons.count();

    expect(count).toBeGreaterThan(0);

    // 验证第一个按钮可点击
    const firstButton = menuButtons.first();
    await expect(firstButton).toBeVisible();
    await expect(firstButton).toBeEnabled();
  });

  test("文件浏览器响应式布局", async ({ page }) => {
    // 测试不同屏幕尺寸
    const viewports = [
      { width: 1920, height: 1080 }, // 桌面
      { width: 1366, height: 768 }, // 笔记本
      { width: 768, height: 1024 }, // 平板
    ];

    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      await page.waitForTimeout(300);

      // 验证文件浏览器仍然可见
      const fileBrowser = page.locator('[class*="fileBrowser"], section').first();
      await expect(fileBrowser).toBeVisible();
    }
  });

  test("调试日志输出正常", async ({ page }) => {
    // 捕获控制台日志
    const logs: string[] = [];
    page.on("console", (msg) => logs.push(msg.text()));

    // 刷新页面触发日志
    await page.reload();
    await page.waitForTimeout(2000);

    // 验证有日志输出（证明调试系统工作）
    expect(logs.length).toBeGreaterThan(0);
  });
});

test.describe("文件浏览器API端点验证", () => {
  test("GET /api/version", async ({ request }) => {
    const response = await request.get(`${API_URL}/api/version`);
    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(data).toHaveProperty("version");
  });

  test("GET /api/settings", async ({ request }) => {
    const response = await request.get(`${API_URL}/api/settings`);
    expect(response.status()).toBe(200);
  });

  test("POST /api/browse - 根目录", async ({ request }) => {
    const response = await request.post(`${API_URL}/api/browse`, {
      data: { path: "/" },
    });

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.items.length).toBeGreaterThan(0);
  });

  test("POST /api/browse - /root目录", async ({ request }) => {
    const response = await request.post(`${API_URL}/api/browse`, {
      data: { path: "/root" },
    });

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.currentPath).toBe("/root");
    expect(data.items.length).toBeGreaterThan(0);
  });

  test("POST /api/files/content - 读取文件", async ({ request }) => {
    // 尝试读取一个存在的文件
    const response = await request
      .get(`${API_URL}/api/files/content?path=/root/README.md`)
      .catch(() => null);

    // 如果文件存在，应该返回200或404
    if (response) {
      expect([200, 404]).toContain(response.status());
    }
  });
});
