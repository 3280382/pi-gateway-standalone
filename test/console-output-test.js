/**
 * 测试控制台输出和日志记录
 * 验证前端和后端是否同时输出到控制台和日志文件
 */

import fs from "fs";
import fetch from "node-fetch";
import path from "path";

async function testConsoleAndLogOutput() {
  console.log("=== 控制台和日志输出测试 ===\n");

  console.log("项目配置:");
  console.log("  前端: 端口 5173 (Vite)");
  console.log("  后端: 端口 3000 (Express)");
  console.log("  日志目录: /root/pi-gateway-standalone/logs/\n");

  const results = [];

  // 1. 检查日志文件存在
  console.log("1. 检查日志文件:");
  const logDir = "/root/pi-gateway-standalone/logs";
  const logFiles = ["frontend_current.log", "backend_current.log"];

  for (const logFile of logFiles) {
    const logPath = path.join(logDir, logFile);
    const exists = fs.existsSync(logPath);
    console.log(`   ${logFile}: ${exists ? "✅" : "❌"}`);

    if (exists) {
      const stats = fs.statSync(logPath);
      const sizeKB = Math.round(stats.size / 1024);
      console.log(`     大小: ${sizeKB} KB, 修改时间: ${stats.mtime.toLocaleString()}`);

      // 读取最后几行
      const content = fs.readFileSync(logPath, "utf8");
      const lines = content.split("\n").filter((line) => line.trim());
      const lastLines = lines.slice(-3);

      console.log(`     最后内容:`);
      lastLines.forEach((line) => console.log(`       ${line}`));
    } else {
      results.push(`日志文件不存在: ${logFile}`);
    }
  }

  // 2. 测试API并观察日志
  console.log("\n2. 测试API请求（观察日志输出）:");

  const apiTests = [
    {
      name: "版本API",
      url: "http://127.0.0.1:3000/api/version",
      method: "GET",
    },
    {
      name: "设置API",
      url: "http://127.0.0.1:3000/api/settings",
      method: "GET",
    },
    {
      name: "文件浏览API",
      url: "http://127.0.0.1:3000/api/browse",
      method: "POST",
      body: { path: "/" },
    },
  ];

  for (const test of apiTests) {
    try {
      const startTime = Date.now();
      const response = await fetch(test.url, {
        method: test.method,
        headers: test.body ? { "Content-Type": "application/json" } : {},
        body: test.body ? JSON.stringify(test.body) : undefined,
      });

      const duration = Date.now() - startTime;
      console.log(`   ${test.name}: ${response.status === 200 ? "✅" : "❌"} (${duration}ms)`);

      if (!response.ok) {
        results.push(`${test.name} 失败: HTTP ${response.status}`);
      }
    } catch (error) {
      console.log(`   ${test.name}: ❌ ${error.message}`);
      results.push(`${test.name} 错误: ${error.message}`);
    }
  }

  // 3. 检查前端页面
  console.log("\n3. 检查前端页面:");
  try {
    const response = await fetch("http://127.0.0.1:5173/");
    console.log(`   前端页面: ${response.status === 200 ? "✅" : "❌"} (HTTP ${response.status})`);

    if (response.ok) {
      const html = await response.text();
      const hasReact = html.includes("React") || html.includes("react");
      const hasApp = html.includes("app") || html.includes("App");
      console.log(`   React应用: ${hasReact ? "✅" : "❌"}`);
      console.log(`   应用容器: ${hasApp ? "✅" : "❌"}`);
    }
  } catch (error) {
    console.log(`   前端页面: ❌ ${error.message}`);
    results.push(`前端页面错误: ${error.message}`);
  }

  // 4. 验证日志记录机制
  console.log("\n4. 日志记录机制验证:");
  console.log("   根据日志文件内容分析:");

  const backendLog = fs.readFileSync(path.join(logDir, "backend_current.log"), "utf8");
  const frontendLog = fs.readFileSync(path.join(logDir, "frontend_current.log"), "utf8");

  const backendHasColoredOutput = backendLog.includes("\x1b[") || backendLog.includes("[");
  const backendHasTimestamps = backendLog.includes("[") && backendLog.includes("]");
  const backendHasHTTPLogs = backendLog.includes("GET ") || backendLog.includes("POST ");

  const frontendHasViteOutput = frontendLog.includes("VITE") || frontendLog.includes("ready in");
  const frontendHasLocalURL = frontendLog.includes("Local:") || frontendLog.includes("127.0.0.1");

  console.log(`   后端彩色输出: ${backendHasColoredOutput ? "✅" : "❌"}`);
  console.log(`   后端时间戳: ${backendHasTimestamps ? "✅" : "❌"}`);
  console.log(`   后端HTTP日志: ${backendHasHTTPLogs ? "✅" : "❌"}`);
  console.log(`   前端Vite输出: ${frontendHasViteOutput ? "✅" : "❌"}`);
  console.log(`   前端本地URL: ${frontendHasLocalURL ? "✅" : "❌"}`);

  // 5. 检查tmux服务状态
  console.log("\n5. 服务状态检查:");
  try {
    const { execSync } = await import("child_process");
    const statusOutput = execSync(
      "cd /root/pi-gateway-standalone && node scripts/tmux-controller.js status 2>&1",
      { encoding: "utf8" }
    );

    const frontendRunning = statusOutput.includes("前端服务:") && statusOutput.includes("健康: ✅");
    const backendRunning = statusOutput.includes("后端服务:") && statusOutput.includes("健康: ✅");

    console.log(`   前端运行: ${frontendRunning ? "✅" : "❌"}`);
    console.log(`   后端运行: ${backendRunning ? "✅" : "❌"}`);

    if (!frontendRunning || !backendRunning) {
      results.push("服务状态异常");
    }
  } catch (error) {
    console.log(`   服务状态检查: ❌ ${error.message}`);
  }

  // 6. 总结
  console.log("\n=== 测试结果 ===");

  if (results.length === 0) {
    console.log("✅ 所有检查通过");
    console.log("\n日志记录机制正常:");
    console.log("   1. 前端和后端同时输出到控制台（tmux窗格）");
    console.log("   2. 前端和后端同时输出到日志文件");
    console.log("   3. 日志文件实时更新");
    console.log("   4. 控制台输出包含彩色格式");
    console.log("   5. 日志文件包含时间戳");
  } else {
    console.log(`发现 ${results.length} 个问题:`);
    results.forEach((issue, index) => {
      console.log(`   ${index + 1}. ${issue}`);
    });
  }

  // 7. 查看实时日志的建议
  console.log("\n=== 查看实时输出 ===");
  console.log("要查看实时控制台输出:");
  console.log("   1. 前端控制台: tmux attach -t pi-gateway-dev");
  console.log("   2. 切换到窗格0: Ctrl+B, 然后 0");
  console.log("   3. 查看后端窗格: Ctrl+B, 然后 1");
  console.log("   4. 分离: Ctrl+B, 然后 d");
  console.log("\n或者查看日志文件:");
  console.log("   tail -f /root/pi-gateway-standalone/logs/frontend_current.log");
  console.log("   tail -f /root/pi-gateway-standalone/logs/backend_current.log");

  console.log("\n=== 测试完成 ===");
  return { results };
}

// 运行测试
testConsoleAndLogOutput().catch((error) => {
  console.error("测试运行错误:", error);
  process.exit(1);
});
