/**
 * 移动浏览器测试工具
 * 封装手机浏览器的HTTP头和用户代理
 */

import { chromium, devices, firefox, webkit } from "@playwright/test";

// 预定义的移动设备配置
export const MOBILE_DEVICES = {
  // Android设备
  "android-chrome": {
    userAgent:
      "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Mobile Safari/537.36",
    viewport: { width: 360, height: 800 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    defaultBrowserType: "chromium",
  },

  "android-firefox": {
    userAgent: "Mozilla/5.0 (Android 14; Mobile; rv:131.0) Gecko/131.0 Firefox/131.0",
    viewport: { width: 360, height: 800 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    defaultBrowserType: "firefox",
  },

  // iOS设备
  "iphone-12": devices["iPhone 12"],
  "iphone-se": devices["iPhone SE"],
  "ipad-pro": devices["iPad Pro 11"],

  // 其他常见设备
  "samsung-galaxy-s20": {
    userAgent:
      "Mozilla/5.0 (Linux; Android 11; SM-G981B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Mobile Safari/537.36",
    viewport: { width: 360, height: 800 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    defaultBrowserType: "chromium",
  },

  "pixel-5": {
    userAgent:
      "Mozilla/5.0 (Linux; Android 11; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Mobile Safari/537.36",
    viewport: { width: 393, height: 851 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    defaultBrowserType: "chromium",
  },
};

/**
 * 创建移动浏览器上下文
 * @param {string} deviceName - 设备名称
 * @param {string} browserType - 浏览器类型 (chromium, firefox, webkit)
 * @returns {Promise<Object>} 浏览器上下文和页面
 */
export async function createMobileBrowser(deviceName = "android-chrome", browserType = null) {
  const deviceConfig = MOBILE_DEVICES[deviceName] || MOBILE_DEVICES["android-chrome"];
  const browserName = browserType || deviceConfig.defaultBrowserType || "chromium";

  // 选择浏览器
  let browser;
  switch (browserName) {
    case "firefox":
      browser = await firefox.launch({ headless: false });
      break;
    case "webkit":
      browser = await webkit.launch({ headless: false });
      break;
    default:
      browser = await chromium.launch({ headless: false });
  }

  // 创建上下文
  const context = await browser.newContext({
    ...deviceConfig,
    locale: "zh-CN",
    timezoneId: "Asia/Shanghai",
    permissions: ["geolocation"],
    geolocation: { latitude: 39.9042, longitude: 116.4074 }, // 北京
    colorScheme: "light",
  });

  // 添加额外的HTTP头
  await context.addInitScript(() => {
    Object.defineProperty(navigator, "platform", {
      get() {
        return "Linux armv81";
      },
    });

    Object.defineProperty(navigator, "maxTouchPoints", {
      get() {
        return 10;
      },
    });

    // 模拟移动设备特性
    Object.defineProperty(navigator, "userAgentData", {
      get() {
        return {
          brands: [
            { brand: "Chromium", version: "145" },
            { brand: "Google Chrome", version: "145" },
            { brand: "Not;A=Brand", version: "99" },
          ],
          mobile: true,
          platform: "Android",
        };
      },
    });
  });

  const page = await context.newPage();

  return {
    browser,
    context,
    page,
    deviceConfig,
    close: async () => {
      await context.close();
      await browser.close();
    },
  };
}

/**
 * 模拟移动端触摸事件
 * @param {Page} page - Playwright页面对象
 * @param {Object} options - 触摸选项
 */
export async function simulateTouch(page, options) {
  const { x, y, duration = 100, type = "tap" } = options;

  switch (type) {
    case "tap":
      await page.touchscreen.tap(x, y);
      break;

    case "longPress":
      await page.touchscreen.tap(x, y);
      await page.waitForTimeout(duration);
      break;

    case "swipe": {
      const { startX, startY, endX, endY, steps = 10 } = options;
      await page.touchscreen.tap(startX, startY);
      for (let i = 1; i <= steps; i++) {
        const currentX = startX + (endX - startX) * (i / steps);
        const currentY = startY + (endY - startY) * (i / steps);
        await page.touchscreen.tap(currentX, currentY);
        await page.waitForTimeout(10);
      }
      break;
    }

    case "pinch":
      // 模拟双指捏合
      await page.evaluate(
        ({ x, y, scale }) => {
          const event = new TouchEvent("touchstart", {
            touches: [
              new Touch({
                identifier: 1,
                target: document.elementFromPoint(x, y),
                clientX: x - 10,
                clientY: y,
              }),
              new Touch({
                identifier: 2,
                target: document.elementFromPoint(x, y),
                clientX: x + 10,
                clientY: y,
              }),
            ],
          });
          document.dispatchEvent(event);
        },
        { x, y, scale: options.scale || 0.8 }
      );
      break;
  }

  await page.waitForTimeout(100);
}

/**
 * 验证移动端适配性
 * @param {Page} page - Playwright页面对象
 * @returns {Object} 适配性检查结果
 */
export async function checkMobileCompatibility(page) {
  const results = {
    viewport: {},
    touchTargets: [],
    responsive: true,
    issues: [],
  };

  // 检查视口
  const viewportSize = page.viewportSize();
  results.viewport = viewportSize;

  if (viewportSize.width > 600) {
    results.issues.push("视口宽度可能不是移动设备");
  }

  // 检查触摸目标大小
  const buttons = await page.$$('button, [role="button"], a, input, select, textarea');
  for (const button of buttons) {
    const box = await button.boundingBox();
    if (box) {
      const isTouchFriendly = box.width >= 44 && box.height >= 44;
      results.touchTargets.push({
        selector: await button.evaluate(
          (el) => el.tagName + (el.id ? `#${el.id}` : "") + (el.className ? `.${el.className}` : "")
        ),
        width: box.width,
        height: box.height,
        touchFriendly: isTouchFriendly,
      });

      if (!isTouchFriendly) {
        results.issues.push(`触摸目标太小: ${box.width}x${box.height}px`);
      }
    }
  }

  // 检查响应式布局
  await page.setViewportSize({
    width: viewportSize.width,
    height: viewportSize.height,
  });
  await page.waitForTimeout(500);

  const elements = await page.$$("body > *");
  for (const element of elements) {
    const box = await element.boundingBox();
    if (box && box.width > viewportSize.width * 1.1) {
      results.responsive = false;
      results.issues.push("元素宽度超出视口");
      break;
    }
  }

  // 检查移动端特性
  const hasViewportMeta = await page.$('meta[name="viewport"]');
  if (!hasViewportMeta) {
    results.issues.push("缺少viewport meta标签");
  }

  return results;
}

/**
 * 执行移动端功能测试
 * @param {Page} page - Playwright页面对象
 * @param {string} url - 要测试的URL
 * @returns {Object} 测试结果
 */
export async function runMobileFunctionTest(page, url) {
  const results = {
    url,
    timestamp: new Date().toISOString(),
    navigation: {},
    interactions: [],
    errors: [],
  };

  try {
    // 导航到页面
    const startTime = Date.now();
    await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
    results.navigation.loadTime = Date.now() - startTime;
    results.navigation.status = "success";

    // 检查页面标题
    const title = await page.title();
    results.navigation.title = title;

    // 测试基本交互
    const testInteractions = [
      { name: "点击测试", selector: "button, a", action: "click" },
      {
        name: "输入测试",
        selector: 'input[type="text"], textarea',
        action: "type",
        text: "test",
      },
      { name: "滚动测试", action: "scroll" },
    ];

    for (const test of testInteractions) {
      try {
        if (test.selector) {
          const elements = await page.$$(test.selector);
          if (elements.length > 0) {
            const element = elements[0];
            const box = await element.boundingBox();

            if (box && box.width > 0 && box.height > 0) {
              if (test.action === "click") {
                await element.click();
                await page.waitForTimeout(500);
              } else if (test.action === "type" && test.text) {
                await element.fill(test.text);
                await page.waitForTimeout(500);
              }

              results.interactions.push({
                name: test.name,
                status: "success",
                element: await element.evaluate((el) => el.tagName + (el.id ? `#${el.id}` : "")),
              });
            }
          }
        } else if (test.action === "scroll") {
          await page.evaluate(() => window.scrollBy(0, 200));
          await page.waitForTimeout(500);
          results.interactions.push({ name: test.name, status: "success" });
        }
      } catch (error) {
        results.interactions.push({
          name: test.name,
          status: "error",
          error: error.message,
        });
        results.errors.push(`${test.name}失败: ${error.message}`);
      }
    }

    // 检查JavaScript错误
    page.on("pageerror", (error) => {
      results.errors.push(`JavaScript错误: ${error.message}`);
    });

    // 检查控制台错误
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        results.errors.push(`控制台错误: ${msg.text()}`);
      }
    });
  } catch (error) {
    results.navigation.status = "error";
    results.navigation.error = error.message;
    results.errors.push(`导航失败: ${error.message}`);
  }

  return results;
}

/**
 * 生成测试报告
 * @param {Object} results - 测试结果
 * @returns {string} HTML格式的报告
 */
export function generateTestReport(results) {
  const { compatibility, functionTest } = results;

  const report = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>移动端测试报告</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 20px; }
    .summary { background: #f5f5f5; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
    .section { margin-bottom: 30px; }
    .success { color: #2ecc71; }
    .warning { color: #f39c12; }
    .error { color: #e74c3c; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
    th { background: #f8f9fa; }
  </style>
</head>
<body>
  <h1>移动端测试报告</h1>
  <div class="summary">
    <h2>测试概要</h2>
    <p><strong>测试时间:</strong> ${new Date(results.timestamp).toLocaleString()}</p>
    <p><strong>测试URL:</strong> ${functionTest.url}</p>
    <p><strong>设备:</strong> ${results.device}</p>
    <p><strong>总体状态:</strong> <span class="${results.errors.length > 0 ? "warning" : "success"}">${results.errors.length > 0 ? "有警告" : "通过"}</span></p>
  </div>
  
  <div class="section">
    <h2>兼容性检查</h2>
    <p><strong>视口:</strong> ${compatibility.viewport.width} × ${compatibility.viewport.height}px</p>
    <p><strong>响应式布局:</strong> <span class="${compatibility.responsive ? "success" : "error"}">${compatibility.responsive ? "通过" : "失败"}</span></p>
    
    <h3>触摸目标检查</h3>
    <table>
      <tr><th>元素</th><th>尺寸</th><th>触摸友好</th></tr>
      ${compatibility.touchTargets
        .map(
          (target) => `
        <tr>
          <td>${target.selector}</td>
          <td>${Math.round(target.width)}×${Math.round(target.height)}px</td>
          <td class="${target.touchFriendly ? "success" : "error"}">${target.touchFriendly ? "✓" : "✗"}</td>
        </tr>
      `
        )
        .join("")}
    </table>
  </div>
  
  <div class="section">
    <h2>功能测试</h2>
    <p><strong>页面标题:</strong> ${functionTest.navigation.title}</p>
    <p><strong>加载时间:</strong> ${functionTest.navigation.loadTime}ms</p>
    <p><strong>导航状态:</strong> <span class="${functionTest.navigation.status === "success" ? "success" : "error"}">${functionTest.navigation.status}</span></p>
    
    <h3>交互测试</h3>
    <table>
      <tr><th>测试项</th><th>状态</th><th>详情</th></tr>
      ${functionTest.interactions
        .map(
          (interaction) => `
        <tr>
          <td>${interaction.name}</td>
          <td class="${interaction.status === "success" ? "success" : "error"}">${interaction.status}</td>
          <td>${interaction.element || interaction.error || "完成"}</td>
        </tr>
      `
        )
        .join("")}
    </table>
  </div>
  
  ${
    results.errors.length > 0
      ? `
  <div class="section">
    <h2 class="error">发现的问题</h2>
    <ul>
      ${results.errors.map((error) => `<li>${error}</li>`).join("")}
    </ul>
  </div>
  `
      : ""
  }
  
  <div class="section">
    <h2>建议</h2>
    <ul>
      ${compatibility.issues.length > 0 ? compatibility.issues.map((issue) => `<li>${issue}</li>`).join("") : "<li>无重大问题</li>"}
      ${functionTest.errors.length > 0 ? functionTest.errors.map((error) => `<li>修复: ${error}</li>`).join("") : ""}
    </ul>
  </div>
</body>
</html>
  `;

  return report;
}

/**
 * 主测试函数
 * @param {string} url - 要测试的URL
 * @param {string} device - 设备名称
 * @param {boolean} generateReport - 是否生成报告
 */
export async function testMobileBrowser(url, device = 'android-chrome', generateReport = true) {
  console.log(`开始移动端测试: ${url}`);
  console.log(`使用设备: ${device}`);
  
  const { page, close } = await createMobileBrowser(device);
  
  try {
    // 运行兼容性检查
    console.log('运行兼容性检查...');
    const compatibility = await checkMobileCompatibility(page);
    
    // 运行功能测试
    console.log('运行功能测试...');
    const functionTest = await runMobileFunctionTest(page, url);
    
    // 收集所有错误
    const allErrors = [...compatibility.issues, ...functionTest.errors];
    
    const results = {
      timestamp: new Date().toISOString(),
      device,
      url,
      compatibility,
      functionTest,
      errors: allErrors,
      success: allErrors.length === 0
    };
    
    console.log(`测试完成. 发现 ${allErrors.length} 个问题`);
    
    if (generateReport) {
      const report = generateTest
