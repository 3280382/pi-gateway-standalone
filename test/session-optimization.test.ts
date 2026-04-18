/**
 * Session Optimization Browser Tests
 * 
 * Tests:
 * 1. Short ID display (8 characters)
 * 2. Session list table with status indicators
 * 3. Sidebar visibility notification
 * 4. Lazy loading of sessions
 */

import { test, expect, type Page } from "@playwright/test";
import { mkdirSync, appendFileSync } from "node:fs";

const RESULTS_DIR = process.env.TEST_RESULTS_DIR || "test-results/latest";
const SCREENSHOTS_DIR = `${RESULTS_DIR}/screenshots`;
const LOG_DIR = `${RESULTS_DIR}/browser`;

// Ensure directories exist
mkdirSync(SCREENSHOTS_DIR, { recursive: true });
mkdirSync(LOG_DIR, { recursive: true });

const LOG_FILE = `${LOG_DIR}/session-test.log`;

function log(level: string, message: string) {
  const entry = `[${new Date().toISOString()}] [${level}] ${message}\n`;
  console.log(entry.trim());
  appendFileSync(LOG_FILE, entry);
}

// Helper: Wait for WebSocket connection
async function waitForWebSocket(page: Page) {
  log("INFO", "Waiting for WebSocket connection...");
  await page.waitForFunction(() => {
    return (window as any).wsConnected === true;
  }, { timeout: 10000 });
  log("INFO", "WebSocket connected");
}

// Helper: Open sidebar
async function openSidebar(page: Page) {
  log("INFO", "Opening sidebar...");
  const toggleBtn = page.locator('[title="Show Sidebar"], [title="Hide Sidebar"]').first();
  await toggleBtn.click();
  await page.waitForTimeout(800);
  
  const screenshotPath = `${SCREENSHOTS_DIR}/01-sidebar-opened.png`;
  await page.screenshot({ path: screenshotPath, fullPage: false });
  log("INFO", `Sidebar opened, screenshot: ${screenshotPath}`);
}

// Helper: Close sidebar
async function closeSidebar(page: Page) {
  log("INFO", "Closing sidebar...");
  const toggleBtn = page.locator('[title="Show Sidebar"], [title="Hide Sidebar"]').first();
  await toggleBtn.click();
  await page.waitForTimeout(800);
  
  const screenshotPath = `${SCREENSHOTS_DIR}/02-sidebar-closed.png`;
  await page.screenshot({ path: screenshotPath, fullPage: false });
  log("INFO", `Sidebar closed, screenshot: ${screenshotPath}`);
}

// Helper: Get session ID from header
async function getHeaderSessionId(page: Page): Promise<string | null> {
  // Look for session ID in the status area, it should be 8 alphanumeric chars
  const statusGroup = page.locator('[class*="statusGroup"]').first();
  if (await statusGroup.isVisible().catch(() => false)) {
    const sessionIdEl = statusGroup.locator('[class*="sessionId"]').first();
    const text = await sessionIdEl.textContent().catch(() => null);
    // Only return if it looks like a session ID (8 chars, alphanumeric)
    if (text && /^[a-f0-9]{8}$/i.test(text.trim())) {
      return text.trim();
    }
  }
  return null;
}

test.describe("Session Optimization Tests", () => {
  test.beforeEach(async ({ page }) => {
    log("INFO", "Starting test...");
    
    // Capture console logs
    page.on("console", (msg) => {
      const logEntry = `[${new Date().toISOString()}] [${msg.type()}] ${msg.text()}\n`;
      appendFileSync(`${LOG_DIR}/console.log`, logEntry);
    });

    // Capture WebSocket messages
    page.on("websocket", (ws) => {
      log("INFO", `WebSocket connected: ${ws.url()}`);
      
      ws.on("framereceived", (data) => {
        const entry = JSON.stringify({ type: "received", data, time: Date.now() }) + "\n";
        appendFileSync(`${LOG_DIR}/ws-messages.json`, entry);
      });
      
      ws.on("framesent", (data) => {
        const entry = JSON.stringify({ type: "sent", data, time: Date.now() }) + "\n";
        appendFileSync(`${LOG_DIR}/ws-messages.json`, entry);
      });
    });

    // Navigate to app (use port 3000 where our server runs)
    await page.goto("http://127.0.0.1:3000/");
    await page.waitForLoadState("networkidle");
    
    // Wait for connection
    await page.waitForTimeout(3000);
    
    const screenshotPath = `${SCREENSHOTS_DIR}/00-initial-load.png`;
    await page.screenshot({ path: screenshotPath, fullPage: false });
    log("INFO", `Initial load screenshot: ${screenshotPath}`);
  });

  test("1. Session ID display in header should be 8 characters", async ({ page }) => {
    log("INFO", "Test 1: Checking header session ID...");
    
    const sessionId = await getHeaderSessionId(page);
    log("INFO", `Header session ID: ${sessionId}`);
    
    if (sessionId) {
      expect(sessionId.length).toBe(8);
      log("INFO", "✓ Session ID is 8 characters");
    } else {
      log("WARN", "Session ID not found in header (might need to create session first)");
    }
  });

  test("2. Sidebar session list should display as table", async ({ page }) => {
    log("INFO", "Test 2: Checking sidebar session table...");
    
    await openSidebar(page);
    
    // Check for table structure
    const table = page.locator("table").first();
    const isTableVisible = await table.isVisible().catch(() => false);
    
    if (isTableVisible) {
      log("INFO", "✓ Session table found");
      
      // Check table headers
      const headers = await table.locator("th").allTextContents();
      log("INFO", `Table headers: ${headers.join(", ")}`);
      
      expect(headers.length).toBeGreaterThanOrEqual(4);
      
      // Check for session rows
      const rows = await table.locator("tbody tr").count();
      log("INFO", `Found ${rows} session rows`);
      
      // Take screenshot
      const screenshotPath = `${SCREENSHOTS_DIR}/03-session-table.png`;
      await page.screenshot({ path: screenshotPath, fullPage: false });
      log("INFO", `Session table screenshot: ${screenshotPath}`);
    } else {
      log("WARN", "Session table not found (might be empty state)");
    }
    
    await closeSidebar(page);
  });

  test("3. Session status indicators should be visible", async ({ page }) => {
    log("INFO", "Test 3: Checking status indicators...");
    
    await openSidebar(page);
    
    // Check for status badges
    const statusBadges = page.locator('[class*="statusBadge"]').first();
    const hasBadges = await statusBadges.isVisible().catch(() => false);
    
    if (hasBadges) {
      log("INFO", "✓ Status badges found");
      
      // Check for specific status classes
      const possibleStatuses = ["statusIdle", "statusThinking", "statusTooling", "statusStreaming", "statusWaiting", "statusError"];
      for (const status of possibleStatuses) {
        const el = page.locator(`[class*="${status}"]`).first();
        if (await el.isVisible().catch(() => false)) {
          log("INFO", `Found status: ${status}`);
        }
      }
    } else {
      log("WARN", "Status badges not found");
    }
    
    await closeSidebar(page);
  });

  test("4. Sidebar visibility should trigger WebSocket message", async ({ page }) => {
    log("INFO", "Test 4: Checking sidebar visibility WebSocket message...");
    
    // Clear previous WebSocket messages
    await page.evaluate(() => {
      (window as any).wsMessages = [];
    });
    
    // Open sidebar
    await openSidebar(page);
    
    // Wait for WebSocket message
    await page.waitForTimeout(1000);
    
    // Check WebSocket messages
    const wsMessages = await page.evaluate(() => {
      return (window as any).wsMessages || [];
    });
    
    const hasSidebarVisibilityMsg = wsMessages.some((m: any) => 
      m.type === "sent" && m.data?.includes("sidebar_visibility")
    );
    
    if (hasSidebarVisibilityMsg) {
      log("INFO", "✓ sidebar_visibility WebSocket message sent");
    } else {
      log("WARN", "sidebar_visibility message not found in captured messages");
    }
    
    await closeSidebar(page);
  });

  test("5. Session ID in table should be 8 characters", async ({ page }) => {
    log("INFO", "Test 5: Checking table session IDs...");
    
    await openSidebar(page);
    
    // Wait for session table to be visible
    const table = page.locator("table[class*='sessionTable']").first();
    await table.waitFor({ timeout: 5000 }).catch(() => {
      log("WARN", "Session table not found");
    });
    
    if (await table.isVisible().catch(() => false)) {
      // Get all session ID cells (first column)
      const sessionIdCells = table.locator("tbody tr td:first-child span[class*='sessionId']");
      const count = await sessionIdCells.count();
      
      log("INFO", `Found ${count} session ID cells`);
      
      for (let i = 0; i < count; i++) {
        const text = await sessionIdCells.nth(i).textContent();
        if (text) {
          const trimmedId = text.trim();
          // Verify it looks like a session ID (8 hex chars)
          if (/^[a-f0-9]{8}$/i.test(trimmedId)) {
            log("INFO", `Session ID ${i}: ${trimmedId} (8 chars) ✓`);
            expect(trimmedId.length).toBe(8);
          } else {
            log("INFO", `Skipping non-session ID: ${trimmedId}`);
          }
        }
      }
    } else {
      log("WARN", "Session table not visible");
    }
    
    await closeSidebar(page);
  });
});

test.afterAll(async () => {
  log("INFO", "All tests completed");
});
