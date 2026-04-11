/**
 * 诊断左侧面板（FileSidebar）不显示的问题
 */

import { JSDOM } from "jsdom";
import fetch from "node-fetch";

async function diagnoseSidebarIssue() {
  console.log("=== 诊断左侧面板（FileSidebar）问题 ===\n");

  const issues = [];

  // 1. 检查前端页面是否包含FileSidebar组件
  console.log("1. 检查前端页面结构...");
  try {
    const response = await fetch("http://127.0.0.1:5173/");
    const html = await response.text();
    const dom = new JSDOM(html);
    const _document = dom.window.document;

    // 检查是否有FileSidebar相关的元素
    const hasFileSidebar =
      html.includes("FileSidebar") || html.includes("file-sidebar") || html.includes("sidebar");

    console.log(`   HTML中包含FileSidebar相关代码: ${hasFileSidebar ? "✅" : "❌"}`);

    if (!hasFileSidebar) {
      issues.push("前端HTML中未找到FileSidebar组件代码");
    }

    // 检查CSS类名
    const sidebarClasses = ["sidebar", "fileSidebar", "tree", "directoryTree"];
    const foundClasses = sidebarClasses.filter((cls) => html.includes(cls));
    console.log(
      `   找到的侧边栏相关CSS类: ${foundClasses.length > 0 ? foundClasses.join(", ") : "❌ 无"}`
    );
  } catch (error) {
    console.log(`   ❌ 错误: ${error.message}`);
    issues.push(`前端页面访问错误: ${error.message}`);
  }

  // 2. 检查FileSidebar组件是否被导入和渲染
  console.log("\n2. 检查组件导入...");
  try {
    // 检查主应用文件是否导入FileSidebar
    const appResponse = await fetch("http://127.0.0.1:5173/src/client/App.tsx");
    const appCode = await appResponse.text();

    const importsFileSidebar =
      appCode.includes("FileSidebar") || appCode.includes("./components/files/FileSidebar");

    console.log(`   App.tsx导入FileSidebar: ${importsFileSidebar ? "✅" : "❌"}`);

    if (!importsFileSidebar) {
      issues.push("App.tsx未导入FileSidebar组件");
    }

    // 检查FileBrowser是否导入FileSidebar
    const fbResponse = await fetch(
      "http://127.0.0.1:5173/src/client/components/files/FileBrowser.tsx"
    );
    const fbCode = await fbResponse.text();

    const fbImportsSidebar = fbCode.includes("FileSidebar") || fbCode.includes("./FileSidebar");

    console.log(`   FileBrowser.tsx导入FileSidebar: ${fbImportsSidebar ? "✅" : "❌"}`);

    if (!fbImportsSidebar) {
      issues.push("FileBrowser.tsx未导入FileSidebar组件");
    }
  } catch (error) {
    console.log(`   ❌ 错误: ${error.message}`);
  }

  // 3. 检查API数据
  console.log("\n3. 检查API数据...");
  try {
    // 测试FileSidebar可能调用的API
    const apiTests = [
      {
        name: "浏览根目录",
        url: "http://127.0.0.1:3000/api/browse",
        method: "POST",
        body: { path: "/" },
      },
      {
        name: "浏览home目录",
        url: "http://127.0.0.1:3000/api/browse",
        method: "POST",
        body: { path: "/home" },
      },
      {
        name: "浏览root目录",
        url: "http://127.0.0.1:3000/api/browse",
        method: "POST",
        body: { path: "/root" },
      },
    ];

    for (const test of apiTests) {
      const options = {
        method: test.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(test.body),
      };

      const response = await fetch(test.url, options);

      if (response.ok) {
        const data = await response.json();
        console.log(`   ✅ ${test.name}: 成功 (${data.items.length} 个项目)`);

        // 检查数据结构
        const hasDirectories = data.items.some((item) => item.isDirectory);
        console.log(`      包含目录: ${hasDirectories ? "✅" : "❌"}`);

        if (!hasDirectories) {
          issues.push(`${test.name}返回的数据中没有目录项，侧边栏无法显示树结构`);
        }
      } else {
        console.log(`   ❌ ${test.name}: HTTP ${response.status}`);
        issues.push(`${test.name} API失败: HTTP ${response.status}`);
      }
    }
  } catch (error) {
    console.log(`   ❌ 错误: ${error.message}`);
    issues.push(`API检查错误: ${error.message}`);
  }

  // 4. 检查CSS样式
  console.log("\n4. 检查CSS样式...");
  try {
    // 获取FileBrowser的CSS模块
    const cssResponse = await fetch(
      "http://127.0.0.1:5173/src/client/components/files/FileBrowser.module.css"
    );
    const cssContent = await cssResponse.text();

    const sidebarStyles = [
      ".sidebar",
      ".fileSidebar",
      ".tree",
      ".directoryTree",
      ".treeItem",
      ".treeChildren",
    ];

    const foundStyles = sidebarStyles.filter((style) => cssContent.includes(style));
    console.log(
      `   找到的侧边栏相关CSS样式: ${foundStyles.length > 0 ? foundStyles.join(", ") : "❌ 无"}`
    );

    if (foundStyles.length === 0) {
      issues.push("CSS文件中未找到侧边栏相关样式");
    }

    // 检查是否有隐藏侧边栏的样式
    const hidingStyles = ["display: none", "visibility: hidden", "width: 0", "opacity: 0"];
    const hasHidingStyles = hidingStyles.some((style) => cssContent.includes(style));
    console.log(`   有隐藏样式: ${hasHidingStyles ? "⚠️ 可能有隐藏样式" : "✅ 无"}`);
  } catch (error) {
    console.log(`   ❌ 错误: ${error.message}`);
  }

  // 5. 检查JavaScript控制台错误
  console.log("\n5. 模拟JavaScript执行...");
  console.log("   ⚠️ 需要真实浏览器环境检查控制台错误");
  console.log("   建议在浏览器中打开 http://127.0.0.1:5173/ 并检查:");
  console.log("     - 按F12打开开发者工具");
  console.log("     - 查看Console标签页是否有错误");
  console.log("     - 查看Network标签页的API请求");
  console.log("     - 查看Elements标签页的DOM结构");

  // 6. 总结问题
  console.log("\n=== 问题诊断总结 ===");

  if (issues.length === 0) {
    console.log("✅ 未发现明显问题");
    console.log("可能的原因:");
    console.log("  1. 侧边栏被CSS隐藏 (display: none, visibility: hidden)");
    console.log("  2. 需要用户交互才能显示 (如点击按钮展开)");
    console.log("  3. 移动端响应式设计在小屏幕上隐藏了侧边栏");
    console.log("  4. JavaScript执行错误导致组件未渲染");
  } else {
    console.log(`发现 ${issues.length} 个问题:`);
    issues.forEach((issue, index) => {
      console.log(`  ${index + 1}. ${issue}`);
    });
  }

  // 7. 建议的调试步骤
  console.log("\n=== 建议的调试步骤 ===");
  console.log("1. 在浏览器中检查DOM结构:");
  console.log('   查找是否有 <div class="sidebar"> 或类似元素');
  console.log("2. 检查CSS计算样式:");
  console.log("   右键点击疑似侧边栏元素 → 检查 → 查看Computed样式");
  console.log("3. 检查JavaScript错误:");
  console.log("   查看Console中是否有FileSidebar相关的错误");
  console.log("4. 检查网络请求:");
  console.log("   查看Network标签页是否有 /api/browse 请求");
  console.log("5. 检查React组件树:");
  console.log("   安装React Developer Tools扩展，查看组件层次");

  console.log("\n=== 诊断完成 ===");
  return { issues };
}

// 运行诊断
diagnoseSidebarIssue().catch((error) => {
  console.error("诊断运行错误:", error);
  process.exit(1);
});
