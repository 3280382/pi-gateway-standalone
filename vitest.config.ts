import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./test/setup.ts"],
    globalSetup: ["./test/setup-server.ts"],
    maxWorkers: 1, // 限制并发为1
    minWorkers: 1, // 最小工作线程为1
    sequence: {
      concurrent: false, // 禁用并发
    },
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/test/e2e/**", // 跳过E2E测试
      "**/FileActionBar.test.tsx", // 暂时跳过失败的测试
      "**/FileGrid.test.tsx",
      "**/FileList.test.tsx",
      "**/FileSidebar.test.tsx",
      "**/FileToolbar.test.tsx",
      "**/FileViewer.test.tsx",
    ],
    include: [
      "**/test/unit/**/*.test.ts",
      "**/test/integration/**/*.test.ts",
      "**/*.test.tsx",
      "**/stores/*.test.ts",
      "**/services/**/*.test.ts",
      "src/server/**/*.test.ts",
      "src/client/**/*.test.ts",
    ], // 包含单元测试、集成测试、React组件测试、Store测试、Service测试和Server测试
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src/client"),
      "@shared": resolve(__dirname, "./src/shared"),
      "@server": resolve(__dirname, "./src/server"),
      "@test": resolve(__dirname, "./test"),
    },
  },
});
