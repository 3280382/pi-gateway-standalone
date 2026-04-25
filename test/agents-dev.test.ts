/**
 * Agents (Orchestration) Feature browser test
 * Run: npx playwright test test/agents-dev.test.ts --config=playwright.mobile.config.ts
 */
import { test, expect } from "@playwright/test";

test.describe("Orchestration Feature", () => {
  test("page loads without errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));
    await page.goto("http://127.0.0.1:5173/", { waitUntil: "domcontentloaded", timeout: 10000 });
    await page.waitForSelector("nav", { timeout: 8000 });
    const realErrors = errors.filter(
      (e) => !e.includes("ResizeObserver") && !e.includes("Script error")
    );
    expect(realErrors).toHaveLength(0);
  });

  test("navigate to orchestration page via footer", async ({ page }) => {
    await page.goto("http://127.0.0.1:5173/", { waitUntil: "domcontentloaded", timeout: 10000 });
    await page.waitForSelector("nav", { timeout: 8000 });
    await page.locator("nav button", { hasText: "Agents" }).click();
    await page.waitForTimeout(1500);
    // Bottom toolbar should be visible
    await expect(page.locator("[class*=bottomMenu]")).toBeVisible({ timeout: 8000 });
  });

  test("agents API returns data", async ({ request }) => {
    const res = await request.get("http://127.0.0.1:3000/api/agents");
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("agents");
    expect(body.agents.length).toBeGreaterThan(0);
  });

  test("default agents exist with templates", async ({ request }) => {
    const res = await request.get("http://127.0.0.1:3000/api/agents");
    const agents = (await res.json()).agents;
    const names = ["Project Manager", "Designer", "Coder", "Tester", "Refactor"];
    for (const name of names) {
      const agent = agents.find((a: any) => a.name === name);
      expect(agent).toBeTruthy();
      expect(agent.systemPromptUseDefault).toBe(false);
      expect(agent.systemPromptTemplate).toBeTruthy();
    }
  });
});
