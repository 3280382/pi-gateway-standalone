/**
 * Browser Load Test - 浏览器模块加载测试
 */

import { describe, expect, it } from "vitest";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, "..", "..", "..");

describe("Browser Load Test", () => {
  describe("Entry Points", () => {
    it("main.tsx should import without errors", async () => {
      const mainPath = join(projectRoot, "src/client/main.tsx");
      try {
        const mainModule = await import(mainPath);
        expect(mainModule).toBeDefined();
      } catch (error) {
        throw new Error(`Failed to import main.tsx: ${error}`);
      }
    });

    it("App.tsx should import without errors", async () => {
      const appPath = join(projectRoot, "src/client/App.tsx");
      try {
        const appModule = await import(appPath);
        expect(appModule.App).toBeDefined();
      } catch (error) {
        throw new Error(`Failed to import App.tsx: ${error}`);
      }
    });
  });
});
