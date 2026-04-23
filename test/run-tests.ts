/**
 * Unified Test Runner - 统一测试运行器
 * 规范：所有测试通过此入口运行，确保输出一致性
 *
 * Usage:
 *   npx tsx test/run-tests.ts [unit|integration|e2e|terminal|all]
 */

import { spawn } from "node:child_process";
import {
  appendFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  readlinkSync,
  writeFileSync,
} from "node:fs";

// ========== 配置 ==========
const TEST_TIMESTAMP = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const PROJECT_ROOT = "/root/pi-gateway-standalone";
const RESULTS_DIR = `${PROJECT_ROOT}/logs/test/${TEST_TIMESTAMP}`;
const BACKUP_DIR = `${PROJECT_ROOT}/logs/test/backups`;
const LATEST_LINK = `${PROJECT_ROOT}/logs/test/latest`;

// Unified development environment port
const TEST_PORT = 3000;

const TEST_CONFIG = {
  port: TEST_PORT,
  timestamp: TEST_TIMESTAMP,
  resultsDir: RESULTS_DIR,
};

// 测试类型
const TEST_TYPE = process.argv[2] || "all";

// 统计
const stats = {
  total: 0,
  passed: 0,
  failed: 0,
  skipped: 0,
  duration: 0,
};

// ========== 颜色 ==========
const colors = {
  reset: "\x1b[0m",
  red: "\x1b[0;31m",
  green: "\x1b[0;32m",
  yellow: "\x1b[1;33m",
  blue: "\x1b[0;34m",
  cyan: "\x1b[0;36m",
};

function log(level: string, message: string, data?: unknown) {
  const timestamp = new Date().toISOString();
  const color =
    level === "ERROR"
      ? colors.red
      : level === "SUCCESS"
        ? colors.green
        : level === "WARN"
          ? colors.yellow
          : colors.blue;

  const dataStr = data ? ` ${JSON.stringify(data)}` : "";
  const entry = `[${timestamp}] [${level}] ${message}${dataStr}`;

  console.log(`${color}${entry}${colors.reset}`);

  // 写入主日志（如果目录已存在）
  try {
    const logFile = `${RESULTS_DIR}/test-runner.log`;
    appendFileSync(logFile, `${entry}\n`);
  } catch {
    // 忽略写入错误
  }
}

function section(title: string) {
  console.log(
    `\n${colors.cyan}═══════════════════════════════════════════════════════${colors.reset}`
  );
  console.log(`${colors.cyan}${title}${colors.reset}`);
  console.log(
    `${colors.cyan}═══════════════════════════════════════════════════════${colors.reset}\n`
  );
}

// ========== 步骤 1: 备份和清理 ==========
function backupPrevious() {
  section("步骤 1: 备份和清理");

  // 备份上一次测试结果
  if (existsSync(LATEST_LINK)) {
    try {
      const lastResult = readlinkSync(LATEST_LINK);
      if (existsSync(lastResult)) {
        mkdirSync(BACKUP_DIR, { recursive: true });
        const backupName = `${BACKUP_DIR}/${lastResult.split("/").pop()}`;
        cpSync(lastResult, backupName, { recursive: true });
        log("INFO", `已备份上次结果到: ${backupName}`);
      }
    } catch (e) {
      log("WARN", "备份上次结果失败", e);
    }
  }

  // 清理旧的 latest 链接
  try {
    unlinkSync(LATEST_LINK);
  } catch {
    // 忽略错误
  }

  // 创建新结果目录结构
  const dirs = ["backend", "frontend", "browser", "screenshots", "vitest", "e2e"];
  for (const dir of dirs) {
    mkdirSync(`${RESULTS_DIR}/${dir}`, { recursive: true });
  }

  log("SUCCESS", `结果目录创建: ${RESULTS_DIR}`);
}

// ========== 步骤 2: 运行单元测试 ==========
async function runUnitTests(): Promise<boolean> {
  section("步骤 2: 运行单元测试");

  const startTime = Date.now();

  return new Promise((resolve) => {
    const env = {
      ...process.env,
      TEST_RESULTS_DIR: RESULTS_DIR,
      TEST_TIMESTAMP: TEST_TIMESTAMP,
    };

    const child = spawn(
      "npx",
      [
        "vitest",
        "run",
        "--reporter=verbose",
        "--reporter=json",
        `--outputFile=${RESULTS_DIR}/vitest/report.json`,
        "test/unit",
      ],
      {
        env,
        cwd: PROJECT_ROOT,
        stdio: ["ignore", "pipe", "pipe"],
      }
    );

    let _output = "";

    child.stdout?.on("data", (data) => {
      const str = data.toString();
      _output += str;
      process.stdout.write(str);
    });

    child.stderr?.on("data", (data) => {
      const str = data.toString();
      appendFileSync(`${RESULTS_DIR}/vitest/test.log`, str);
      process.stderr.write(str);
    });

    child.on("close", async (code) => {
      const duration = Date.now() - startTime;

      // 解析结果 - 使用延迟确保文件已写入
      await new Promise((r) => setTimeout(r, 100));

      if (existsSync(`${RESULTS_DIR}/vitest/report.json`)) {
        try {
          const fs = await import("node:fs");
          const report = JSON.parse(fs.readFileSync(`${RESULTS_DIR}/vitest/report.json`, "utf-8"));
          stats.total += report.numTotalTests || 0;
          stats.passed += report.numPassedTests || 0;
          stats.failed += report.numFailedTests || 0;
          log("INFO", `单元测试统计: ${stats.passed}/${stats.total}`);
        } catch (e) {
          log("WARN", "解析测试报告失败", e);
        }
      }

      if (code === 0) {
        log("SUCCESS", `单元测试通过 (${duration}ms)`);
        resolve(true);
      } else {
        log("ERROR", `单元测试失败 (${duration}ms)`);
        resolve(false);
      }
    });
  });
}

// ========== 步骤 3: 运行集成测试 ==========
async function runIntegrationTests(): Promise<boolean> {
  section("步骤 3: 运行集成测试");

  const startTime = Date.now();

  return new Promise((resolve) => {
    const env = {
      ...process.env,
      TEST_RESULTS_DIR: RESULTS_DIR,
      TEST_TIMESTAMP: TEST_TIMESTAMP,
    };

    const child = spawn(
      "npx",
      [
        "vitest",
        "run",
        "--reporter=verbose",
        `--outputFile=${RESULTS_DIR}/vitest/integration.json`,
        "test/integration",
      ],
      {
        env,
        cwd: PROJECT_ROOT,
        stdio: ["ignore", "pipe", "pipe"],
      }
    );

    child.stdout?.on("data", (data) => {
      process.stdout.write(data);
    });

    child.stderr?.on("data", (data) => {
      appendFileSync(`${RESULTS_DIR}/vitest/integration.log`, data);
      process.stderr.write(data);
    });

    child.on("close", (code) => {
      const duration = Date.now() - startTime;

      if (code === 0) {
        log("SUCCESS", `集成测试通过 (${duration}ms)`);
        resolve(true);
      } else {
        log("WARN", `集成测试有失败 (${duration}ms)`);
        stats.skipped++;
        resolve(false);
      }
    });
  });
}

// ========== 步骤 4: 运行终端服务端测试 ==========
async function runTerminalServerTests(): Promise<boolean> {
  section("步骤 4: 运行终端服务端测试");

  const startTime = Date.now();

  return new Promise((resolve) => {
    const child = spawn("npx", ["tsx", "test/terminal-server.test.ts"], {
      env: {
        ...process.env,
        TEST_RESULTS_DIR: RESULTS_DIR,
        TEST_TIMESTAMP: TEST_TIMESTAMP,
        TEST_PORT: String(TEST_PORT),
        NODE_ENV: "test",
      },
      cwd: PROJECT_ROOT,
      stdio: ["ignore", "pipe", "pipe"],
    });

    child.stdout?.on("data", (data) => {
      process.stdout.write(data);
    });

    child.stderr?.on("data", (data) => {
      appendFileSync(`${RESULTS_DIR}/backend/test.log`, data);
      process.stderr.write(data);
    });

    child.on("close", (code) => {
      const duration = Date.now() - startTime;

      if (code === 0) {
        log("SUCCESS", `终端服务端测试通过 (${duration}ms)`);
        resolve(true);
      } else {
        log("ERROR", `终端服务端测试失败 (${duration}ms)`);
        resolve(false);
      }
    });
  });
}

// ========== 步骤 5: 运行终端客户端测试 ==========
async function runTerminalClientTests(): Promise<boolean> {
  section("步骤 5: 运行终端客户端测试");

  const startTime = Date.now();

  return new Promise((resolve) => {
    const child = spawn(
      "npx",
      [
        "playwright",
        "test",
        "test/terminal-client.test.ts",
        "--project=chromium",
        "--reporter=html,line",
        `--output=${RESULTS_DIR}/playwright`,
      ],
      {
        env: {
          ...process.env,
          TEST_RESULTS_DIR: RESULTS_DIR,
          TEST_TIMESTAMP: TEST_TIMESTAMP,
          TEST_PORT: String(TEST_PORT),
          NODE_ENV: "test",
        },
        cwd: PROJECT_ROOT,
        stdio: ["ignore", "pipe", "pipe"],
      }
    );

    child.stdout?.on("data", (data) => {
      process.stdout.write(data);
    });

    child.stderr?.on("data", (data) => {
      appendFileSync(`${RESULTS_DIR}/browser/test.log`, data);
      process.stderr.write(data);
    });

    child.on("close", (code) => {
      const duration = Date.now() - startTime;

      // 复制截图
      try {
        const { execSync } = require("node:child_process");
        execSync(
          `find ${RESULTS_DIR}/playwright -name "*.png" -exec cp {} ${RESULTS_DIR}/screenshots/ ; 2>/dev/null || true`
        );
      } catch {
        // 忽略错误
      }

      if (code === 0) {
        log("SUCCESS", `终端客户端测试通过 (${duration}ms)`);
        resolve(true);
      } else {
        log("ERROR", `终端客户端测试失败 (${duration}ms)`);
        resolve(false);
      }
    });
  });
}

// ========== 步骤 6: 生成报告 ==========
function generateSummary() {
  section("步骤 6: 生成测试报告");

  // 统计截图数量
  let screenshotCount = 0;
  try {
    const { readdirSync } = require("node:fs");
    screenshotCount = readdirSync(`${RESULTS_DIR}/screenshots`).filter((f: string) =>
      f.endsWith(".png")
    ).length;
  } catch {
    // 忽略错误
  }

  // 计算总耗时
  stats.duration = Date.now() - startTimeGlobal;

  // 生成 Markdown 报告
  const summary = `# 测试报告

**生成时间**: ${new Date().toISOString()}  
**测试类型**: ${TEST_TYPE}  
**总耗时**: ${stats.duration}ms

---

## 📊 测试摘要

| 指标 | 数值 |
|------|------|
| 总测试数 | ${stats.total} |
| ✅ 通过 | ${stats.passed} |
| ❌ 失败 | ${stats.failed} |
| ⚠️ 跳过 | ${stats.skipped} |
| 📸 截图 | ${screenshotCount} |

**总体结果**: ${stats.failed === 0 ? "✅ 全部通过" : "❌ 存在失败"}

---

## 📁 生成的文件

### 日志文件
- [后端日志](backend/server.log)
- [后端测试日志](backend/test.log)
- [前端日志](frontend/dev-server.log)
- [浏览器测试日志](browser/test.log)
- [浏览器控制台](browser/console.log)
- [测试运行日志](test-runner.log)

### 测试报告
- [Vitest报告](vitest/report.json)

### 截图
${screenshotCount > 0 ? "查看 screenshots/ 目录" : "_无截图_"}

---

## 🚀 快速查看

\`\`\`bash
# 查看完整日志
tail -f ${RESULTS_DIR}/backend/server.log

# 查看最新截图
ls -la ${RESULTS_DIR}/screenshots/

# 打开 HTML 报告
open ${RESULTS_DIR}/playwright-report/index.html
\`\`\`

---

## 📂 结果目录

\`\`\`
${RESULTS_DIR}
\`\`\`
`;

  writeFileSync(`${RESULTS_DIR}/summary.md`, summary);
  log("SUCCESS", "报告已生成", { path: `${RESULTS_DIR}/summary.md` });
}

// ========== 步骤 7: 更新 latest 链接 ==========
function updateLatestLink() {
  try {
    const { symlinkSync, unlinkSync, existsSync } = require("node:fs");

    // 删除旧的链接（如果是符号链接）
    if (existsSync(LATEST_LINK)) {
      try {
        const stats = require("node:fs").lstatSync(LATEST_LINK);
        if (stats.isSymbolicLink()) {
          unlinkSync(LATEST_LINK);
        } else {
          // 如果不是符号链接，重命名它
          const backupName = `${LATEST_LINK}.backup.${Date.now()}`;
          require("node:fs").renameSync(LATEST_LINK, backupName);
        }
      } catch (e) {
        log("WARN", "处理旧链接失败", e);
      }
    }

    // 创建新的符号链接
    symlinkSync(RESULTS_DIR, LATEST_LINK, "dir");
    log("SUCCESS", `已更新 latest 链接 -> ${RESULTS_DIR}`);
  } catch (e) {
    log("WARN", "更新 latest 链接失败", e);
  }
}

// ========== 步骤 8: 输出最终摘要 ==========
function printFinalSummary() {
  section("测试完成摘要");

  console.log(`\n📂 结果目录: ${RESULTS_DIR}`);
  console.log(`📄 查看报告: cat ${RESULTS_DIR}/summary.md`);
  console.log(`📸 查看截图: ls ${RESULTS_DIR}/screenshots/`);
  console.log("\n📊 统计:");
  console.log(`  - 总测试: ${stats.total}`);
  console.log(`  - ✅ 通过: ${stats.passed}`);
  console.log(`  - ❌ 失败: ${stats.failed}`);
  console.log(`  - ⚠️ 跳过: ${stats.skipped}`);
  console.log(`  - ⏱️ 耗时: ${stats.duration}ms`);
  console.log("");

  if (stats.failed === 0) {
    log("SUCCESS", "所有测试通过! 🎉");
    process.exit(0);
  } else {
    log("ERROR", "存在失败的测试");
    console.log("\n快速诊断:");
    console.log(`  后端日志: tail -50 ${RESULTS_DIR}/backend/test.log`);
    console.log(`  浏览器日志: tail -50 ${RESULTS_DIR}/browser/test.log`);
    process.exit(1);
  }
}

// ========== 主流程 ==========
let startTimeGlobal: number;

async function main() {
  startTimeGlobal = Date.now();

  section("🧪 Pi Gateway 统一测试运行器");
  log("INFO", `测试类型: ${TEST_TYPE}`);
  log("INFO", `时间戳: ${TEST_TIMESTAMP}`);
  log("INFO", `开发环境端口: ${TEST_CONFIG.port}`);

  // 步骤 1: 备份和清理
  backupPrevious();

  // 根据测试类型执行
  let _success = true;

  switch (TEST_TYPE) {
    case "unit":
      _success = await runUnitTests();
      break;
    case "integration":
      _success = await runIntegrationTests();
      break;
    case "terminal-server":
      _success = await runTerminalServerTests();
      break;
    case "terminal-client":
      _success = await runTerminalClientTests();
      break;
    case "terminal":
      _success = (await runTerminalServerTests()) && (await runTerminalClientTests());
      break;
    default:
      await runUnitTests();
      await runIntegrationTests();
      await runTerminalServerTests();
      await runTerminalClientTests();
      break;
  }

  // 生成报告
  generateSummary();
  updateLatestLink();

  // 输出摘要
  printFinalSummary();
}

// 显示用法
if (process.argv.includes("-h") || process.argv.includes("--help")) {
  console.log(`
Pi Gateway Unified Test Runner

Usage: npx tsx test/run-tests.ts [type]

Types:
  unit             - 运行单元测试
  integration      - 运行集成测试
  terminal-server  - 运行终端服务端测试
  terminal-client  - 运行终端客户端测试
  terminal         - 运行终端服务端+客户端测试
  all              - 运行所有测试 (默认)

Results: logs/test/<timestamp>/
Latest:  logs/test/latest/
  `);
  process.exit(0);
}

// 运行主流程
main().catch((error) => {
  log("ERROR", "测试运行器失败", error);
  process.exit(1);
});
