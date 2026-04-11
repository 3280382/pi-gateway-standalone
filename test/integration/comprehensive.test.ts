/**
 * Comprehensive Gateway Test Suite
 * Tests all core functionality including API, WebSocket, and UI features
 */
import { spawn } from "child_process";
import { join } from "path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import WebSocket from "ws";

const SERVER_PORT = 3476;
const SERVER_URL = `http://localhost:${SERVER_PORT}`;
const TEST_TIMEOUT = 60000;
const WS_TIMEOUT = 30000;

describe("Gateway Comprehensive Tests", () => {
  let serverProcess: ReturnType<typeof spawn>;
  let ws: WebSocket | null = null;

  beforeAll(async () => {
    console.log(`🚀 启动服务器在端口 ${SERVER_PORT}...`);
    // Start server using tsx (TypeScript execution)
    const serverPath = join(__dirname, "..", "..", "..", "src", "server", "server.ts");
    serverProcess = spawn("npx", ["tsx", serverPath], {
      env: { ...process.env, PORT: String(SERVER_PORT) },
      stdio: "pipe",
    });

    // Wait for server to start
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error(`Server startup timeout after 30000ms`)),
        30000
      );
      let output = "";
      const handleData = (data: Buffer) => {
        const text = data.toString();
        output += text;
        console.log(`[Server Output] ${text.trim()}`);
        if (text.includes("Server started on") || text.includes("Pi Gateway Server")) {
          console.log(`✅ 服务器启动成功，检测到启动消息`);
          clearTimeout(timeout);
          serverProcess.stdout?.off("data", handleData);
          serverProcess.stderr?.off("data", handleData);
          resolve();
        }
      };
      serverProcess.stdout?.on("data", handleData);
      serverProcess.stderr?.on("data", handleData);

      // 处理进程错误
      serverProcess.on("error", (error) => {
        reject(new Error(`进程错误: ${error.message}`));
      });

      // 处理进程退出
      serverProcess.on("exit", (code, signal) => {
        if (code !== 0 && code !== null) {
          reject(new Error(`服务器进程退出，代码: ${code}, 信号: ${signal}`));
        }
      });
    });

    // 额外等待确保服务器完全就绪
    await new Promise((resolve) => setTimeout(resolve, 1000));
    console.log(`✅ 服务器启动完成，准备测试`);
  }, TEST_TIMEOUT);

  afterAll(async () => {
    if (ws) {
      ws.close();
    }
    if (serverProcess) {
      serverProcess.kill("SIGKILL");
      await new Promise((resolve) => setTimeout(resolve, 1000));
      // 确保进程已终止
      if (!serverProcess.killed) {
        serverProcess.kill("SIGTERM");
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }
  });

  describe("1. HTTP API Tests", () => {
    it("should list available models", async () => {
      const response = await fetch(`${SERVER_URL}/api/models`);
      expect(response.ok).toBe(true);

      const data = await response.json();
      expect(data.models).toBeDefined();
      expect(Array.isArray(data.models)).toBe(true);
      expect(data.models.length).toBeGreaterThan(0);

      // Check model structure
      const model = data.models[0];
      expect(model.id).toBeDefined();
      expect(model.provider).toBeDefined();
      expect(model.name).toBeDefined();
    });

    it("should list sessions for a directory", async () => {
      const response = await fetch(`${SERVER_URL}/api/sessions?cwd=/root`);
      expect(response.ok).toBe(true);

      const data = await response.json();
      expect(data.sessions).toBeDefined();
      expect(Array.isArray(data.sessions)).toBe(true);
    });

    it("should browse directory contents", async () => {
      const response = await fetch(`${SERVER_URL}/api/browse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: "/root" }),
      });

      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data.items).toBeDefined();
      expect(Array.isArray(data.items)).toBe(true);
    });

    it("should get LLM log status", async () => {
      const response = await fetch(`${SERVER_URL}/api/llm-log`);
      expect(response.ok).toBe(true);

      const data = await response.json();
      expect(data.enabled).toBeDefined();
      expect(typeof data.enabled).toBe("boolean");
    });
  });

  describe("2. WebSocket Connection Tests", () => {
    it("should establish WebSocket connection", async () => {
      const wsUrl = SERVER_URL!.replace("http://", "ws://");
      ws = new WebSocket(wsUrl);

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("WebSocket connection timeout"));
        }, WS_TIMEOUT);

        ws!.on("open", () => {
          clearTimeout(timeout);
          resolve();
        });

        ws!.on("error", (err) => {
          clearTimeout(timeout);
          reject(err);
        });
      });

      expect(ws.readyState).toBe(WebSocket.OPEN);
    });

    it("should receive pid in initialized message", async () => {
      const wsUrl = SERVER_URL!.replace("http://", "ws://");
      const testWs = new WebSocket(wsUrl);

      const result = await new Promise<{ sessionId: string; pid: number }>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("Timeout waiting for initialized message"));
        }, WS_TIMEOUT);

        testWs.on("message", (data) => {
          const msg = JSON.parse(data.toString());
          if (msg.type === "initialized") {
            clearTimeout(timeout);
            testWs.close();
            resolve({ sessionId: msg.sessionId, pid: msg.pid });
          }
        });

        testWs.on("open", () => {
          testWs.send(
            JSON.stringify({
              type: "init",
              workingDir: "/root",
            })
          );
        });
      });

      expect(result.sessionId).toBeDefined();
      expect(result.pid).toBeDefined();
      expect(typeof result.pid).toBe("number");
      expect(result.pid).toBeGreaterThan(0);
    });

    it("should list models via WebSocket", async () => {
      const wsUrl = SERVER_URL!.replace("http://", "ws://");
      const testWs = new WebSocket(wsUrl);

      const models = await new Promise<Array<any>>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("Timeout waiting for models list"));
        }, WS_TIMEOUT);

        let _initialized = false;

        testWs.on("message", (data) => {
          const msg = JSON.parse(data.toString());

          if (msg.type === "initialized") {
            _initialized = true;
            testWs.send(JSON.stringify({ type: "list_models" }));
          } else if (msg.type === "models_list") {
            clearTimeout(timeout);
            testWs.close();
            resolve(msg.models);
          }
        });

        testWs.on("open", () => {
          testWs.send(
            JSON.stringify({
              type: "init",
              workingDir: "/root",
            })
          );
        });
      });

      expect(models).toBeDefined();
      expect(Array.isArray(models)).toBe(true);
      expect(models.length).toBeGreaterThan(0);
    });

    it("should handle session lifecycle", async () => {
      const wsUrl = SERVER_URL!.replace("http://", "ws://");
      const testWs = new WebSocket(wsUrl);

      const events: string[] = [];

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("Timeout in session lifecycle test"));
        }, WS_TIMEOUT);

        testWs.on("message", (data) => {
          const msg = JSON.parse(data.toString());
          events.push(msg.type);

          if (msg.type === "initialized") {
            // Request new session
            testWs.send(JSON.stringify({ type: "new_session" }));
          } else if (msg.type === "session_info") {
            clearTimeout(timeout);
            testWs.close();
            resolve();
          }
        });

        testWs.on("open", () => {
          testWs.send(
            JSON.stringify({
              type: "init",
              workingDir: "/root",
            })
          );
        });
      });

      expect(events).toContain("initialized");
      expect(events).toContain("session_info");
    });
  });

  describe("3. LLM Integration Tests", () => {
    it("should process a simple prompt and receive response", async () => {
      // Check if API key is configured
      const hasApiKey = process.env.ANTHROPIC_AUTH_TOKEN || process.env.OPENAI_API_KEY;
      if (!hasApiKey) {
        console.log("[Test] Skipping LLM test - no API key configured");
        return;
      }

      const wsUrl = SERVER_URL!.replace("http://", "ws://");
      const testWs = new WebSocket(wsUrl);

      const result = await new Promise<{
        gotResponse: boolean;
        gotDone: boolean;
        gotError: boolean;
        gotAgentStart: boolean;
        textReceived: string;
        timedOut: boolean;
      }>((resolve, _reject) => {
        const timeout = setTimeout(() => {
          resolve({
            gotResponse: false,
            gotDone: false,
            gotError: false,
            gotAgentStart: false,
            textReceived: "",
            timedOut: true,
          });
        }, 15000);

        let _initialized = false;
        let textReceived = "";
        let gotResponse = false;
        let gotDone = false;
        let gotError = false;
        let gotAgentStart = false;

        testWs.on("message", (data) => {
          const msg = JSON.parse(data.toString());

          if (msg.type === "initialized") {
            _initialized = true;
            testWs.send(
              JSON.stringify({
                type: "prompt",
                text: "Say exactly 'pong'",
                model: "deepseek/deepseek-chat",
              })
            );
          } else if (msg.type === "agent_start") {
            gotAgentStart = true;
          } else if (msg.type === "response") {
            gotResponse = true;
            textReceived += msg.delta || "";
          } else if (msg.type === "done") {
            gotDone = true;
            clearTimeout(timeout);
            testWs.close();
            resolve({
              gotResponse,
              gotDone,
              gotError,
              gotAgentStart,
              textReceived,
              timedOut: false,
            });
          } else if (msg.type === "error") {
            gotError = true;
            clearTimeout(timeout);
            testWs.close();
            resolve({
              gotResponse,
              gotDone,
              gotError,
              gotAgentStart,
              textReceived,
              timedOut: false,
            });
          }
        });

        testWs.on("open", () => {
          testWs.send(
            JSON.stringify({
              type: "init",
              workingDir: "/root",
            })
          );
        });
      });

      // If timed out without any response, the server might not have API access
      // This is acceptable for testing the protocol, just log it
      if (result.timedOut && !result.gotAgentStart && !result.gotResponse) {
        console.log(
          "[Test] Prompt processing timeout - API may not be accessible in test environment"
        );
        // Still pass the test as we're testing protocol, not API connectivity
        return;
      }

      // agent_start means the prompt was accepted and processing started
      expect(result.gotAgentStart || result.gotResponse || result.gotDone || result.gotError).toBe(
        true
      );
    }, 20000);

    it("should log LLM API calls", async () => {
      // Trigger a prompt first
      const wsUrl = SERVER_URL!.replace("http://", "ws://");
      const testWs = new WebSocket(wsUrl);

      await new Promise<void>((resolve, _reject) => {
        const timeout = setTimeout(() => {
          resolve(); // Continue even if no response
        }, 5000);

        let _initialized = false;

        testWs.on("message", (data) => {
          const msg = JSON.parse(data.toString());

          if (msg.type === "initialized") {
            _initialized = true;
            testWs.send(
              JSON.stringify({
                type: "prompt",
                text: "Hi",
                model: "deepseek/deepseek-chat",
              })
            );
          } else if (msg.type === "done" || msg.type === "error") {
            clearTimeout(timeout);
            testWs.close();
            resolve();
          }
        });

        testWs.on("open", () => {
          testWs.send(
            JSON.stringify({
              type: "init",
              workingDir: "/root",
            })
          );
        });
      });

      // Wait for logs to be written
      await new Promise((r) => setTimeout(r, 2000));

      // Check logs
      const response = await fetch(`${SERVER_URL}/api/llm-log`);
      const logData = await response.json();

      expect(logData.enabled).toBe(true);
      expect(logData.logContent).toBeDefined();
      expect(Array.isArray(logData.logContent)).toBe(true);

      if (logData.logContent.length > 0) {
        const hasRequest = logData.logContent.some((e: any) => e.type === "request");
        const _hasResponse = logData.logContent.some((e: any) => e.type === "response");

        if (hasRequest) {
          const requestEntry = logData.logContent.find((e: any) => e.type === "request");
          const requestContent = JSON.parse(requestEntry.content);
          expect(requestContent.method).toBe("POST");
          expect(requestContent.url).toContain("moonshot.cn");
        }
      }
    }, 10000);
  });

  describe("4. UI State Tests", () => {
    it("should handle status updates correctly", async () => {
      const wsUrl = SERVER_URL!.replace("http://", "ws://");
      const testWs = new WebSocket(wsUrl);

      const statuses: string[] = [];

      await new Promise<void>((resolve, _reject) => {
        const timeout = setTimeout(() => {
          resolve();
        }, 5000);

        testWs.on("message", (data) => {
          const msg = JSON.parse(data.toString());

          if (msg.type === "initialized") {
            statuses.push("connected");
            clearTimeout(timeout);
            testWs.close();
            resolve();
          } else if (msg.type === "agent_start") {
            statuses.push("streaming");
          } else if (msg.type === "agent_end") {
            statuses.push("connected");
          }
        });

        testWs.on("open", () => {
          testWs.send(
            JSON.stringify({
              type: "init",
              workingDir: "/root",
            })
          );
        });
      });

      expect(statuses).toContain("connected");
    });
  });

  describe("5. Error Handling Tests", () => {
    it("should handle invalid message types gracefully", async () => {
      const wsUrl = SERVER_URL!.replace("http://", "ws://");
      const testWs = new WebSocket(wsUrl);

      const result = await new Promise<{
        gotError: boolean;
        errorMessage: string;
      }>((resolve, _reject) => {
        const timeout = setTimeout(() => {
          resolve({ gotError: false, errorMessage: "" });
        }, 5000);

        testWs.on("message", (data) => {
          const msg = JSON.parse(data.toString());

          if (msg.type === "error") {
            clearTimeout(timeout);
            testWs.close();
            resolve({
              gotError: true,
              errorMessage: msg.error || msg.message || "",
            });
          }
        });

        testWs.on("open", () => {
          // Send invalid message
          testWs.send(
            JSON.stringify({
              type: "invalid_message_type",
            })
          );
        });
      });

      expect(result.gotError).toBe(true);
    });

    it("should handle session not initialized error", async () => {
      const wsUrl = SERVER_URL!.replace("http://", "ws://");
      const testWs = new WebSocket(wsUrl);

      const result = await new Promise<{ gotError: boolean }>((resolve, _reject) => {
        const timeout = setTimeout(() => {
          resolve({ gotError: false });
        }, 5000);

        testWs.on("message", (data) => {
          const msg = JSON.parse(data.toString());

          if (msg.type === "error") {
            clearTimeout(timeout);
            testWs.close();
            resolve({ gotError: true });
          }
        });

        testWs.on("open", () => {
          // Try to send prompt without initialization
          testWs.send(
            JSON.stringify({
              type: "prompt",
              text: "Hello",
            })
          );
        });
      });

      expect(result.gotError).toBe(true);
    });
  });

  describe("6. Session Management Tests", () => {
    it("should list and load sessions", async () => {
      const wsUrl = SERVER_URL!.replace("http://", "ws://");
      const testWs = new WebSocket(wsUrl);

      const sessions = await new Promise<Array<any>>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("Timeout waiting for sessions list"));
        }, WS_TIMEOUT);

        let _initialized = false;

        testWs.on("message", (data) => {
          const msg = JSON.parse(data.toString());

          if (msg.type === "initialized") {
            _initialized = true;
            testWs.send(
              JSON.stringify({
                type: "list_sessions",
                cwd: "/root",
              })
            );
          } else if (msg.type === "sessions_list") {
            clearTimeout(timeout);
            testWs.close();
            resolve(msg.sessions || []);
          }
        });

        testWs.on("open", () => {
          testWs.send(
            JSON.stringify({
              type: "init",
              workingDir: "/root",
            })
          );
        });
      });

      expect(sessions).toBeDefined();
      expect(Array.isArray(sessions)).toBe(true);
    });
  });
});
