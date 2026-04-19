import { test, expect } from "@playwright/test";

test("检查 sessionManager 是否可用", async ({ page }) => {
  // 捕获控制台错误
  page.on('pageerror', (error) => {
    console.log('PAGE ERROR:', error.message);
  });
  
  await page.goto("http://127.0.0.1:3000/");
  await page.waitForTimeout(5000);

  // 截图 1: 初始状态
  await page.screenshot({ path: 'test-results/session-debug-1.png' });
  
  // 获取左下角所有按钮的信息
  const buttonInfo = await page.evaluate(() => {
    const buttons = document.querySelectorAll('nav button, footer button, .sidebar button');
    return Array.from(buttons).map((b, i) => ({
      index: i,
      text: b.textContent?.trim(),
      title: b.getAttribute('title'),
      class: b.className,
    }));
  });
  console.log('Buttons found:', buttonInfo);
  
  // 检查页面源代码
  const pageSource = await page.evaluate(() => {
    return document.body.innerHTML;
  });
  console.log('Has Before Session:', pageSource.includes('Before SessionDropdownSection'));
  console.log('Has Sessions title:', pageSource.includes('Sessions'));
  
  // 检查 aside 元素的内容
  const asideHTML = await page.evaluate(() => {
    const aside = document.querySelector('aside');
    return aside?.innerHTML?.substring(0, 2000);
  });
  console.log('Aside HTML:', asideHTML?.substring(0, 500));
  
  // 点击第一个按钮（通常是菜单/侧边栏切换）
  const firstButton = page.locator('nav button').first();
  if (await firstButton.isVisible().catch(() => false)) {
    await firstButton.click();
    console.log('Clicked first nav button');
    await page.waitForTimeout(2000);
  }
  
  // 截图 2: 点击菜单后
  await page.screenshot({ path: 'test-results/session-debug-2.png' });
  
  // 检查 aside 元素的内容
  const asideContent = await page.evaluate(() => {
    const aside = document.querySelector('aside');
    if (!aside) return null;
    
    // 获取所有 section 的标题
    const sections = Array.from(aside.querySelectorAll('h3, [class*="header"]')).map(el => el.textContent);
    
    return {
      className: aside.className,
      childCount: aside.children.length,
      sections: sections,
      fullText: aside.innerHTML?.substring(0, 500),
    };
  });
  console.log('Aside sections:', asideContent?.sections);
  
  // 检查 React 组件树
  const reactInfo = await page.evaluate(() => {
    const aside = document.querySelector('aside');
    if (!aside) return null;
    
    // 检查是否有 data-testid 或其他标记
    const testIds = Array.from(aside.querySelectorAll('[data-testid]')).map(el => el.getAttribute('data-testid'));
    
    // 检查是否有 session table
    const sessionTable = aside.querySelector('table');
    
    return {
      testIds: testIds,
      hasSessionTable: !!sessionTable,
      innerHTML: aside.innerHTML?.substring(0, 1000),
    };
  });
  console.log('React testIds:', reactInfo?.testIds);
  console.log('Has session table:', reactInfo?.hasSessionTable);
  
  // 截图 3: 分析后
  await page.screenshot({ path: 'test-results/session-debug-3.png' });

  // 检查 sessionManager 是否挂载到 window
  const hasSessionManager = await page.evaluate(() => {
    return !!(window as any).sessionManager;
  });

  console.log(`sessionManager 挂载到 window: ${hasSessionManager}`);

  // 检查元素位置和遮挡情况
  const elementInfo = await page.evaluate(() => {
    const rows = document.querySelectorAll('table tbody tr');
    console.log(`Found ${rows.length} table rows`);
    if (rows.length > 1) {
      const row = rows[1];
      const rect = row.getBoundingClientRect();
      const style = window.getComputedStyle(row);
      
      // 检查是否有元素遮挡
      const topElement = document.elementFromPoint(rect.left + rect.width/2, rect.top + rect.height/2);
      
      return {
        rowCount: rows.length,
        rect: {
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
        },
        style: {
          pointerEvents: style.pointerEvents,
          visibility: style.visibility,
          display: style.display,
          opacity: style.opacity,
        },
        isTopElement: topElement === row,
        topElementTag: topElement?.tagName,
      };
    }
    return { rowCount: rows.length };
  });

  console.log(`元素信息:`, elementInfo);
});
