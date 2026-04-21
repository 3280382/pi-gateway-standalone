/**
 * LLM Log Store Tests
 * Tests for llmLogStore state management
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { TestLogger, TestReporter } from "../../../../../test/lib/test-utils";

const logger = new TestLogger("llm-log-store");
const reporter = new TestReporter("llm-log-store");

// Mock zustand persist middleware
vi.mock("zustand/middleware", () => ({
  persist: (config: any) => config,
}));

describe("LLM Log Store", () => {
  beforeEach(() => {
    logger.info("Resetting test state");
    vi.clearAllMocks();
  });

  it("initializes with default config", async () => {
    await reporter.runTest("default config initialization", async () => {
      const { useLlmLogStore } = await import("./llmLogStore");
      const state = useLlmLogStore.getState();

      expect(state.config.enabled).toBe(true);
      expect(state.config.refreshInterval).toBe(5);
      expect(state.config.truncateLength).toBe(1000);
      expect(state.logs).toEqual([]);
      expect(state.isModalOpen).toBe(false);
      logger.info("Default config verified");
    });
  });

  it("can add log entries", async () => {
    await reporter.runTest("add log entries", async () => {
      const { useLlmLogStore } = await import("./llmLogStore");
      const store = useLlmLogStore.getState();

      const entry = {
        timestamp: new Date().toISOString(),
        level: "info" as const,
        message: "Test log message",
        metadata: { key: "value" },
      };

      store.addLog(entry);
      expect(useLlmLogStore.getState().logs).toHaveLength(1);
      expect(useLlmLogStore.getState().logs[0].message).toBe("Test log message");
      logger.info("Log entry added successfully");
    });
  });

  it("can clear logs", async () => {
    await reporter.runTest("clear logs", async () => {
      const { useLlmLogStore } = await import("./llmLogStore");
      const store = useLlmLogStore.getState();

      // Clear any existing logs first
      store.clearLogs();

      store.addLog({
        timestamp: new Date().toISOString(),
        level: "info" as const,
        message: "Test message",
      });

      expect(useLlmLogStore.getState().logs).toHaveLength(1);

      store.clearLogs();
      expect(useLlmLogStore.getState().logs).toHaveLength(0);
      logger.info("Logs cleared successfully");
    });
  });

  it("can open and close modal", async () => {
    await reporter.runTest("modal open/close", async () => {
      const { useLlmLogStore } = await import("./llmLogStore");
      const store = useLlmLogStore.getState();

      expect(useLlmLogStore.getState().isModalOpen).toBe(false);

      store.openModal();
      expect(useLlmLogStore.getState().isModalOpen).toBe(true);

      store.closeModal();
      expect(useLlmLogStore.getState().isModalOpen).toBe(false);
      logger.info("Modal state handled correctly");
    });
  });

  it("can update config", async () => {
    await reporter.runTest("update config", async () => {
      const { useLlmLogStore } = await import("./llmLogStore");
      const store = useLlmLogStore.getState();

      store.setConfig({ enabled: false, refreshInterval: 10 });

      expect(useLlmLogStore.getState().config.enabled).toBe(false);
      expect(useLlmLogStore.getState().config.refreshInterval).toBe(10);
      // Other config values should remain unchanged
      expect(useLlmLogStore.getState().config.truncateLength).toBe(1000);
      logger.info("Config updated successfully");
    });
  });

  it("can set enabled state", async () => {
    await reporter.runTest("set enabled state", async () => {
      const { useLlmLogStore } = await import("./llmLogStore");
      const store = useLlmLogStore.getState();

      store.setEnabled(false);
      expect(useLlmLogStore.getState().config.enabled).toBe(false);

      store.setEnabled(true);
      expect(useLlmLogStore.getState().config.enabled).toBe(true);
      logger.info("Enabled state updated successfully");
    });
  });

  it("can set refresh interval", async () => {
    await reporter.runTest("set refresh interval", async () => {
      const { useLlmLogStore } = await import("./llmLogStore");
      const store = useLlmLogStore.getState();

      store.setRefreshInterval(15);
      expect(useLlmLogStore.getState().config.refreshInterval).toBe(15);
      logger.info("Refresh interval updated successfully");
    });
  });

  it("respects truncate length when adding logs", async () => {
    await reporter.runTest("respect truncate length", async () => {
      const { useLlmLogStore } = await import("./llmLogStore");
      const store = useLlmLogStore.getState();

      // Set a small truncate length
      store.setConfig({ truncateLength: 3 });

      // Add more logs than the truncate length
      for (let i = 0; i < 5; i++) {
        store.addLog({
          timestamp: new Date().toISOString(),
          level: "info" as const,
          message: `Message ${i}`,
        });
      }

      // Should only keep the most recent 3 (truncateLength)
      expect(useLlmLogStore.getState().logs).toHaveLength(3);
      // Most recent should be first
      expect(useLlmLogStore.getState().logs[0].message).toBe("Message 4");
      logger.info("Truncate length respected correctly");
    });
  });

  it("supports different log levels", async () => {
    await reporter.runTest("different log levels", async () => {
      const { useLlmLogStore } = await import("./llmLogStore");
      const store = useLlmLogStore.getState();

      // Clear any existing logs and reset truncate length
      store.clearLogs();
      store.setConfig({ truncateLength: 1000 });

      const levels: Array<"info" | "warn" | "error" | "debug"> = ["info", "warn", "error", "debug"];

      for (const level of levels) {
        store.addLog({
          timestamp: new Date().toISOString(),
          level,
          message: `${level} message`,
        });
      }

      expect(useLlmLogStore.getState().logs).toHaveLength(4);
      logger.info("All log levels supported");
    });
  });
});

console.log("[Test] LLM Log Store tests loaded");
