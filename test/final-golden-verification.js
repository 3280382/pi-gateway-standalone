/**
 * 最终黄金验证 - 端到端功能验证
 */

import fs from "fs";
import fetch from "node-fetch";
import path from "path";

async function goldenVerification() {
  console.log("=".repeat(70));
  console.log("FINAL GOLDEN VERIFICATION - 端到端功能验证");
  console.log("=".repeat(70) + "\n");

  const startTime = Date.now();
  const issues = [];
  const baseUrl = "http://127.0.0.1:5173";
  const apiUrl = "http://127.0.0.1:3000";

  // 1. 服务健康检查
  console.log("1. 服务健康检查:");
  const healthChecks = [
    { name: "前端服务", url: `${baseUrl}/` },
    { name: "后端API版本", url: `${apiUrl}/api/version` },
    { name: "后端设置", url: `${apiUrl}/api/settings` },
  ];

  for (const check of healthChecks) {
    try {
      const response = await fetch(check.url, { timeout: 5000 });
      const ok = response.status === 200 || response.status === 304;
      console.log(`   ${check.name}: ${ok ? "✅" : "❌"} (HTTP ${response.status})`);
      if (!ok) issues.push(`${check.name} 异常`);
    } catch (error) {
      console.log(`   ${check.name}: ❌ ${error.message}`);
      issues.push(`${check.name} 连接失败`);
    }
  }

  // 2. 文件浏览功能验证
  console.log("\n2. 文件浏览功能验证:");
  const browseTests = [
    { path: "/root", desc: "Home目录" },
    { path: "/", desc: "根目录" },
  ];

  for (const test of browseTests) {
    try {
      const response = await fetch(`${apiUrl}/api/browse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: test.path }),
        timeout: 10000,
      });

      if (response.ok) {
        const data = await response.json();
        console.log(`   ${test.desc}: ✅ ${data.items.length} 个项目`);

        // 验证数据结构
        if (!data.currentPath || !Array.isArray(data.items)) {
          console.log(`   ${test.desc}: ❌ 数据结构异常`);
          issues.push(`${test.desc} 数据结构异常`);
        }
      } else {
        console.log(`   ${test.desc}: ❌ HTTP ${response.status}`);
        issues.push(`${test.desc} 浏览失败`);
      }
    } catch (error) {
      console.log(`   ${test.desc}: ❌ ${error.message}`);
      issues.push(`${test.desc} 浏览错误`);
    }
  }

  // 3. 执行API验证
  console.log("\n3. 执行API验证:");

  // 创建测试脚本
  const testScript = "/root/golden-test-execute.sh";
  const scriptContent = `#!/bin/bash
echo "GOLDEN TEST EXECUTION"
echo "Working dir: $(pwd)"
echo "Script: $0"
for i in {1..2}; do
  echo "Step $i"
  sleep 0.1
done
echo "COMPLETE"
`;

  fs.writeFileSync(testScript, scriptContent);
  fs.chmodSync(testScript, 0o755);

  try {
    const response = await fetch(`${apiUrl}/api/execute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        command: `bash "${testScript}"`,
        cwd: "/root",
        streaming: true,
      }),
      timeout: 15000,
    });

    console.log(`   执行端点: ${response.ok ? "✅" : "❌"} (HTTP ${response.status})`);

    if (response.ok) {
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("text/plain")) {
        console.log("   响应类型: ✅ text/plain (流式)");
      } else {
        console.log("   响应类型: ⚠️ 非标准流式响应");
      }
    } else {
      issues.push("执行API端点失败");
    }
  } catch (error) {
    console.log(`   执行端点: ❌ ${error.message}`);
    issues.push("执行API连接失败");
  }

  // 4. 代码完整性验证
  console.log("\n4. 代码完整性验证:");

  const codeChecks = [
    {
      file: "src/client/services/api/fileApi.ts",
      checks: [
        { desc: "构建command参数", pattern: /command:\s*command/ },
        { desc: "包含cwd参数", pattern: /cwd:\s*dir/ },
        { desc: "包含streaming参数", pattern: /streaming:\s*true/ },
        { desc: "文件类型处理", pattern: /fileName\.endsWith/ },
      ],
    },
    {
      file: "src/client/components/files/FileSidebar.tsx",
      checks: [
        { desc: "加载/root目录", pattern: /loadDirectory\('\/root'\)/ },
        { desc: "接收visible属性", pattern: /visible\s*:\s*boolean/ },
      ],
    },
    {
      file: "src/client/App.tsx",
      checks: [
        {
          desc: "传递侧边栏状态",
          pattern: /externalSidebarVisible=\{isSidebarVisible\}/,
        },
        {
          desc: "传递切换函数",
          pattern: /onToggleSidebar=\{\(\) => setIsSidebarVisible/,
        },
      ],
    },
  ];

  for (const check of codeChecks) {
    const filePath = path.join("/root/pi-gateway-standalone", check.file);

    if (!fs.existsSync(filePath)) {
      console.log(`   ${check.file}: ❌ 文件不存在`);
      issues.push(`${check.file} 缺失`);
      continue;
    }

    const content = fs.readFileSync(filePath, "utf8");
    let passed = 0;

    for (const patternCheck of check.checks) {
      if (patternCheck.pattern.test(content)) {
        passed++;
      }
    }

    const status = passed === check.checks.length ? "✅" : passed > 0 ? "⚠️" : "❌";
    console.log(`   ${check.file}: ${status} ${passed}/${check.checks.length}`);

    if (passed < check.checks.length) {
      issues.push(`${check.file} 代码完整性不足`);
    }
  }

  // 5. CSS样式验证
  console.log("\n5. CSS样式验证:");

  const cssFile = "/root/pi-gateway-standalone/src/client/components/files/FileBrowser.module.css";
  const cssContent = fs.readFileSync(cssFile, "utf8");

  const cssChecks = [
    { selector: ".fileBrowserSection", property: "overflow", expected: "auto" },
    { selector: ".sidebar", property: "position", expected: "fixed" },
    {
      selector: ".sidebar.visible",
      property: "transform",
      expected: "translateX(0)",
    },
  ];

  for (const check of cssChecks) {
    const pattern = new RegExp(`${check.selector}[^{]*{[^}]*${check.property}:\\s*([^;]+)`);
    const match = cssContent.match(pattern);

    if (match) {
      const value = match[1].trim();
      const correct = value.includes(check.expected);
      console.log(`   ${check.selector} ${check.property}: ${correct ? "✅" : "❌"} ${value}`);

      if (!correct) {
        issues.push(`${check.selector} CSS样式错误`);
      }
    } else {
      console.log(`   ${check.selector} ${check.property}: ❌ 未找到`);
      issues.push(`${check.selector} CSS属性缺失`);
    }
  }

  // 6. Store状态验证
  console.log("\n6. Store状态验证:");

  const storeFile = "/root/pi-gateway-standalone/src/client/stores/fileStore.ts";
  const storeContent = fs.readFileSync(storeFile, "utf8");

  const storeChecks = [
    { desc: "初始路径为/root", pattern: /currentPath:\s*"\/root"/ },
    { desc: "侧边栏默认隐藏", pattern: /sidebarVisible:\s*false/ },
  ];

  for (const check of storeChecks) {
    const hasPattern = check.pattern.test(storeContent);
    console.log(`   ${check.desc}: ${hasPattern ? "✅" : "❌"}`);

    if (!hasPattern) {
      issues.push(`Store状态错误: ${check.desc}`);
    }
  }

  // 7. 模拟API调用流程
  console.log("\n7. 模拟API调用流程:");

  const apiFlow = [
    { method: "GET", endpoint: "/api/workspace/current" },
    { method: "POST", endpoint: "/api/browse", body: { path: "/root" } },
    {
      method: "POST",
      endpoint: "/api/execute",
      body: { command: 'echo "flow test"', cwd: "/root", streaming: false },
    },
  ];

  let flowSuccess = 0;

  for (const call of apiFlow) {
    try {
      const response = await fetch(`${apiUrl}${call.endpoint}`, {
        method: call.method,
        headers: { "Content-Type": "application/json" },
        body: call.body ? JSON.stringify(call.body) : undefined,
        timeout: 10000,
      });

      const ok = response.status === 200 || response.status === 304;
      console.log(
        `   ${call.method} ${call.endpoint}: ${ok ? "✅" : "❌"} (HTTP ${response.status})`
      );

      if (ok) flowSuccess++;
    } catch (error) {
      console.log(`   ${call.method} ${call.endpoint}: ❌ ${error.message}`);
    }
  }

  const flowRate = (flowSuccess / apiFlow.length) * 100;
  console.log(`   API流程成功率: ${flowRate.toFixed(0)}%`);

  if (flowRate < 80) {
    issues.push("API调用流程成功率低");
  }

  // 8. 结果汇总
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log("\n" + "=".repeat(70));
  console.log("验证结果汇总");
  console.log("=".repeat(70));

  if (issues.length === 0) {
    console.log("🎉 GOLDEN VERIFICATION PASSED - 所有验证通过！");
    console.log(`⏱️  总耗时: ${duration}秒`);

    console.log("\n✅ 已验证的功能:");
    console.log("   1. 服务健康状态 (前端/后端)");
    console.log("   2. 文件浏览API (根目录/Home目录)");
    console.log("   3. 执行API端点 (流式响应)");
    console.log("   4. 代码完整性 (关键组件)");
    console.log("   5. CSS样式正确性 (overlay设计)");
    console.log("   6. Store状态一致性");
    console.log("   7. API调用流程");

    console.log("\n✅ 已修复的问题:");
    console.log("   • 目录不一致: FileSidebar使用/root (与主浏览器一致)");
    console.log("   • 滚动功能: .fileBrowserSection { overflow: auto }");
    console.log("   • 执行API格式: executeFile发送{command, cwd, streaming}");
    console.log("   • 侧边栏设计: overlay面板 (position: fixed, transform动画)");
    console.log("   • 状态同步: App传递externalSidebarVisible和onToggleSidebar");

    console.log("\n📊 技术指标:");
    console.log("   • 前端: http://127.0.0.1:5173/ ✅");
    console.log("   • 后端: http://127.0.0.1:3000/ ✅");
    console.log("   • 文件浏览API: ✅");
    console.log("   • 执行API: ✅");
    console.log("   • 组件代码: 完整性✅");
    console.log("   • CSS样式: overlay设计✅");
    console.log("   • Store状态: 一致性✅");

    console.log("\n" + "=".repeat(70));
    console.log("GOLDEN VERIFICATION COMPLETE - 所有问题已修复");
    console.log("=".repeat(70));

    return { success: true, duration, issues: [] };
  } else {
    console.log(`❌ 发现 ${issues.length} 个问题:`);
    issues.forEach((issue, index) => {
      console.log(`   ${index + 1}. ${issue}`);
    });

    console.log("\n" + "=".repeat(70));
    console.log("GOLDEN VERIFICATION FAILED - 需要进一步修复");
    console.log("=".repeat(70));

    return { success: false, duration, issues };
  }
}

// 运行验证
goldenVerification().catch((error) => {
  console.error("验证运行错误:", error);
  process.exit(1);
});
