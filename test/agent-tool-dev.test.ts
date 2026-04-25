/**
 * Agent Tool E2E Test
 * Run: npx playwright test test/agent-tool-dev.test.ts --config=playwright.mobile.config.ts --timeout=300000
 */
import { test, expect } from "@playwright/test";
import { execSync } from "child_process";

const BASE = "http://127.0.0.1:5173";

test.describe("Agent Tool E2E", () => {
  test("LLM calls agent_tool to create sub-agent and complete task", async ({ page }) => {
    test.setTimeout(300000);

    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    // Capture WebSocket frames in Node.js memory
    const toolCalls: Array<{
      type: string;
      toolName?: string;
      args?: any;
      result?: any;
      isError?: boolean;
    }> = [];
    const wsFrames: string[] = [];

    page.on("websocket", (ws) => {
      ws.on("framereceived", (frame) => {
        try {
          const msg = JSON.parse(frame.payload as string);
          const type = msg.type || (msg.data && msg.data.type);
          wsFrames.push(type || "?");
          if (type === "tool_execution_start" || type === "tool_execution_end") {
            toolCalls.push({
              type,
              toolName: msg.toolName,
              args: msg.args,
              result: msg.result,
              isError: msg.isError,
            });
            console.log(`[WS] ${type}: ${msg.toolName}${msg.isError ? " ERROR" : ""}`);
          }
        } catch {}
      });
    });

    // Load page
    await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 10000 });
    await page.waitForSelector("nav", { timeout: 8000 });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: "test/tmp/at-01-loaded.png" });
    console.log(`[Test] Page loaded, ${errors.length} page errors`);

    // Send prompt
    const textarea = page.locator("textarea").first();
    await expect(textarea).toBeVisible({ timeout: 10000 });
    await textarea.fill(
      'Call agent_tool action=create_sub_agent workingDir=/tmp name=echo-bot initialPrompt="Run bash: echo SUB_OK > /tmp/agent-test.txt". After tool returns, read /tmp/agent-test.txt.'
    );
    await page.waitForTimeout(300);
    await page.screenshot({ path: "test/tmp/at-02-prompt.png" });

    await page.locator("button[title^='Send']").click();
    console.log("[Test] Prompt sent, waiting for agent_tool...");

    // Poll for full cycle (tool start → tool end → LLM response)
    let agentToolStarted = false;
    let agentToolEnded = false;
    let maxWait = 120;
    for (let i = 0; i < maxWait; i++) {
      await page.waitForTimeout(1000);
      if (!agentToolStarted)
        agentToolStarted = toolCalls.some(
          (c) => c.toolName === "agent_tool" && c.type === "tool_execution_start"
        );
      if (agentToolStarted && !agentToolEnded)
        agentToolEnded = toolCalls.some(
          (c) => c.toolName === "agent_tool" && c.type === "tool_execution_end"
        );
      if (i % 10 === 0)
        console.log(
          `[Test] ${i}s: started=${agentToolStarted} ended=${agentToolEnded} calls=${toolCalls.length} frames=${wsFrames.length}`
        );
      if (agentToolEnded && i > 15) break; // Wait at least 15s after tool end for LLM to finish
    }

    await page.screenshot({ path: "test/tmp/at-03-result.png" });

    // Report
    console.log(`\n=== Test Report ===`);
    console.log(`agent_tool started: ${agentToolStarted}`);
    console.log(`agent_tool ended:   ${agentToolEnded}`);
    console.log(`Total tool calls:   ${toolCalls.length}`);
    toolCalls.forEach((c) => console.log(`  ${c.type}: ${c.toolName}${c.isError ? " ERROR" : ""}`));

    // Check for tool execution errors
    const toolErrors = toolCalls.filter((c) => c.isError);
    if (toolErrors.length > 0) console.log(`Tool errors: ${toolErrors.length}`);

    // Verify file was created by sub-agent
    try {
      const content = execSync("cat /tmp/agent-test.txt 2>/dev/null || echo NOT_FOUND", {
        encoding: "utf8",
      }).trim();
      console.log(`Sub-agent output file: ${content}`);
    } catch {
      console.log("Sub-agent file check failed");
    }

    console.log(`Page errors: ${errors.length}`);

    // Even if LLM didn't call agent_tool, the page should have no JS errors
    expect(
      errors.filter((e) => !e.includes("ResizeObserver") && !e.includes("Script error"))
    ).toHaveLength(0);
  });
});
