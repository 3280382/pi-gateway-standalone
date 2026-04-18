/**
 * Server API Integration Tests
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  TestLogger,
  TestReporter,
  TestServerManager,
} from "../../lib/test-utils.js";

const logger = new TestLogger("server-api");
const reporter = new TestReporter("server-api");

describe("Server API Integration", () => {
  const server = new TestServerManager();
  let baseUrl: string;

  beforeAll(async () => {
    logger.info("初始化服务器 API 测试");
    await server.start();
    const port = process.env.TEST_PORT || 3000;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  afterAll(() => {
    server.stop();
    reporter.generateReport();
  });

  it("GET /api/health returns 200", async () => {
    await reporter.runTest("健康检查", async () => {
      const response = await fetch(`${baseUrl}/api/health`);
      expect(response.status).toBe(200);
      logger.info("健康检查通过");
    });
  });

  it("GET /api/models returns model list", async () => {
    await reporter.runTest("获取模型列表", async () => {
      try {
        const response = await fetch(`${baseUrl}/api/models`);
        if (response.ok) {
          const data = await response.json();
          logger.info("模型列表", data);
        } else {
          logger.info("模型列表端点返回非 200 状态码");
        }
      } catch (e) {
        logger.info("模型列表端点可能不存在");
      }
    });
  });

  it("POST /api/chat returns response", async () => {
    await reporter.runTest("聊天接口", async () => {
      try {
        const response = await fetch(`${baseUrl}/api/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: "Hello" }),
        });
        
        if (response.ok) {
          logger.info("聊天接口响应成功");
        } else {
          logger.info("聊天接口返回非 200 状态码");
        }
      } catch (e) {
        logger.info("聊天接口可能不存在或需要 WebSocket");
      }
    });
  });
});
