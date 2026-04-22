import { beforeEach, describe, expect, it, vi } from "vitest";

describe("LlmLogManager", () => {
  let manager: any;
  let appendFileSpy: ReturnType<typeof vi.fn>;
  let readFileSpy: ReturnType<typeof vi.fn>;
  let existsSyncSpy: ReturnType<typeof vi.fn>;
  let mkdirSyncSpy: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.resetModules();
    appendFileSpy = vi.fn().mockResolvedValue(undefined);
    readFileSpy = vi.fn().mockResolvedValue("");
    existsSyncSpy = vi.fn().mockReturnValue(true);
    mkdirSyncSpy = vi.fn();

    vi.doMock("node:fs", () => ({
      existsSync: existsSyncSpy,
      mkdirSync: mkdirSyncSpy,
    }));

    vi.doMock("node:fs/promises", () => ({
      appendFile: appendFileSpy,
      readFile: readFileSpy,
    }));

    const { LlmLogManager } = await import("./log-manager");
    manager = new LlmLogManager({ enabled: true, maxBufferSize: 3, flushInterval: 5000 });
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    if (manager) {
      manager.dispose();
    }
    vi.clearAllMocks();
  });

  describe("constructor", () => {
    it("creates manager with defaults", async () => {
      vi.resetModules();
      vi.doMock("node:fs", () => ({ existsSync: vi.fn(), mkdirSync: vi.fn() }));
      vi.doMock("node:fs/promises", () => ({ appendFile: vi.fn(), readFile: vi.fn() }));
      const { LlmLogManager } = await import("./log-manager");
      const m = new LlmLogManager();
      expect(m.isEnabled()).toBe(true);
      m.dispose();
    });

    it("creates disabled manager", async () => {
      vi.resetModules();
      vi.doMock("node:fs", () => ({ existsSync: vi.fn(), mkdirSync: vi.fn() }));
      vi.doMock("node:fs/promises", () => ({ appendFile: vi.fn(), readFile: vi.fn() }));
      const { LlmLogManager } = await import("./log-manager");
      const m = new LlmLogManager({ enabled: false });
      expect(m.isEnabled()).toBe(false);
      m.dispose();
    });
  });

  describe("setLogFile", () => {
    it("sets log file path from session file", () => {
      manager.setLogFile("/path/to/session.jsonl", "session-123");
      expect(manager.getLogFilePath()).toBe("/path/to/session.log");
      expect(manager.getCurrentSessionId()).toBe("session-123");
    });

    it("handles undefined session file", () => {
      manager.setLogFile(undefined, "session-123");
      expect(manager.getLogFilePath()).toBeNull();
    });
  });

  describe("log", () => {
    it("adds entry to buffer when enabled", () => {
      manager.setLogFile("/path/session.jsonl", "s1");
      manager.log({ type: "request", data: { model: "gpt-4" } });
      expect(manager.getBufferSize()).toBe(1);
    });

    it("skips logging when disabled", () => {
      manager.setEnabled(false);
      manager.log({ type: "request", data: {} });
      expect(manager.getBufferSize()).toBe(0);
    });

    it("auto-flushes when buffer reaches max size", async () => {
      manager.setLogFile("/path/session.jsonl", "s1");

      manager.log({ type: "request", data: {} });
      manager.log({ type: "response", data: {} });
      expect(manager.getBufferSize()).toBe(2);

      manager.log({ type: "request", data: {} });
      await vi.advanceTimersByTimeAsync(0);
      expect(manager.getBufferSize()).toBe(0);
      expect(appendFileSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe("flush", () => {
    it("does nothing when buffer is empty", async () => {
      await manager.flush();
      expect(appendFileSpy).not.toHaveBeenCalled();
    });

    it("does nothing when log file path is not set", async () => {
      manager.log({ type: "request", data: {} });
      await manager.flush();
      expect(appendFileSpy).not.toHaveBeenCalled();
    });

    it("writes buffer to file", async () => {
      manager.setLogFile("/path/session.jsonl", "s1");
      manager.log({ type: "request", data: { model: "gpt-4" } });

      await manager.flush();
      expect(appendFileSpy).toHaveBeenCalledTimes(1);
      expect(appendFileSpy).toHaveBeenCalledWith(
        "/path/session.log",
        expect.stringContaining("request"),
        "utf-8"
      );
      expect(manager.getBufferSize()).toBe(0);
    });

    it("creates directory if it does not exist", async () => {
      existsSyncSpy.mockReturnValue(false);
      manager.setLogFile("/new/dir/session.jsonl", "s1");
      manager.log({ type: "request", data: {} });

      await manager.flush();
      expect(mkdirSyncSpy).toHaveBeenCalledWith("/new/dir", { recursive: true });
    });

    it("restores entries to buffer on write failure", async () => {
      appendFileSpy.mockRejectedValue(new Error("Disk full"));
      manager.setLogFile("/path/session.jsonl", "s1");
      manager.log({ type: "request", data: {} });

      await manager.flush();
      expect(manager.getBufferSize()).toBe(1);
    });
  });

  describe("getLogContent", () => {
    it("returns empty array when no log file", async () => {
      const content = await manager.getLogContent();
      expect(content).toEqual([]);
    });

    it("returns parsed entries from log file", async () => {
      readFileSpy.mockResolvedValue(
        '{"type":"request","timestamp":"2024-01-01T00:00:00Z"}\n{"type":"response","timestamp":"2024-01-01T00:00:01Z"}\n'
      );
      manager.setLogFile("/path/session.jsonl", "s1");

      const content = await manager.getLogContent();
      expect(content).toHaveLength(2);
      expect(content[0].type).toBe("request");
      expect(content[1].type).toBe("response");
    });

    it("returns empty array on read error", async () => {
      readFileSpy.mockRejectedValue(new Error("Permission denied"));
      manager.setLogFile("/path/session.jsonl", "s1");

      const content = await manager.getLogContent();
      expect(content).toEqual([]);
    });
  });

  describe("setEnabled", () => {
    it("enables logging", () => {
      manager.setEnabled(false);
      expect(manager.isEnabled()).toBe(false);
      manager.setEnabled(true);
      expect(manager.isEnabled()).toBe(true);
    });

    it("clears buffer when disabled", () => {
      manager.setLogFile("/path/session.jsonl", "s1");
      manager.log({ type: "request", data: {} });
      expect(manager.getBufferSize()).toBe(1);

      manager.setEnabled(false);
      expect(manager.getBufferSize()).toBe(0);
    });
  });

  describe("periodic flush", () => {
    it("flushes buffer on interval", async () => {
      manager.setLogFile("/path/session.jsonl", "s1");
      manager.log({ type: "request", data: {} });

      expect(appendFileSpy).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(5000);
      expect(appendFileSpy).toHaveBeenCalledTimes(1);
    });
  });
});
