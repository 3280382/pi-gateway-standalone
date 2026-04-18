/**
 * Terminal WebSocket E2E Tests
 * Production build test - single server serves both API and static files
 */

import { test, expect } from "@playwright/test";
import { spawn } from "node:child_process";
import { mkdirSync, appendFileSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";

// Test Configuration
const TEST_PORT = 3456; // Fixed port for E2E tests
const TEST_CONFIG = {
  serverPort: TEST_PORT,
  appUrl: `http://127.0.0.1:${TEST_PORT}`,
  wsUrl: `ws://127.0.0.1:${TEST_PORT}/ws/terminal`,
  logDir: "/root/pi-gateway-standalone/test-results",
  screenshotsDir: "/root/pi-gateway-standalone/test-results/screenshots",
};

// Setup directories
mkdirSync(TEST_CONFIG.logDir, { recursive: true });
mkdirSync(TEST_CONFIG.screenshotsDir, { recursive: true });

const logFile = `${TEST_CONFIG.logDir}/e2e-test.log`;

function log(level: string, message: string, data?: unknown) {
  const timestamp = new Date().toISOString();
  const entry = `[${timestamp}] [${level}] ${message}${data ? ` ${JSON.stringify(data)}` : ""}\n`;
  console.log(entry.trim());
  appendFileSync(logFile, entry);
}

// Global server process
let serverProcess: ReturnType<typeof spawn> | null = null;

// Start server before all tests
test.beforeAll(async () => {
  log("INFO", "=== E2E Tests Starting ===");
  log("INFO", "Starting production server...");

  // Ensure dist exists
  const fs = await import("node:fs");
  if (!fs.existsSync("/root/pi-gateway-standalone/dist/index.html")) {
    throw new Error("Dist folder not found. Run 'npm run build' first.");
  }

  await new Promise<void>((resolve, reject) => {
    serverProcess = spawn("npx", ["tsx", "src/server/server.ts"], {
      env: { 
        ...process.env, 
        PORT: String(TEST_PORT),
        NODE_ENV: "production"
      },
      cwd: "/root/pi-gateway-standalone",
      stdio: ["ignore", "pipe", "pipe"],
    });

    let output = "";

    serverProcess.stdout?.on("data", (data) => {
      const text = data.toString();
      output += text;
      log("DEBUG", "Server stdout", text);
      if (text.includes("Web UI:")) {
        log("INFO", "Server started successfully");
        resolve();
      }
    });

    serverProcess.stderr?.on("data", (data) => {
      log("WARN", "Server stderr", data.toString());
    });

    // Timeout
    const timeout = setTimeout(() => {
      reject(new Error("Server start timeout"));
    }, 30000);
  });

  // Extra wait for stability
  await delay(2000);
});

// Stop server after all tests
test.afterAll(() => {
  if (serverProcess) {
    log("INFO", "Stopping server...");
    serverProcess.kill("SIGTERM");
    serverProcess = null;
  }
  log("INFO", "=== E2E Tests Completed ===");
});

// Screenshot helper
async function screenshot(page: any, name: string) {
  const path = `${TEST_CONFIG.screenshotsDir}/${name}.png`;
  await page.screenshot({ path, fullPage: true });
  log("INFO", `Screenshot: ${path}`);
  return path;
}

// Test Suite
test.describe("Terminal E2E Tests", () => {
  
  test("Page loads with file browser", async ({ page }) => {
    log("INFO", "Test 1: Page loads");
    
    await page.goto(TEST_CONFIG.appUrl);
    
    // Wait for page to load
    await page.waitForLoadState("networkidle");
    await delay(1000);
    
    // Take screenshot
    await screenshot(page, "01-page-loaded");
    
    // Verify page title or content
    const title = await page.title();
    log("INFO", `Page title: ${title}`);
    
    // Check if body exists
    const body = await page.locator("body").count();
    expect(body).toBe(1);
  });

  test("Terminal button opens panel", async ({ page }) => {
    log("INFO", "Test 2: Open terminal panel");
    
    await page.goto(TEST_CONFIG.appUrl);
    await page.waitForLoadState("networkidle");
    await delay(1000);
    
    // Find terminal button by title or class
    const terminalBtn = page.locator("button[title*='Terminal' i], button[class*='terminalBtn' i]").first();
    
    // Check if button exists
    const count = await terminalBtn.count();
    log("INFO", `Terminal button found: ${count > 0}`);
    
    if (count > 0) {
      await terminalBtn.click();
      log("INFO", "Terminal button clicked");
      await delay(1000);
      
      await screenshot(page, "02-terminal-panel-opened");
      
      // Verify panel is visible (check for panel-related elements)
      const panel = page.locator("[class*='panel' i]").first();
      const isVisible = await panel.isVisible().catch(() => false);
      expect(isVisible).toBe(true);
    } else {
      await screenshot(page, "02-terminal-button-not-found");
      log("ERROR", "Terminal button not found");
      throw new Error("Terminal button not found");
    }
  });

  test("Create terminal session", async ({ page }) => {
    log("INFO", "Test 3: Create terminal session");
    
    await page.goto(TEST_CONFIG.appUrl);
    await page.waitForLoadState("networkidle");
    await delay(1000);
    
    // Open terminal panel
    const terminalBtn = page.locator("button[title*='Terminal' i], button[class*='terminalBtn' i]").first();
    if (await terminalBtn.count() > 0) {
      await terminalBtn.click();
      await delay(1000);
    }
    
    await screenshot(page, "03-terminal-panel");
    
    // Look for terminal-related elements
    const terminal = page.locator(".xterm, [class*='terminal' i], [class*='xterm' i]").first();
    const hasTerminal = await terminal.count() > 0;
    
    log("INFO", `Terminal element found: ${hasTerminal}`);
    expect(hasTerminal).toBe(true);
  });

  test("WebSocket connection established", async ({ page }) => {
    log("INFO", "Test 4: WebSocket connection");
    
    const wsMessages: string[] = [];
    
    // Listen to console for WebSocket logs
    page.on("console", (msg) => {
      const text = msg.text();
      if (text.toLowerCase().includes("websocket") || text.toLowerCase().includes("terminal")) {
        wsMessages.push(text);
        log("INFO", `Console: ${text}`);
      }
    });
    
    await page.goto(TEST_CONFIG.appUrl);
    await page.waitForLoadState("networkidle");
    
    // Open terminal
    const terminalBtn = page.locator("button[title*='Terminal' i], button[class*='terminalBtn' i]").first();
    if (await terminalBtn.count() > 0) {
      await terminalBtn.click();
    }
    
    await delay(3000);
    await screenshot(page, "04-websocket-test");
    
    log("INFO", `WebSocket-related messages: ${wsMessages.length}`);
    
    // Save captured messages
    const fs = await import("node:fs");
    fs.writeFileSync(
      `${TEST_CONFIG.logDir}/websocket-messages.json`,
      JSON.stringify(wsMessages, null, 2)
    );
  });

  test("Terminal UI elements", async ({ page }) => {
    log("INFO", "Test 5: Terminal UI elements");
    
    await page.goto(TEST_CONFIG.appUrl);
    await page.waitForLoadState("networkidle");
    await delay(1000);
    
    // Open terminal
    const terminalBtn = page.locator("button[title*='Terminal' i], button[class*='terminalBtn' i]").first();
    if (await terminalBtn.count() > 0) {
      await terminalBtn.click();
      await delay(1000);
    }
    
    await screenshot(page, "05-terminal-ui");
    
    // Check for various UI elements
    const elements = {
      tabs: await page.locator("[class*='tab' i]").count(),
      buttons: await page.locator("button").count(),
      headers: await page.locator("[class*='header' i]").count(),
    };
    
    log("INFO", "UI elements found", elements);
  });
});
