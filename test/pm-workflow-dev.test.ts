/**
 * PM Workflow E2E — Simplified: uses default session, sends prompt, monitors tool calls
 *
 * Run: npx playwright test test/pm-workflow-dev.test.ts --config=playwright.mobile.config.ts --timeout=600000
 */
import { test, expect } from "@playwright/test";
import { execSync } from "child_process";

const BASE = "http://127.0.0.1:5173";

test.describe("PM Workflow E2E", () => {
  test("PM orchestrates full dev workflow via agent_tool", async ({ page }) => {
    test.setTimeout(600000);

    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    // Clean project dir
    try {
      execSync("rm -rf /tmp/hello-demo");
    } catch {}

    // Collect tool calls from WS frames
    const toolCalls: any[] = [];
    page.on("websocket", (ws) => {
      ws.on("framereceived", (frame) => {
        try {
          const msg = JSON.parse(frame.payload as string);
          if (msg.type === "tool_execution_start" || msg.type === "tool_execution_end") {
            toolCalls.push(msg);
            if (msg.toolName === "agent_tool") {
              console.log(`[WS] ${msg.type}: agent_tool${msg.isError ? " ERROR" : ""}`);
            }
          }
        } catch {}
      });
    });

    // Load page and wait for WS
    console.log("\n=== Loading page ===");
    await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 10000 });
    await page.waitForSelector("nav", { timeout: 8000 });
    await page.waitForTimeout(5000);
    await page.screenshot({ path: "test/tmp/pm-01-loaded.png" });

    // Type workflow prompt
    console.log("\n=== Sending PM workflow prompt ===");
    const textarea = page.locator("textarea").first();
    await expect(textarea).toBeVisible({ timeout: 10000 });

    const pmPrompt =
      "Act as a Project Manager. Use agent_tool to orchestrate building a Hello World demo in /tmp/hello-demo:\n" +
      'Phase 1: create_sub_agent name=designer workingDir=/tmp/hello-demo agentId=designer-yid6 initialPrompt="Design a single-file index.html with Hello World heading, an input field, and a button that updates the heading. Write to DESIGN.md"\n' +
      'Phase 2: After Phase 1 finishes, create_sub_agent name=coder workingDir=/tmp/hello-demo agentId=coder-yin9 initialPrompt="Implement the design from DESIGN.md into index.html and README.md"\n' +
      'Phase 3: After Phase 2 finishes, create_sub_agent name=tester workingDir=/tmp/hello-demo agentId=tester-yixh initialPrompt="Test the implementation and write TEST-REPORT.md"\n' +
      'Phase 4: After Phase 3 finishes, create_sub_agent name=refactor workingDir=/tmp/hello-demo agentId=refactor-yj7g initialPrompt="Refactor the code and write REFACTOR-REPORT.md"\n' +
      "Each sub-agent will proactively report completion via send_to_parent. Wait for their reports, then summarize all results.";

    await textarea.fill(pmPrompt);
    await page.waitForTimeout(300);
    await page.screenshot({ path: "test/tmp/pm-02-prompt.png" });
    await page.locator("button[title^='Send']").click();
    console.log("[Test] Prompt sent at", new Date().toLocaleTimeString());

    // Poll for agent_tool calls
    console.log("\n=== Waiting for PM to orchestrate... ===");
    let lastAgentCount = 0;
    for (let i = 0; i < 300; i++) {
      await page.waitForTimeout(3000);
      const agentCalls = toolCalls.filter((c) => c.toolName === "agent_tool");
      if (agentCalls.length !== lastAgentCount) {
        console.log(
          `[Test] ${i * 3}s: agent_tool=${agentCalls.length}, total tools=${toolCalls.length}`
        );
        lastAgentCount = agentCalls.length;
        if (i % 10 === 0) await page.screenshot({ path: `test/tmp/pm-progress-${i}.png` });
      }
      // Stop after 4+ create_sub_agent calls and enough time for completions
      const started = agentCalls.filter((c) => c.type === "tool_execution_start").length;
      if (started >= 4 && i > 60) {
        console.log("[Test] All 4 phases triggered! Waiting for completions...");
        await page.waitForTimeout(120000);
        break;
      }
    }

    await page.screenshot({ path: "test/tmp/pm-03-final.png" });

    // ====== Verify outputs ======
    console.log("\n=== Output Verification ===");
    for (const f of [
      "DESIGN.md",
      "index.html",
      "README.md",
      "TEST-REPORT.md",
      "REFACTOR-REPORT.md",
    ]) {
      try {
        const exists = execSync(`test -f /tmp/hello-demo/${f} && echo YES || echo NO`, {
          encoding: "utf8",
        }).trim();
        console.log(`  ${f}: ${exists === "YES" ? "✅" : "❌"}`);
        if (exists === "YES") {
          const sz = execSync(`wc -c < /tmp/hello-demo/${f}`, { encoding: "utf8" }).trim();
          console.log(`    size: ${sz} bytes`);
        }
      } catch {
        console.log(`  ${f}: check failed`);
      }
    }

    const agentCalls = toolCalls.filter((c) => c.toolName === "agent_tool");
    console.log(`\n=== Report ===`);
    console.log(`agent_tool calls: ${agentCalls.length}`);
    console.log(`Total tool calls: ${toolCalls.length}`);
    console.log(`Page errors: ${errors.length}`);

    expect(
      errors.filter((e) => !e.includes("ResizeObserver") && !e.includes("Script error"))
    ).toHaveLength(0);
  });
});
