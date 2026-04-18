/**
 * Server Routes Tests
 * 规范：使用 test/lib/test-utils.ts 中的工具函数
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { 
  TestLogger, 
  TestReporter,
  TestServerManager,
} from "../../../test/lib/test-utils.js";

const logger = new TestLogger("routes");
const reporter = new TestReporter("routes");

// 注意：这些测试需要服务器运行
describe("Server Routes", () => {
  const server = new TestServerManager();
  let baseUrl: string;

  beforeAll(async () => {
    logger.info("初始化路由测试");
    await server.start();
    const port = process.env.TEST_PORT || 3000;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  afterAll(() => {
    server.stop();
    reporter.generateReport();
  });

  it("health endpoint returns 200", async () => {
    await reporter.runTest("健康检查端点", async () => {
      const response = await fetch(`${baseUrl}/api/health`);
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.status).toBe("ok");
      logger.info("健康检查通过", data);
    });
  });

  it("404 for unknown routes", async () => {
    await reporter.runTest("未知路由返回404", async () => {
      const response = await fetch(`${baseUrl}/api/unknown-route`);
      expect(response.status).toBe(404);
      logger.info("404 响应正确");
    });
  });

  it("CORS headers are present", async () => {
    await reporter.runTest("CORS 响应头", async () => {
      const response = await fetch(`${baseUrl}/api/health`, {
        method: "OPTIONS",
        headers: {
          Origin: "http://localhost:3000",
        },
      });
      
      expect(response.headers.get("access-control-allow-origin")).toBeTruthy();
      logger.info("CORS 响应头正确");
    });
  });
});
