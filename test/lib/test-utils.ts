/**
 * Test Utilities - 统一测试工具库
 * 规范：所有测试必须使用该工具库以确保输出一致性
 */

import { appendFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

// ========== 配置 ==========
export const TEST_CONFIG = {
  resultsDir: process.env.TEST_RESULTS_DIR || "/root/pi-gateway-standalone/logs/test",
  timestamp: process.env.TEST_TIMESTAMP || new Date().toISOString(),
  port: process.env.TEST_PORT
    ? parseInt(process.env.TEST_PORT, 10)
    : 3200,
  logLevel: process.env.TEST_LOG_LEVEL || "info",
};

// ========== 目录初始化 ==========
export function initTestDirs() {
  const dirs = [
    `${TEST_CONFIG.resultsDir}/backend`,
    `${TEST_CONFIG.resultsDir}/frontend`,
    `${TEST_CONFIG.resultsDir}/browser`,
    `${TEST_CONFIG.resultsDir}/screenshots`,
    `${TEST_CONFIG.resultsDir}/vitest`,
  ];

  for (const dir of dirs) {
    mkdirSync(dir, { recursive: true });
  }
}

// ========== 日志工具 ==========
export class TestLogger {
  private logFile: string;
  private component: string;

  constructor(component: string, subDir: string = "logs") {
    this.component = component;
    this.logFile = `${TEST_CONFIG.resultsDir}/${subDir}/${component}.log`;

    // 确保目录存在
    mkdirSync(dirname(this.logFile), { recursive: true });

    // 初始化日志文件
    if (!existsSync(this.logFile)) {
      writeFileSync(
        this.logFile,
        `[${new Date().toISOString()}] [INIT] ${component} logger initialized\n`
      );
    }
  }

  log(level: string, message: string, data?: unknown): void {
    const timestamp = new Date().toISOString();
    const dataStr = data ? ` ${JSON.stringify(data)}` : "";
    const entry = `[${timestamp}] [${level}] [${this.component}] ${message}${dataStr}\n`;

    // 控制台输出
    if (TEST_CONFIG.logLevel === "debug" || level !== "DEBUG") {
      console.log(entry.trim());
    }

    // 文件输出
    appendFileSync(this.logFile, entry);
  }

  info(message: string, data?: unknown) {
    this.log("INFO", message, data);
  }
  debug(message: string, data?: unknown) {
    this.log("DEBUG", message, data);
  }
  warn(message: string, data?: unknown) {
    this.log("WARN", message, data);
  }
  error(message: string, data?: unknown) {
    this.log("ERROR", message, data);
  }
  success(message: string, data?: unknown) {
    this.log("SUCCESS", message, data);
  }
}

// ========== 测试结果追踪 ==========
export interface TestCaseResult {
  name: string;
  passed: boolean;
  duration: number;
  error?: string;
  category?: string;
}

export class TestReporter {
  private results: TestCaseResult[] = [];
  private logger: TestLogger;
  private startTime: number;

  constructor(testSuite: string) {
    this.logger = new TestLogger(testSuite, "vitest");
    this.startTime = Date.now();
  }

  async runTest(name: string, testFn: () => Promise<void>, category?: string): Promise<void> {
    this.logger.info(`开始测试: ${name}`);
    const startTime = Date.now();

    try {
      await testFn();
      const duration = Date.now() - startTime;
      this.results.push({ name, passed: true, duration, category });
      this.logger.success(`测试通过: ${name}`, { duration: `${duration}ms` });
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.results.push({ name, passed: false, duration, error: errorMessage, category });
      this.logger.error(`测试失败: ${name}`, { error: errorMessage, duration: `${duration}ms` });
      throw error; // 重新抛出以让测试框架处理
    }
  }

  generateReport(): void {
    const passed = this.results.filter((r) => r.passed).length;
    const failed = this.results.filter((r) => !r.passed).length;
    const totalDuration = Date.now() - this.startTime;

    const report = {
      timestamp: new Date().toISOString(),
      config: TEST_CONFIG,
      summary: {
        total: this.results.length,
        passed,
        failed,
        duration: totalDuration,
      },
      results: this.results,
    };

    const reportPath = `${TEST_CONFIG.resultsDir}/vitest/report.json`;
    writeFileSync(reportPath, JSON.stringify(report, null, 2));

    this.logger.info("测试报告已生成", { path: reportPath });
    this.logger.info(`摘要: ${passed}/${this.results.length} 通过, ${failed} 失败`, {
      duration: `${totalDuration}ms`,
    });
  }

  getResults(): TestCaseResult[] {
    return [...this.results];
  }
}

// ========== 浏览器测试工具 ==========
export class BrowserTestHelper {
  private logger: TestLogger;
  private consoleLogFile: string;
  private wsLogFile: string;

  constructor(testName: string) {
    this.logger = new TestLogger(testName, "browser");
    this.consoleLogFile = `${TEST_CONFIG.resultsDir}/browser/console.log`;
    this.wsLogFile = `${TEST_CONFIG.resultsDir}/browser/ws-messages.json`;

    // 初始化 WebSocket 日志
    if (!existsSync(this.wsLogFile)) {
      writeFileSync(this.wsLogFile, "[]\n");
    }
  }

  logConsole(level: string, message: string): void {
    const timestamp = new Date().toISOString();
    const entry = `[${timestamp}] [${level}] ${message}\n`;
    appendFileSync(this.consoleLogFile, entry);
  }

  logWebSocket(type: string, data: unknown): void {
    const entry = { type, data, time: Date.now() };
    appendFileSync(this.wsLogFile, `${JSON.stringify(entry)}\n`);
  }

  getScreenshotPath(name: string): string {
    return `${TEST_CONFIG.resultsDir}/screenshots/${name}.png`;
  }

  getLogger(): TestLogger {
    return this.logger;
  }
}

/**
 * 【三窗口原则】TestServerManager 不再启动新服务器
 * 只检查tmux中已运行的服务状态
 */
export class TestServerManager {
  private logger: TestLogger;
  private isStarted = false;
  // @ts-ignore properties used via dynamic assignment
  private port: number;
  // @ts-ignore properties used via dynamic assignment
  private serverLogFile: string;
  // @ts-ignore properties used via dynamic assignment
  private useTmux = false;

  constructor(port?: number) {
    this.logger = new TestLogger("server-manager", "backend");
    this.serverLogFile = `${TEST_CONFIG.resultsDir}/backend/server.log`;
    this.port = port || TEST_CONFIG.port;
  }

  async start(): Promise<void> {
    if (this.isStarted) return;

    // 【三窗口原则】检查tmux中的服务，不启动新服务
    this.logger.info("检查tmux中的服务...", { port: 3000 });

    const tmuxAvailable = await this.checkTmuxServices();
    if (tmuxAvailable.backend) {
      this.logger.info("✅ 使用tmux中的后端服务");
      this.isStarted = true;
      this.useTmux = true;
      return;
    }

    this.logger.error("❌ tmux中的后端服务未运行！");
    this.logger.error("请先启动tmux开发环境: bash scripts/start-tmux-dev.sh");
    throw new Error("tmux后端服务未运行");
  }

  /**
   * 【三窗口原则】检查tmux中的服务状态
   */
  private async checkTmuxServices(): Promise<{ frontend: boolean; backend: boolean }> {
    const results = { frontend: false, backend: false };

    // 检查前端 (Vite on 5173)
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2000);
      const frontendRes = await fetch("http://127.0.0.1:5173/", {
        method: "HEAD",
        signal: controller.signal,
      });
      clearTimeout(timeout);
      results.frontend = frontendRes.ok;
    } catch {
      results.frontend = false;
    }

    // 检查后端 (Node.js on 3000)
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2000);
      const backendRes = await fetch("http://127.0.0.1:3000/api/health", {
        signal: controller.signal,
      });
      clearTimeout(timeout);
      results.backend = backendRes.ok;
    } catch {
      results.backend = false;
    }

    return results;
  }

  async healthCheck(): Promise<boolean> {
    // 【三窗口原则】检查tmux中的后端服务
    try {
      const response = await fetch("http://127.0.0.1:3000/api/health");
      return response.ok;
    } catch {
      return false;
    }
  }

  async stop(): Promise<void> {
    // 【三窗口原则】不停止tmux中的服务
    this.logger.info("保持tmux服务运行（不执行停止操作）");
    this.isStarted = false;
  }
}

// ========== WebSocket 测试工具 ==========
import { WebSocket } from "ws";

export class TestWebSocketClient {
  private ws: WebSocket | null = null;
  private messages: unknown[] = [];
  private connected = false;
  private logger: TestLogger;

  constructor(_url: string) {
    this.logger = new TestLogger("ws-client", "backend");
  }

  async connect(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(url);

      const timeout = setTimeout(() => {
        reject(new Error("连接超时"));
      }, 5000);

      this.ws.on("open", () => {
        this.connected = true;
        clearTimeout(timeout);
        this.logger.info("WebSocket 已连接");
        resolve();
      });

      this.ws.on("message", (data) => {
        try {
          const message = JSON.parse(data.toString());
          this.messages.push(message);
          this.logger.debug("收到消息", message);
        } catch (_e) {
          this.logger.warn("解析消息失败", data.toString());
        }
      });

      this.ws.on("error", (err) => {
        clearTimeout(timeout);
        this.logger.error("WebSocket 错误", err.message);
        reject(err);
      });
    });
  }

  send(type: string, data?: Record<string, unknown>): void {
    if (!this.ws || !this.connected) {
      throw new Error("WebSocket 未连接");
    }
    const message = { type, ...data };
    this.logger.debug("发送消息", message);
    this.ws.send(JSON.stringify(message));
  }

  waitForMessage(
    predicate: (msg: Record<string, unknown>) => boolean,
    timeout = 5000
  ): Promise<Record<string, unknown>> {
    return new Promise((resolve, reject) => {
      // 检查已有消息
      const existing = this.messages.find((m) => predicate(m as Record<string, unknown>));
      if (existing) {
        resolve(existing as Record<string, unknown>);
        return;
      }

      const timeoutId = setTimeout(() => {
        reject(new Error("等待消息超时"));
      }, timeout);

      const checkInterval = setInterval(() => {
        const message = this.messages.find((m) => predicate(m as Record<string, unknown>));
        if (message) {
          clearTimeout(timeoutId);
          clearInterval(checkInterval);
          resolve(message as Record<string, unknown>);
        }
      }, 100);
    });
  }

  getMessages(): unknown[] {
    return [...this.messages];
  }

  clearMessages(): void {
    this.messages = [];
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.connected = false;
      this.logger.info("WebSocket 已断开");
    }
  }
}

// ========== 初始化 ==========
initTestDirs();
