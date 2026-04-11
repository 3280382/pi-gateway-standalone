/**
 * 验证所有修复
 */

import fs from "node:fs";
import path from "node:path";
import fetch from "node-fetch";

async function verifyAllFixes() {
  console.log("=== 验证所有修复 ===\n");

  console.log("修复的问题:");
  console.log("1. ✅ 左右面板目录不一致 - FileSidebar现在使用/root");
  console.log("2. ✅ 滚动问题 - CSS overflow已修复");
  console.log("3. ✅ 执行API不匹配 - executeFile现在发送正确格式");
  console.log("4. ⏳ 文件查看窗口异常 - 需要进一步测试");
  console.log("5. ⏳ 左侧面板加载 - 需要进一步测试\n");

  const results = [];

  // 1. 测试执行API
  console.log("1. 测试执行API修复:");

  const testScript = "/root/test-execute.sh";

  // 确保测试脚本存在
  if (!fs.existsSync(testScript)) {
    const scriptContent = `#!/bin/bash
echo "测试脚本执行成功"
echo "当前目录: $(pwd)"
echo "参数: $@"
sleep 0.2
echo "完成"
`;
    fs.writeFileSync(testScript, scriptContent);
    fs.chmodSync(testScript, 0o755);
    console.log(`   创建测试脚本: ${testScript}`);
  }

  try {
    // 测试执行端点
    const response = await fetch("http://127.0.0.1:3000/api/execute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        command: `bash "${testScript}"`,
        cwd: "/root",
        streaming: true,
      }),
    });

    console.log(`   执行端点: ${response.status} ${response.statusText}`);

    if (response.ok && response.body) {
      console.log("   ✅ 执行端点正常（流式响应）");

      // 尝试读取流
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let output = "";

      try {
        const { value } = await reader.read();
        if (value) {
          output = decoder.decode(value);
          console.log(`   输出片段: ${output.substring(0, 100)}...`);
        }
        reader.releaseLock();
      } catch (streamError) {
        console.log(`   流读取: ⚠️ ${streamError.message}`);
      }
    } else {
      console.log(`   ❌ 执行端点失败: ${response.status}`);
      results.push(`执行API失败: HTTP ${response.status}`);
    }
  } catch (error) {
    console.log(`   ❌ 错误: ${error.message}`);
    results.push(`执行API错误: ${error.message}`);
  }

  // 2. 验证目录一致性
  console.log("\n2. 验证目录一致性:");

  const pathsToCheck = [
    {
      name: "FileStore初始路径",
      file: "src/client/stores/fileStore.ts",
      pattern: 'currentPath: "/root"',
    },
    {
      name: "FileSidebar加载路径",
      file: "src/client/components/files/FileSidebar.tsx",
      pattern: "loadDirectory('/root')",
    },
  ];

  for (const check of pathsToCheck) {
    try {
      const filePath = path.join("/root/pi-gateway-standalone", check.file);
      const content = fs.readFileSync(filePath, "utf8");
      const hasPattern = content.includes(check.pattern);

      console.log(`   ${check.name}: ${hasPattern ? "✅" : "❌"}`);

      if (!hasPattern) {
        results.push(`${check.name} 不一致`);
      }
    } catch (error) {
      console.log(`   ${check.name}: ❌ ${error.message}`);
    }
  }

  // 3. 验证滚动CSS
  console.log("\n3. 验证滚动CSS:");

  const cssFile = "/root/pi-gateway-standalone/src/client/components/files/FileBrowser.module.css";
  const cssContent = fs.readFileSync(cssFile, "utf8");

  const overflowChecks = [
    { selector: ".fileBrowserSection", expected: "overflow: auto" },
    { selector: ".sidebar", expected: "overflow-y: auto" },
  ];

  for (const check of overflowChecks) {
    const hasProperty =
      cssContent.includes(check.expected) &&
      cssContent.indexOf(check.expected) > cssContent.indexOf(check.selector);

    console.log(`   ${check.selector}: ${hasProperty ? "✅" : "❌"}`);

    if (!hasProperty) {
      results.push(`${check.selector} CSS不正确`);
    }
  }

  // 4. 验证executeFile函数
  console.log("\n4. 验证executeFile函数:");

  const apiFile = "/root/pi-gateway-standalone/src/client/services/api/fileApi.ts";
  const apiContent = fs.readFileSync(apiFile, "utf8");

  const apiChecks = [
    { check: "构建command参数", pattern: "command:" },
    { check: "包含cwd参数", pattern: "cwd:" },
    { check: "包含streaming参数", pattern: "streaming: true" },
    { check: "处理不同文件类型", pattern: "fileName.endsWith" },
  ];

  for (const check of apiChecks) {
    const hasPattern = apiContent.includes(check.pattern);
    console.log(`   ${check.check}: ${hasPattern ? "✅" : "❌"}`);

    if (!hasPattern) {
      results.push(`executeFile函数缺少${check.check}`);
    }
  }

  // 5. 测试文件浏览
  console.log("\n5. 测试文件浏览:");

  try {
    const response = await fetch("http://127.0.0.1:3000/api/browse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: "/root" }),
    });

    if (response.ok) {
      const data = await response.json();
      console.log(`   ✅ 文件浏览正常: ${data.items.length} 个项目`);

      // 检查是否有测试脚本
      const hasTestScript = data.items.some((item) => item.name === "test-execute.sh");
      console.log(`   找到测试脚本: ${hasTestScript ? "✅" : "❌"}`);

      if (!hasTestScript) {
        console.log("   ⚠️ 可能需要刷新页面或重新加载");
      }
    } else {
      console.log(`   ❌ 文件浏览失败: ${response.status}`);
      results.push(`文件浏览API失败: HTTP ${response.status}`);
    }
  } catch (error) {
    console.log(`   ❌ 错误: ${error.message}`);
    results.push(`文件浏览错误: ${error.message}`);
  }

  // 6. 总结
  console.log("\n=== 验证结果 ===");

  if (results.length === 0) {
    console.log("✅ 所有修复验证通过");
    console.log("\n📋 需要手动测试的功能:");
    console.log("   1. 访问 http://127.0.0.1:5173/");
    console.log('   2. 点击"Files"切换到文件视图');
    console.log("   3. 点击左下角左右箭头按钮打开侧边栏");
    console.log("   4. 检查左侧面板是否显示/root目录内容");
    console.log("   5. 检查是否可以上下滚动");
    console.log("   6. 找到test-execute.sh文件");
    console.log("   7. 点击执行按钮（绿色按钮）");
    console.log("   8. 检查是否有执行输出");
    console.log("   9. 点击文件查看/编辑功能");
  } else {
    console.log(`发现 ${results.length} 个问题:`);
    results.forEach((issue, index) => {
      console.log(`   ${index + 1}. ${issue}`);
    });
  }

  // 7. 已知限制
  console.log("\n=== 已知限制 ===");
  console.log("1. 执行权限: 某些目录可能因权限限制无法执行");
  console.log("2. 文件查看: 需要store状态正确同步");
  console.log("3. 侧边栏加载: 依赖API响应时间");

  console.log("\n=== 验证完成 ===");
  return { results };
}

verifyAllFixes().catch((error) => {
  console.error("验证错误:", error);
  process.exit(1);
});
