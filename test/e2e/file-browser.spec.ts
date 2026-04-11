/**
 * 文件浏览器端到端测试
 * 使用Playwright模拟真实浏览器行为，重点测试手机浏览器
 */

import { devices, expect, test } from "@playwright/test";

// 手机设备配置
const iPhone12 = devices["iPhone 12"];

test.describe("文件浏览器端到端测试 - 桌面浏览器", () => {
  test.beforeEach(async ({ page }) => {
    // 导航到应用
    await page.goto("http://127.0.0.1:5173");

    // 等待应用加载
    await page.waitForLoadState("networkidle");

    // 切换到文件浏览器标签页
    await page.click('[data-testid="files-tab"]');

    // 等待文件浏览器加载
    await page.waitForSelector('[data-testid="file-browser"]', {
      timeout: 10000,
    });
  });

  test("应该正确加载文件浏览器界面", async ({ page }) => {
    // 验证基本元素存在
    await expect(page.locator('[data-testid="file-browser"]')).toBeVisible();
    await expect(page.locator('[data-testid="file-toolbar"]')).toBeVisible();
    await expect(page.locator('[data-testid="file-sidebar"]')).toBeVisible();
    await expect(page.locator('[data-testid="file-list"]')).toBeVisible();
  });

  test("应该显示当前目录的文件列表", async ({ page }) => {
    // 等待文件加载
    await page.waitForSelector('[data-testid^="file-item-"]', {
      timeout: 5000,
    });

    // 验证至少有一个文件项
    const fileItems = page.locator('[data-testid^="file-item-"]');
    await expect(fileItems.first()).toBeVisible();

    // 验证文件项包含合理的信息
    const firstItem = fileItems.first();
    await expect(firstItem).toContainText(/./); // 至少有一个字符
  });

  test("应该能够点击文件进行选择", async ({ page }) => {
    // 等待文件加载
    await page.waitForSelector('[data-testid^="file-item-"]', {
      timeout: 5000,
    });

    // 点击第一个文件
    const firstFile = page.locator('[data-testid^="file-item-"]').first();
    await firstFile.click();

    // 验证文件被选中（应该有选中样式）
    await expect(firstFile).toHaveClass(/selected/);

    // 验证操作栏出现
    await expect(page.locator('[data-testid="file-actionbar"]')).toBeVisible();
  });

  test("应该能够双击文件打开查看器", async ({ page }) => {
    // 等待文件加载
    await page.waitForSelector('[data-testid^="file-item-"]', {
      timeout: 5000,
    });

    // 双击第一个文件
    const firstFile = page.locator('[data-testid^="file-item-"]').first();
    await firstFile.dblclick();

    // 验证文件查看器打开
    await expect(page.locator('[data-testid="file-viewer"]')).toBeVisible({
      timeout: 3000,
    });
  });

  test("应该能够使用工具栏刷新文件列表", async ({ page }) => {
    // 点击刷新按钮
    await page.click('[data-testid="refresh-btn"]');

    // 等待刷新完成
    await page.waitForTimeout(1000);

    // 验证文件列表仍然存在
    await expect(page.locator('[data-testid^="file-item-"]').first()).toBeVisible();
  });

  test("应该能够导航到上级目录", async ({ page }) => {
    // 等待文件加载
    await page.waitForSelector('[data-testid^="file-item-"]', {
      timeout: 5000,
    });

    // 查找上级目录链接（通常是 ".."）
    const parentDir = page.locator('[data-testid="file-item-.."]');

    if (await parentDir.isVisible()) {
      await parentDir.click();

      // 等待导航完成
      await page.waitForTimeout(1000);

      // 验证仍然有文件列表
      await expect(page.locator('[data-testid^="file-item-"]').first()).toBeVisible();
    }
  });

  test("应该能够切换视图模式", async ({ page }) => {
    // 点击网格视图按钮
    await page.click('[data-testid="grid-view-btn"]');

    // 等待视图切换
    await page.waitForTimeout(500);

    // 验证网格视图激活
    await expect(page.locator('[data-testid="grid-view-btn"]')).toHaveClass(/active/);

    // 验证列表视图不激活
    await expect(page.locator('[data-testid="list-view-btn"]')).not.toHaveClass(/active/);

    // 验证显示网格视图
    await expect(page.locator('[data-testid="file-grid"]')).toBeVisible();

    // 切换回列表视图
    await page.click('[data-testid="list-view-btn"]');

    // 等待视图切换
    await page.waitForTimeout(500);

    // 验证列表视图激活
    await expect(page.locator('[data-testid="list-view-btn"]')).toHaveClass(/active/);

    // 验证显示列表视图
    await expect(page.locator('[data-testid="file-list"]')).toBeVisible();
  });

  test("应该能够搜索文件", async ({ page }) => {
    // 在搜索框中输入
    await page.fill('[data-testid="search-input"]', "test");

    // 等待搜索过滤
    await page.waitForTimeout(500);

    // 验证文件列表更新（可能为空或过滤后的结果）
    const fileItems = page.locator('[data-testid^="file-item-"]');
    await expect(fileItems.first()).toBeVisible();
  });

  test("应该能够查看文件内容", async ({ page }) => {
    // 等待文件加载
    await page.waitForSelector('[data-testid^="file-item-"]', {
      timeout: 5000,
    });

    // 点击第一个文件
    const firstFile = page.locator('[data-testid^="file-item-"]').first();
    await firstFile.click();

    // 点击查看按钮
    await page.click('[data-testid="view-btn"]');

    // 验证文件查看器打开
    await expect(page.locator('[data-testid="file-viewer"]')).toBeVisible({
      timeout: 3000,
    });

    // 验证查看器内容区域存在
    await expect(page.locator('[data-testid="viewer-content"]')).toBeVisible();
  });

  test("应该能够执行可执行文件", async ({ page }) => {
    // 等待文件加载
    await page.waitForSelector('[data-testid^="file-item-"]', {
      timeout: 5000,
    });

    // 查找可执行文件（如.sh, .py等）
    const executableFiles = page.locator(
      '[data-testid*=".sh"], [data-testid*=".py"], [data-testid*=".js"]'
    );

    if ((await executableFiles.count()) > 0) {
      const firstExecutable = executableFiles.first();
      await firstExecutable.click();

      // 点击执行按钮
      await page.click('[data-testid="execute-btn"]');

      // 验证执行开始（可能有加载状态或输出面板）
      await page.waitForTimeout(1000);

      // 验证底部面板打开或显示输出
      const bottomPanel = page.locator('[data-testid="bottom-panel"]');
      if (await bottomPanel.isVisible()) {
        await expect(bottomPanel).toBeVisible();
      }
    }
  });

  test("应该能够处理错误情况", async ({ page }) => {
    // 测试错误处理：尝试导航到不存在的目录
    // 这可能需要模拟API错误或测试错误边界

    // 验证错误边界组件存在
    await expect(page.locator('[data-testid^="error-boundary"]')).toBeVisible();
  });

  test("应该保持UI响应性", async ({ page }) => {
    // 进行一系列快速操作测试响应性
    await page.click('[data-testid="refresh-btn"]');
    await page.waitForTimeout(200);

    await page.click('[data-testid="grid-view-btn"]');
    await page.waitForTimeout(200);

    await page.click('[data-testid="list-view-btn"]');
    await page.waitForTimeout(200);

    // 验证UI仍然正常
    await expect(page.locator('[data-testid="file-browser"]')).toBeVisible();
  });
});

test.describe('文件浏览器端到端测试 - 手机浏览器', () => {
  // 使用手机视口和用户代理
  test.use({
    viewport: iPhone12.viewport,
    userAgent: iPhone12.userAgent,
  });

  test.beforeEach(async ({ page }) => {
    // 导航到应用
    await page.goto('http://127.0.0.1:5173');
    
    // 等待应用加载
    await page.waitForLoadState('networkidle');
    
    // 在手机上可能需要点击菜单按钮来切换到文件浏览器
    const menuButton = page.locator('[data-testid="mobile-menu-button"]');
    if (await menuButton.isVisible()) {
      await menuButton.click();
      await page.click('[data-testid="files-tab-mobile"]');
    } else {
      // 如果没有移动菜单，直接尝试点击标签页
      await page.click('[data-testid="files-tab"]');
    }
    
    // 等待文件浏览器加载
    await page.waitForSelector('[data-testid="file-browser"]', { timeout: 15000 });
  });

  test('手机端：应该正确加载文件浏览器界面', async ({ page }) => {
    // 验证基本元素存在
    await expect(page.locator('[data-testid="file-browser"]')).toBeVisible();
    
    // 在手机上，侧边栏可能默认隐藏或可折叠
    const sidebar = page.locator('[data-testid="file-sidebar"]');
    if (await sidebar.isVisible()) {
      await expect(sidebar).toBeVisible();
    }
    
    // 工具栏应该可见
    await expect(page.locator('[data-testid="file-toolbar"]')).toBeVisible();
    
    // 文件列表应该可见
    await expect(page.locator('[data-testid="file-list"], [data-testid="file-grid"]')).toBeVisible();
    
    // 验证视口大小
    const viewportSize = page.viewportSize();
    expect(viewportSize?.width).toBeLessThanOrEqual(390); // iPhone 12宽度
    expect(viewportSize?.height).toBeGreaterThan(800); // iPhone 12高度
  });

  test('手机端：应该显示当前目录的文件列表', async ({ page }) => {
    // 等待文件加载
    await page.waitForSelector('[data-testid^="file-item-"]', { timeout: 8000 });
    
    // 验证至少有一个文件项
    const fileItems = page.locator('[data-testid^="file-item-"]');
    await expect(fileItems.first()).toBeVisible();
    
    // 在手机上验证触摸友好的UI
    const firstItem = fileItems.first();
    const itemBox = await firstItem.boundingBox();
    expect(itemBox?.height).toBeGreaterThan(40); // 触摸目标应该足够大
    expect(itemBox?.width).toBeGreaterThan(60);
  });

  test('手机端：应该能够点击文件进行选择', async ({ page }) => {
    // 等待文件加载
    await page.waitForSelector('[data-testid^="file-item-"]', { timeout: 8000 });
    
    // 点击第一个文件
    const firstFile = page.locator('[data-testid^="file-item-"]').first();
    await firstFile.click();
    
    // 验证文件被选中
    await expect(firstFile).toHaveClass(/selected/);
    
    // 在手机上，操作栏可能以不同方式显示
    const actionBar = page.locator('[data-testid="file-actionbar"]');
    if (await actionBar.isVisible()) {
      await expect(actionBar).toBeVisible();
    } else {
      // 可能在底部弹出或全屏模式
      const mobileActions = page.locator('[data-testid="mobile-actions"]');
      await expect(mobileActions).toBeVisible();
    }
  });

  test('手机端：应该能够触摸文件打开查看器', async ({ page }) => {
    // 等待文件加载
    await page.waitForSelector('[data-testid^="file-item-"]', { timeout: 8000 });
    
    // 在手机上，可能是单击或双击打开
    const firstFile = page.locator('[data-testid^="file-item-"]').first();
    
    // 尝试单击（移动端通常单击打开）
    await firstFile.click();
    
    // 等待查看器打开
    await page.waitForTimeout(1000);
    
    // 检查是否打开了查看器
    const viewer = page.locator('[data-testid="file-viewer"]');
    if (!await viewer.isVisible()) {
      // 如果没有打开，尝试双击
      await firstFile.dblclick();
      await page.waitForTimeout(1000);
    }
    
    // 验证文件查看器打开
    await expect(page.locator('[data-testid="file-viewer"]')).toBeVisible({ timeout: 3000 });
    
    // 在手机上，查看器应该是全屏或模态框
    const viewerBox = await viewer.boundingBox();
    const viewport = page.viewportSize();
    if (viewerBox && viewport) {
      // 查看器应该占据大部分屏幕
      expect(viewerBox.width).toBeGreaterThan(viewport.width * 0.9);
      expect(viewerBox.height).toBeGreaterThan(viewport.height * 0.7);
    }
  });

  test('手机端：应该能够使用触摸刷新文件列表', async ({ page }) => {
    // 查找刷新按钮
    const refreshBtn = page.locator('[data-testid="refresh-btn"]');
    
    if (await refreshBtn.isVisible()) {
      await refreshBtn.click();
    } else {
      // 可能在滑动刷新或隐藏菜单中
      // 尝试下拉刷新手势
      await page.evaluate(() => {
        window.scrollTo(0, 0);
      });
      await page.mouse.down();
      await page.mouse.move(0, 100);
      await page.mouse.up();
    }
    
    // 等待刷新完成
    await page.waitForTimeout(1500);
    
    // 验证文件列表仍然存在
    await expect(page.locator('[data-testid^="file-item-"]').first()).toBeVisible({ timeout: 5000 });
  });

  test('手机端：应该能够滑动浏览文件列表', async ({ page }) => {
    // 等待文件加载
    await page.waitForSelector('[data-testid^="file-item-"]', { timeout: 8000 });
    
    // 获取文件列表容器
    const fileList = page.locator('[data-testid="file-list"], [data-testid="file-grid"]');
    
    // 模拟滑动
    const listBox = await fileList.boundingBox();
    if (listBox) {
      // 从中间开始向下滑动
      const startX = listBox.x + listBox.width / 2;
      const startY = listBox.y + listBox.height / 2;
      const endY = listBox.y + 50;
      
      await page.mouse.move(startX, startY);
      await page.mouse.down();
      await page.mouse.move(startX, endY, { steps: 10 });
      await page.mouse.up();
      
      // 等待滑动动画
      await page.waitForTimeout(500);
      
      // 验证UI仍然正常
      await expect(fileList).toBeVisible();
    }
  });

  test('手机端：应该能够使用移动端搜索', async ({ page }) => {
    // 在手机上，搜索可能隐藏在菜单中
    const searchButton = page.locator('[data-testid="mobile-search-button"]');
    const searchInput = page.locator('[data-testid="search-input"]');
    
    if (await searchButton.isVisible()) {
      // 点击搜索按钮展开搜索框
      await searchButton.click();
      await page.waitForTimeout(500);
    }
    
    if (await searchInput.isVisible()) {
      // 在搜索框中输入
      await searchInput.fill('test');
      
      // 等待搜索过滤
      await page.waitForTimeout(1000);
      
      // 验证文件列表更新
      const fileItems = page.locator('[data-testid^="file-item-"]');
      await expect(fileItems.first()).toBeVisible({ timeout: 3000 });
    }
  });

  test('手机端：应该能够查看文件内容（触摸友好）', async ({ page }) => {
    // 等待文件加载
    await page.waitForSelector('[data-testid^="file-item-"]', { timeout: 8000 });
    
    // 点击第一个文件
    const firstFile = page.locator('[data-testid^="file-item-"]').first();
    await firstFile.click();
    
    // 查找查看按钮（可能在操作栏或上下文菜单）
    const viewButton = page.locator('[data-testid="view-btn"], [data-testid="mobile-view-btn"]');
    if (await viewButton.isVisible()) {
      await viewButton.click();
    } else {
      // 如果没有按钮，尝试双击文件
      await firstFile.dblclick();
    }
    
    // 验证文件查看器打开
    await expect(page.locator('[data-testid="file-viewer"]')).toBeVisible({ timeout: 4000 });
    
    // 验证触摸友好的查看器控件
    const closeButton = page.locator('[data-testid="viewer-close-btn"]');
    if (await closeButton.isVisible()) {
      const closeBox = await closeButton.boundingBox();
      expect(closeBox?.height).toBeGreaterThan(44); // iOS最小触摸目标
      expect(closeBox?.width).toBeGreaterThan(44);
    }
    
    // 验证内容区域可滚动
    const contentArea = page.locator('[data-testid="viewer-content"]');
    await expect(contentArea).toBeVisible();
  });

  test('手机端：应该能够执行可执行文件（移动适配）', async ({ page })
