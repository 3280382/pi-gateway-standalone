/**
 * Orchestration feature browser test
 * Run: npx playwright test test/orchestration-dev.test.ts --config=playwright.mobile.config.ts
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

  test("footer agents button visible", async ({ page }) => {
    await page.goto("http://127.0.0.1:5173/", { waitUntil: "domcontentloaded", timeout: 10000 });
    await page.waitForSelector("nav button", { timeout: 8000 });
    await expect(page.locator("nav button", { hasText: "Agents" })).toBeVisible({ timeout: 5000 });
  });

  test("navigate to orchestration page", async ({ page }) => {
    await page.goto("http://127.0.0.1:5173/", { waitUntil: "domcontentloaded", timeout: 10000 });
    await page.waitForSelector("nav button", { timeout: 8000 });
    await page.locator("nav button", { hasText: "Agents" }).click();
    await page.waitForTimeout(1500);

    // Bottom toolbar should be present
    await expect(page.locator("[class*=bottomMenu]")).toBeVisible({ timeout: 8000 });
    await page.screenshot({ path: "test/tmp/orch-agents-view.png" });
  });

  test("view switcher shows all options", async ({ page }) => {
    await page.goto("http://127.0.0.1:5173/", { waitUntil: "domcontentloaded", timeout: 10000 });
    await page.waitForSelector("nav button", { timeout: 8000 });
    await page.locator("nav button", { hasText: "Agents" }).click();
    await page.waitForTimeout(1500);

    // Open view switcher - target the button in the orchestration bottom menu
    const bottomMenu = page.locator("[class*=bottomMenu]");
    await bottomMenu.locator("[class*=viewBtn]").click();
    await page.waitForTimeout(500);

    await expect(page.locator("[class*=viewPopup] button", { hasText: "Prompts" })).toBeVisible({
      timeout: 3000,
    });
    await expect(page.locator("[class*=viewPopup] button", { hasText: "Skills" })).toBeVisible();
    await expect(page.locator("[class*=viewPopup] button", { hasText: "Workflows" })).toBeVisible();
    await expect(page.locator("[class*=viewPopup] button", { hasText: "Models" })).toBeVisible();

    await page.screenshot({ path: "test/tmp/orch-view-menu.png" });
  });

  test("switch to prompts view", async ({ page }) => {
    await page.goto("http://127.0.0.1:5173/", { waitUntil: "domcontentloaded", timeout: 10000 });
    await page.waitForSelector("nav button", { timeout: 8000 });
    await page.locator("nav button", { hasText: "Agents" }).click();
    await page.waitForTimeout(1500);

    // Switch to prompts via bottom menu
    const bottomMenu = page.locator("[class*=bottomMenu]");
    await bottomMenu.locator("[class*=viewBtn]").click();
    await page.waitForTimeout(300);
    await page.locator("[class*=viewPopup] button", { hasText: "Prompts" }).click();
    await page.waitForTimeout(1000);

    await expect(bottomMenu).toBeVisible({ timeout: 5000 });
    await page.screenshot({ path: "test/tmp/orch-prompts-view.png" });
  });

  test("switch to models view", async ({ page }) => {
    await page.goto("http://127.0.0.1:5173/", { waitUntil: "domcontentloaded", timeout: 10000 });
    await page.waitForSelector("nav button", { timeout: 8000 });
    await page.locator("nav button", { hasText: "Agents" }).click();
    await page.waitForTimeout(1500);

    // Switch to models via bottom menu
    const bottomMenu = page.locator("[class*=bottomMenu]");
    await bottomMenu.locator("[class*=viewBtn]").click();
    await page.waitForTimeout(300);
    await page.locator("[class*=viewPopup] button", { hasText: "Models" }).click();
    await page.waitForTimeout(1000);

    await expect(bottomMenu).toBeVisible({ timeout: 5000 });
    await page.screenshot({ path: "test/tmp/orch-models-view.png" });
  });

  test("prompts API returns data", async ({ request }) => {
    const res = await request.get("http://127.0.0.1:3000/api/orchestration/prompts");
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.prompts.length).toBeGreaterThan(0);
  });

  test("skills API returns data", async ({ request }) => {
    const res = await request.get("http://127.0.0.1:3000/api/orchestration/skills");
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.skills.length).toBeGreaterThan(0);
  });

  test("models API returns data", async ({ request }) => {
    const res = await request.get("http://127.0.0.1:3000/api/orchestration/models");
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.models.length).toBeGreaterThan(0);
  });
});
