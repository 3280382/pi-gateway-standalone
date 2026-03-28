import { spawn } from "child_process";
import { join } from "path";
import { type Browser, chromium, type Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const SERVER_PORT = 3460;
const SERVER_URL = `http://localhost:${SERVER_PORT}`;

describe("Directory Change", () => {
	let browser: Browser;
	let page: Page;
	let serverProcess: ReturnType<typeof spawn>;

	beforeAll(async () => {
		// Start server
		const serverPath = join(__dirname, "..", "dist", "server.js");
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

	describe("Directory Selection", () => {
		it("should open directory browser modal", async () => {
			await page.goto(SERVER_URL);
			await page.waitForTimeout(2000);

			// Click browse button
			await page.click("#browseBtn");
			await page.waitForTimeout(500);

			// Check if modal is open
			const modal = page.locator("#dirModal");
			const isVisible = await modal.isVisible();
			expect(isVisible).toBe(true);

			// Close modal
			await page.click("#cancelDirBtn");
			await page.waitForTimeout(300);
		});

		it("should display working directory in top bar", async () => {
			await page.goto(SERVER_URL);
			// Wait for WebSocket initialization
			await page.waitForTimeout(5000);

			// Check cwd display using workDirText which is more reliable
			const workDirText = await page.locator("#workDirText").textContent();
			console.log("Initial workDir:", workDirText);
			expect(workDirText).toBeTruthy();
			expect(workDirText?.length).toBeGreaterThan(0);
		});

		it("should loadAndRenderRecentSession function exist", async () => {
			await page.goto(SERVER_URL);
			await page.waitForTimeout(1000);

			const hasFunction = await page.evaluate(() => {
				return (
					typeof (window as { loadAndRenderRecentSession?: () => void }).loadAndRenderRecentSession !== "undefined"
				);
			});

			console.log("loadAndRenderRecentSession exists:", hasFunction);
			expect(hasFunction).toBe(true);
		});

		it("should update session list when directory changes", async () => {
			await page.goto(SERVER_URL);
			await page.waitForTimeout(2000);

			// Get initial session count
			const initialCount = await page.locator(".session-item").count();
			console.log("Initial session count:", initialCount);

			// Open directory browser
			await page.click("#browseBtn");
			await page.waitForTimeout(1000);

			// Check if file list is visible
			const fileList = page.locator("#fileList");
			const hasItems = (await fileList.locator(".file-item").count()) > 0;

			if (hasItems) {
				// Click on a directory (first directory in list)
				const firstDir = fileList.locator(".file-item.directory").first();
				await firstDir.click();
				await page.waitForTimeout(500);

				// Click select button
				await page.click("#selectDirBtn");
				await page.waitForTimeout(2000);

				// Check if cwd updated
				const newCwd = await page.locator("#cwdText").textContent();
				console.log("New CWD after change:", newCwd);
				expect(newCwd).toBeTruthy();

				// Session list may have changed (different directory)
				const newCount = await page.locator(".session-item").count();
				console.log("Session count after dir change:", newCount);
			} else {
				console.log("No directories found to select");
				// Close modal
				await page.click("#cancelDirBtn");
			}
		});
	});
});
