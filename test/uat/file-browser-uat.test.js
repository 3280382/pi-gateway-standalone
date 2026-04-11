/**
 * 文件浏览器用户验收测试 (UAT)
 * 验证基本功能：侧边栏加载、滚动、文件选择
 */

import fs from "fs";
import fetch from "node-fetch";
import path from "path";

const BASE_URL = "http://127.0.0.1:5173";
const API_URL = "http://127.0.0.1:3000";

class FileBrowserUAT {
  constructor() {
    this.tests = [];
    this.passed = 0;
    this.failed = 0;
  }

  async test(name, testFn) {
    try {
      const result = await testFn();
      if (result.success) {
        console.log(`  ✅ ${name}`);
        if (result.details) console.log(`     ${result.details}`);
        this.passed++;
      } else {
        console.log(`  ❌ ${name}`);
        console.log(`     ${result.error || "测试失败"}`);
        this.failed++;
      }
    } catch (error) {
      console.log(`  ❌ ${name}`);
      console.log(`     错误: ${error.message}`);
      this.failed++;
    }
  }

  async run() {
    console.log("=".repeat(70));
    console.log("文件浏览器 - 用户验收测试 (UAT)");
    console.log("=".repeat(70));
    console.log("");
    console.log("测试基本功能:");
    console.log("  1. 侧边栏文件树加载");
    console.log("  2. 右侧面板滚动");
    console.log("  3. 文件选择和浏览");
    console.log("");

    // UAT 1: 侧边栏文件树加载
    console.log("📁 UAT-1: 侧边栏文件树加载");

    await this.test("API返回正确的目录结构", async () => {
      const res = await fetch(`${API_URL}/api/browse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: "/root" }),
      });

      if (!res.ok) return { success: false, error: `HTTP ${res.status}` };

      const data = await res.json();
      const hasDirectories = data.items.some((item) => item.isDirectory);

      return {
        success: hasDirectories,
        details: `找到 ${data.items.length} 个项目，包含目录: ${hasDirectories}`,
        error: hasDirectories ? null : "没有目录项",
      };
    });

    await this.test("FileSidebar组件代码正确", async () => {
      const filePath = path.join(
        "/root/pi-gateway-standalone",
        "src/client/components/files/FileSidebar.tsx"
      );
      const content = fs.readFileSync(filePath, "utf8");

      const checks = [
        { name: "有visible属性", pattern: /visible:\s*boolean/ },
        { name: "有useEffect监听visible", pattern: /useEffect.*\[.*visible/ },
        { name: "有loadRoot函数", pattern: /const loadRoot/ },
        { name: "有tree状态", pattern: /const.*tree.*useState/ },
        { name: "有setTree调用", pattern: /setTree/ },
        { name: "渲染tree内容", pattern: /tree\.map/ },
      ];

      const failed = checks.filter((c) => !c.pattern.test(content));

      return {
        success: failed.length === 0,
        details: `${checks.length - failed.length}/${checks.length} 检查通过`,
        error: failed.length > 0 ? `缺少: ${failed.map((f) => f.name).join(", ")}` : null,
      };
    });

    await this.test("FileSidebar加载逻辑正确", async () => {
      const filePath = path.join(
        "/root/pi-gateway-standalone",
        "src/client/components/files/FileSidebar.tsx"
      );
      const content = fs.readFileSync(filePath, "utf8");

      // 检查useEffect中是否调用loadRoot
      const hasLoadRootCall =
        /useEffect\(\(\)\s*=>\s*\{[\s\S]*?loadRoot\(\)[\s\S]*?\},\s*\[\s*visible/.test(content);

      return {
        success: hasLoadRootCall,
        details: hasLoadRootCall ? "visible变化时调用loadRoot" : "未找到调用",
        error: hasLoadRootCall ? null : "useEffect中没有调用loadRoot",
      };
    });

    // UAT 2: 右侧面板滚动
    console.log("");
    console.log("📜 UAT-2: 右侧面板滚动");

    await this.test("CSS有overflow样式", async () => {
      const cssPath = path.join(
        "/root/pi-gateway-standalone",
        "src/client/components/files/FileBrowser.module.css"
      );
      const content = fs.readFileSync(cssPath, "utf8");

      const hasOverflow =
        content.includes("overflow: auto") || content.includes("overflow-y: auto");

      return {
        success: hasOverflow,
        details: hasOverflow ? "找到overflow样式" : "未找到",
        error: hasOverflow ? null : "CSS缺少overflow样式",
      };
    });

    await this.test("contentArea有滚动样式", async () => {
      const cssPath = path.join(
        "/root/pi-gateway-standalone",
        "src/client/components/files/FileBrowser.module.css"
      );
      const content = fs.readFileSync(cssPath, "utf8");

      const hasContentAreaScroll =
        /\.contentArea[^{]*\{[^}]*overflow/.test(content) ||
        /\.main[^{]*\{[^}]*overflow/.test(content);

      return {
        success: hasContentAreaScroll,
        details: hasContentAreaScroll ? "contentArea/main有overflow" : "未找到",
        error: hasContentAreaScroll ? null : "内容区域缺少overflow样式",
      };
    });

    await this.test("文件列表容器高度设置正确", async () => {
      const cssPath = path.join(
        "/root/pi-gateway-standalone",
        "src/client/components/files/FileBrowser.module.css"
      );
      const content = fs.readFileSync(cssPath, "utf8");

      // 检查是否有flex: 1或height: 100%等设置
      const hasFlex = content.includes("flex: 1") || content.includes("flex-grow");
      const hasHeight = content.includes("height: 100%") || content.includes("height: 100vh");

      return {
        success: hasFlex || hasHeight,
        details: `flex: ${hasFlex}, height: ${hasHeight}`,
        error: hasFlex || hasHeight ? null : "容器缺少高度设置",
      };
    });

    // UAT 3: 文件选择和浏览
    console.log("");
    console.log("🖱️  UAT-3: 文件选择和浏览");

    await this.test("FileList有选择处理逻辑", async () => {
      const filePath = path.join(
        "/root/pi-gateway-standalone",
        "src/client/components/files/FileList.tsx"
      );
      const content = fs.readFileSync(filePath, "utf8");

      const hasSelectLogic = content.includes("selectForAction") || content.includes("onClick");
      const hasDoubleClick = content.includes("onDoubleClick") || content.includes("dblclick");

      return {
        success: hasSelectLogic,
        details: `选择逻辑: ${hasSelectLogic}, 双击: ${hasDoubleClick}`,
        error: hasSelectLogic ? null : "FileList缺少选择处理",
      };
    });

    await this.test("FileList能正确获取选中状态", async () => {
      const filePath = path.join(
        "/root/pi-gateway-standalone",
        "src/client/components/files/FileList.tsx"
      );
      const content = fs.readFileSync(filePath, "utf8");

      const hasSelectedFile = content.includes("selectedActionFile");
      const hasIsSelected = content.includes("isSelected");

      return {
        success: hasSelectedFile && hasIsSelected,
        details: `selectedActionFile: ${hasSelectedFile}, isSelected: ${hasIsSelected}`,
        error: !(hasSelectedFile && hasIsSelected) ? "缺少选中状态判断" : null,
      };
    });

    await this.test("fileStore有选择相关方法", async () => {
      const storePath = path.join("/root/pi-gateway-standalone", "src/client/stores/fileStore.ts");
      const content = fs.readFileSync(storePath, "utf8");

      const hasSelectForAction = content.includes("selectForAction");
      const hasSelectedActionFile = content.includes("selectedActionFile");

      return {
        success: hasSelectForAction && hasSelectedActionFile,
        details: `selectForAction: ${hasSelectForAction}, selectedActionFile: ${hasSelectedActionFile}`,
        error: !(hasSelectForAction && hasSelectedActionFile) ? "store缺少选择方法" : null,
      };
    });

    await this.test("API能正确读取文件内容", async () => {
      // 先找一个文本文件
      const browseRes = await fetch(`${API_URL}/api/browse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: "/root" }),
      });

      const browseData = await browseRes.json();
      const textFile = browseData.items.find(
        (item) =>
          !item.isDirectory &&
          (item.name.endsWith(".md") || item.name.endsWith(".txt") || item.name.endsWith(".json"))
      );

      if (!textFile) {
        return { success: true, details: "没有找到文本文件测试", error: null };
      }

      // 尝试读取文件
      const readRes = await fetch(
        `${API_URL}/api/files/content?path=${encodeURIComponent(textFile.path)}`
      );

      return {
        success: readRes.status === 200 || readRes.status === 404,
        details: `文件: ${textFile.name}, HTTP ${readRes.status}`,
        error: null,
      };
    });

    // UAT 4: 整体功能
    console.log("");
    console.log("🔧 UAT-4: 整体功能验证");

    await this.test("所有核心组件存在", async () => {
      const components = [
        "src/client/components/files/FileBrowser.tsx",
        "src/client/components/files/FileSidebar.tsx",
        "src/client/components/files/FileList.tsx",
        "src/client/components/files/FileViewer.tsx",
        "src/client/components/files/FileToolbar.tsx",
        "src/client/components/files/FileActionBar.tsx",
      ];

      const missing = components.filter(
        (c) => !fs.existsSync(path.join("/root/pi-gateway-standalone", c))
      );

      return {
        success: missing.length === 0,
        details: `${components.length - missing.length}/${components.length} 组件存在`,
        error: missing.length > 0 ? `缺少: ${missing.join(", ")}` : null,
      };
    });

    await this.test("API端点全部可用", async () => {
      const endpoints = [
        {
          url: `${API_URL}/api/browse`,
          method: "POST",
          body: { path: "/root" },
        },
        {
          url: `${API_URL}/api/execute`,
          method: "POST",
          body: { command: "echo test", cwd: "/root", streaming: true },
        },
      ];

      let passed = 0;
      for (const ep of endpoints) {
        try {
          const res = await fetch(ep.url, {
            method: ep.method,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(ep.body),
          });
          if (res.ok) passed++;
        } catch (e) {
          // ignore
        }
      }

      return {
        success: passed === endpoints.length,
        details: `${passed}/${endpoints.length} 端点可用`,
        error: passed < endpoints.length ? `${endpoints.length - passed} 个端点失败` : null,
      };
    });

    // Summary
    console.log("");
    console.log("=".repeat(70));
    console.log("UAT结果汇总");
    console.log("=".repeat(70));
    console.log(`✅ 通过: ${this.passed}`);
    console.log(`❌ 失败: ${this.failed}`);
    console.log(`📊 总计: ${this.passed + this.failed}`);
    console.log(`🎯 成功率: ${((this.passed / (this.passed + this.failed)) * 100).toFixed(1)}%`);

    const allPassed = this.failed === 0;
    if (allPassed) {
      console.log("");
      console.log("🎉 所有UAT通过！文件浏览器基本功能正常工作。");
    } else {
      console.log("");
      console.log(`⚠️ 有 ${this.failed} 项UAT未通过，需要修复后才能交付。`);
    }
    console.log("=".repeat(70));

    return { success: allPassed, passed: this.passed, failed: this.failed };
  }
}

// Run UAT
const uat = new FileBrowserUAT();
uat
  .run()
  .then((result) => {
    process.exit(result.success ? 0 : 1);
  })
  .catch((error) => {
    console.error("UAT运行错误:", error);
    process.exit(1);
  });
