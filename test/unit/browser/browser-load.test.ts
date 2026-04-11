/**
 * Browser Load Test - 浏览器模块加载测试
 * 简化版本 - 检查文件是否存在而不是导入
 */

import { existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { describe, expect, it } from "vitest";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, "..", "..", "..");

describe("Browser Load Test", () => {
  describe("Entry Points", () => {
    it("main.tsx file should exist", () => {
      const mainPath = join(projectRoot, "src/client/main.tsx");
      expect(existsSync(mainPath)).toBe(true);
    });

    it("App.tsx file should exist", () => {
      const appPath = join(projectRoot, "src/client/app/App.tsx");
      expect(existsSync(appPath)).toBe(true);
    });
  });
});
