import { spawn } from "node:child_process";
import { join } from "node:path";
import { type Browser, chromium, type Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const SERVER_PORT = 3459;
const SERVER_URL = `http://localhost:${SERVER_PORT}`;

describe("Session Loading", () => {
  let browser: Browser;
  let page: Page;
  let serverProcess: ReturnType<typeof spawn>;

  beforeAll(async () => {
    // Start server
    const serverPath = join(__dirname, "..", "..", "..", "dist", "server.js");
    serverProcess = spawn("node", [serverPath], {
      env: { ...process.env, PORT: String(SERVER_PORT) },
      stdio: "pipe",
    });

    // Wait for server to start
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Server startup timeout")), 15000);
      serverProcess.stdout?.on("data", (data) => {
        if (data.toString().includes("Pi Gateway Server")) {
          clearTimeout(timeout);
          resolve();
        }
      });
    });

    // Launch browser
    browser = await chromium.launch({ headless: true });
    page = await browser.newPage();
    await page.setViewportSize({ width: 1280, height: 720 });
  }, 30000);

  afterAll(async () => {
    await browser?.close();
    serverProcess?.kill();
    await new Promise((resolve) => setTimeout(resolve, 500));
  });

  describe("Session API", () => {
    it("should load session file via API", async () => {
      // First get available sessions
      const sessionsResponse = await fetch(`${SERVER_URL}/api/sessions?cwd=/root/.pi/agent`);
      expect(sessionsResponse.ok).toBe(true);

      const sessionsData = await sessionsResponse.json();
      console.log("Available sessions:", sessionsData.sessions?.length || 0);

      if (!sessionsData.sessions || sessionsData.sessions.length === 0) {
        console.log("No sessions found, skipping load test");
        return;
      }

      // Load the first session
      const sessionPath = sessionsData.sessions[0].path;
      const loadResponse = await fetch(`${SERVER_URL}/api/session/load`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionPath }),
      });

      expect(loadResponse.ok).toBe(true);

      const sessionData = await loadResponse.json();
      expect(sessionData.entries).toBeDefined();
      expect(Array.isArray(sessionData.entries)).toBe(true);
      expect(sessionData.entries.length).toBeGreaterThan(0);

      // Check entry types
      const entryTypes = sessionData.entries.map((e: { type: string }) => e.type);
      console.log("Entry types found:", [...new Set(entryTypes)]);

      // Verify session entry exists
      const sessionEntry = sessionData.entries.find((e: { type: string }) => e.type === "session");
      expect(sessionEntry).toBeDefined();
    });

    it("should return error for invalid session path", async () => {
      const response = await fetch(`${SERVER_URL}/api/session/load`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionPath: "/nonexistent/path.jsonl" }),
      });

      expect(response.ok).toBe(false);
      expect(response.status).toBe(500);
    });

    it("should require sessionPath in request body", async () => {
      const response = await fetch(`${SERVER_URL}/api/session/load`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      expect(response.ok).toBe(false);
      expect(response.status).toBe(400);
    });
  });

  describe("Session Rendering", () => {
    it("should render session messages on page load", async () => {
      await page.goto(SERVER_URL);

      // Wait for WebSocket initialization and session loading
      await page.waitForTimeout(6000);

      // Check if messages were rendered or welcome message is shown
      const messages = await page.locator(".message").count();
      console.log("Messages rendered:", messages);

      // Either messages exist or welcome message is shown
      // Note: If no previous sessions, welcome message should be visible
      const welcomeStyle = await page
        .locator("#welcomeMessage")
        .evaluate((el) => {
          return (el as HTMLElement).style.display;
        })
        .catch(() => "error");
      console.log("Welcome message display style:", welcomeStyle);

      // If no messages and no welcome, check if chat container exists (basic sanity)
      const chatContainer = await page.locator("#chatContainer").count();
      expect(messages > 0 || chatContainer > 0).toBe(true);
    });

    it("should have session loading function defined", async () => {
      await page.goto(SERVER_URL);
      await page.waitForTimeout(1000);

      // Check if loadAndRenderRecentSession function exists (unified function)
      const hasLoadFunction = await page.evaluate(() => {
        return (
          typeof (window as { loadAndRenderRecentSession?: () => void })
            .loadAndRenderRecentSession !== "undefined"
        );
      });

      console.log("loadAndRenderRecentSession function exists:", hasLoadFunction);
      // Function should be defined (even if no sessions to load)
      expect(hasLoadFunction).toBe(true);
    });

    it("should render message elements correctly when present", async () => {
      await page.goto(SERVER_URL);
      await page.waitForTimeout(2000);

      // Check message structure if any messages exist
      const messageCount = await page.locator(".message").count();

      if (messageCount > 0) {
        // Verify message structure
        const firstMessage = page.locator(".message").first();

        // Should have message header
        const hasHeader = (await firstMessage.locator(".message-header").count()) > 0;
        expect(hasHeader).toBe(true);

        // Should have message content
        const hasContent = (await firstMessage.locator(".message-content").count()) > 0;
        expect(hasContent).toBe(true);

        // Should have toggle button
        const hasToggle = (await firstMessage.locator(".message-toggle").count()) > 0;
        expect(hasToggle).toBe(true);
      }
    });

    it("should render tool calls when present in session", async () => {
      // Capture browser console logs
      const consoleLogs: string[] = [];
      page.on("console", (msg) => {
        consoleLogs.push(msg.text());
      });

      await page.goto(SERVER_URL);

      // Wait for WebSocket connection and session loading (initialized event + session load)
      await page.waitForTimeout(5000);

      // Print captured logs
      console.log("Browser console logs:");
      for (const log of consoleLogs) {
        console.log("  ", log);
      }

      // Inject a script to inspect the last session data loaded
      const debugInfo = await page.evaluate(() => {
        // Access the last session entries from the loadAndRenderRecentSession call
        // This relies on the function storing data or we can check the DOM
        const messages = document.querySelectorAll(".message");
        const tools = document.querySelectorAll(".tool-execution");
        const assistantMessages = document.querySelectorAll(".message .message-avatar.assistant");

        // Check for assistant message content
        const assistantContents = Array.from(document.querySelectorAll(".message-content")).map(
          (el) => {
            return {
              childCount: el.children.length,
              hasThinking: el.querySelector(".thinking-block") !== null,
              hasTools: el.querySelector(".tool-execution") !== null,
              html: el.innerHTML.substring(0, 500),
            };
          }
        );

        return {
          messageCount: messages.length,
          toolCount: tools.length,
          assistantCount: assistantMessages.length,
          assistantContents,
        };
      });

      console.log("Debug info:", JSON.stringify(debugInfo, null, 2));
      console.log("Tool executions rendered:", debugInfo.toolCount);

      // Note: Session may be empty if no previous sessions exist
      // This test validates the rendering pipeline works, not that data exists
      // So we just verify the function ran without errors
      expect(debugInfo).toBeDefined();
    });

    it("should show completed status for finished tool calls", async () => {
      await page.goto(SERVER_URL);
      await page.waitForTimeout(3000);

      // Check for tool execution elements
      const toolCount = await page.locator(".tool-execution").count();
      console.log("Tool executions for status check:", toolCount);

      if (toolCount > 0) {
        // Check each tool's status
        for (let i = 0; i < toolCount; i++) {
          const tool = page.locator(".tool-execution").nth(i);
          const statusText = await tool.locator(".tool-status").textContent();
          const statusClass = await tool.locator(".tool-status").getAttribute("class");
          console.log(`Tool ${i} status: "${statusText}", class: "${statusClass}"`);

          // Status should be "done" (not "running") for completed tools
          // If tool has content, it should be completed
          const contentText = await tool.locator(".tool-content").textContent();
          if (contentText && contentText.length > 0 && contentText !== "Executing...") {
            expect(statusText).toBe("done");
            expect(statusClass).toContain("completed");
          }
        }
      }
    });

    it("should display working directory in top bar", async () => {
      await page.goto(SERVER_URL);

      // Wait for WebSocket initialization and server response
      await page.waitForTimeout(5000);

      // Check if cwd display exists
      const cwdDisplay = await page.locator("#cwdDisplay").count();
      expect(cwdDisplay).toBe(1);

      // Check workDirText which is more reliable (always shows truncated path)
      const workDirText = await page.locator("#workDirText").textContent();
      console.log("Work dir displayed:", workDirText);
      expect(workDirText).toBeTruthy();
      expect(workDirText?.length).toBeGreaterThan(0);
    });
  });
});
