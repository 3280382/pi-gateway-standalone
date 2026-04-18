import { test, expect } from "@playwright/test";

test.describe("UI Marker E2E Tests", () => {
  test.beforeEach(async ({ page }) => {
    // 清除 localStorage 以确保干净的测试环境
    await page.goto("http://localhost:5173");
    await page.evaluate(() => {
      localStorage.removeItem("UI_MARKER_ENABLED");
      localStorage.removeItem("UI_MARKER_BUTTON_POS");
    });
    await page.reload();
    // 等待页面加载完成
    await page.waitForSelector("#root", { timeout: 10000 });
  });

  test("UI Marker 脚本已加载", async ({ page }) => {
    const hasUIMarker = await page.evaluate(() => {
      return typeof window.uiMarker !== "undefined";
    });
    expect(hasUIMarker).toBe(true);
    console.log("✅ UI Marker 脚本已加载到 window.uiMarker");
  });

  test("工具菜单中包含 UI Marker 开关", async ({ page }) => {
    // 点击工具菜单按钮
    const toolButton = page.locator('button[title="Tools"]').first();
    await toolButton.click();
    
    // 检查菜单中是否有 UI Marker 选项
    const uiMarkerOption = page.locator('text=UI Marker').first();
    await expect(uiMarkerOption).toBeVisible();
    console.log("✅ 工具菜单中包含 UI Marker 选项");
    
    // 关闭菜单
    await toolButton.click();
  });

  test("通过工具菜单激活 UI Marker", async ({ page }) => {
    // 点击工具菜单
    const toolButton = page.locator('button[title="Tools"]').first();
    await toolButton.click();
    
    // 点击 UI Marker 开关
    const uiMarkerOption = page.locator('text=UI Marker').first();
    await uiMarkerOption.click();
    
    // 等待浮动按钮出现
    const controlButton = page.locator("#ui-marker-control-btn");
    await expect(controlButton).toBeVisible({ timeout: 5000 });
    console.log("✅ 通过工具菜单成功激活 UI Marker");
    
    // 验证 localStorage 已更新
    const isEnabled = await page.evaluate(() => {
      return localStorage.getItem("UI_MARKER_ENABLED");
    });
    expect(isEnabled).toBe("true");
  });

  test("浮动按钮显示在右侧中部", async ({ page }) => {
    // 先激活 UI Marker
    await page.evaluate(() => {
      if (window.uiMarker) {
        window.uiMarker.activate();
      }
    });
    
    // 等待按钮出现
    const controlButton = page.locator("#ui-marker-control-btn");
    await expect(controlButton).toBeVisible({ timeout: 5000 });
    
    // 检查位置（右侧）
    const box = await controlButton.boundingBox();
    expect(box).not.toBeNull();
    
    if (box) {
      const viewportSize = await page.viewportSize();
      expect(viewportSize).not.toBeNull();
      
      if (viewportSize) {
        // 检查按钮在右侧（距离右边缘小于 100px）
        const distanceFromRight = viewportSize.width - box.x - box.width;
        expect(distanceFromRight).toBeLessThan(100);
        console.log(`✅ 浮动按钮位置正确: 距离右边缘 ${distanceFromRight}px`);
      }
    }
  });

  test("点击浮动按钮停用 UI Marker", async ({ page }) => {
    // 激活 UI Marker
    await page.evaluate(() => {
      if (window.uiMarker) {
        window.uiMarker.activate();
      }
    });
    
    // 等待按钮出现
    const controlButton = page.locator("#ui-marker-control-btn");
    await expect(controlButton).toBeVisible({ timeout: 5000 });
    
    // 点击按钮停用
    await controlButton.click();
    
    // 验证按钮已消失
    await expect(controlButton).not.toBeVisible({ timeout: 5000 });
    console.log("✅ 点击浮动按钮成功停用 UI Marker");
    
    // 验证 localStorage 已更新
    const isEnabled = await page.evaluate(() => {
      return localStorage.getItem("UI_MARKER_ENABLED");
    });
    expect(isEnabled).toBe("false");
  });

  test("拖动浮动按钮并记住位置", async ({ page }) => {
    // 激活 UI Marker
    await page.evaluate(() => {
      if (window.uiMarker) {
        window.uiMarker.activate();
      }
    });
    
    // 等待按钮出现
    const controlButton = page.locator("#ui-marker-control-btn");
    await expect(controlButton).toBeVisible({ timeout: 5000 });
    
    // 获取初始位置
    const initialBox = await controlButton.boundingBox();
    expect(initialBox).not.toBeNull();
    
    if (initialBox) {
      // 拖动按钮（向上移动 100px）
      await controlButton.dragTo(
        page.locator("body"),
        {
          targetPosition: { 
            x: initialBox.x + initialBox.width / 2, 
            y: initialBox.y - 100 
          },
          force: true
        }
      );
      
      // 等待位置保存
      await page.waitForTimeout(500);
      
      // 验证位置已保存到 localStorage
      const savedPos = await page.evaluate(() => {
        const pos = localStorage.getItem("UI_MARKER_BUTTON_POS");
        return pos ? JSON.parse(pos) : null;
      });
      
      expect(savedPos).not.toBeNull();
      expect(savedPos.top).toBeLessThan(initialBox.y);
      console.log(`✅ 拖动位置已保存: top=${savedPos.top}, right=${savedPos.right}`);
    }
  });

  test("快捷键 Ctrl+Shift+M 切换 UI Marker", async ({ page }) => {
    // 使用快捷键激活
    await page.keyboard.press("Control+Shift+M");
    
    // 等待按钮出现
    const controlButton = page.locator("#ui-marker-control-btn");
    await expect(controlButton).toBeVisible({ timeout: 5000 });
    console.log("✅ 快捷键成功激活 UI Marker");
    
    // 再次使用快捷键停用
    await page.keyboard.press("Control+Shift+M");
    
    // 验证按钮已消失
    await expect(controlButton).not.toBeVisible({ timeout: 5000 });
    console.log("✅ 快捷键成功停用 UI Marker");
  });

  test("UI Marker 标记可交互元素", async ({ page }) => {
    // 激活 UI Marker
    await page.evaluate(() => {
      if (window.uiMarker) {
        window.uiMarker.activate();
      }
    });
    
    // 等待按钮出现
    const controlButton = page.locator("#ui-marker-control-btn");
    await expect(controlButton).toBeVisible({ timeout: 5000 });
    
    // 检查是否有标记标签出现（蓝色小圆点）
    const markers = await page.locator(".ui-marker-label").count();
    console.log(`✅ 找到 ${markers} 个可交互元素标记`);
    expect(markers).toBeGreaterThan(0);
  });

  test("控制台命令 forceDisableUIMarker 可用", async ({ page }) => {
    // 激活 UI Marker
    await page.evaluate(() => {
      if (window.uiMarker) {
        window.uiMarker.activate();
      }
    });
    
    // 等待按钮出现
    const controlButton = page.locator("#ui-marker-control-btn");
    await expect(controlButton).toBeVisible({ timeout: 5000 });
    
    // 使用控制台命令停用
    const result = await page.evaluate(() => {
      return window.forceDisableUIMarker();
    });
    
    expect(result).toBe(true);
    
    // 验证按钮已消失
    await expect(controlButton).not.toBeVisible({ timeout: 5000 });
    console.log("✅ 控制台命令 forceDisableUIMarker 正常工作");
  });
});
