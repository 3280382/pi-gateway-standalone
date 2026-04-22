import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  checkPathExists,
  checkSessionInitialized,
  createHandler,
  sendError,
  sendSuccess,
  withErrorHandling,
  withLogging,
} from "./handler-utils.js";
import type { WSContext } from "../ws-router.js";

vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  return {
    default: actual,
    ...actual,
    existsSync: vi.fn(),
  };
});

import { existsSync } from "node:fs";

describe("handler-utils", () => {
  let mockWs: { send: ReturnType<typeof vi.fn> };
  let mockCtx: WSContext;

  beforeEach(() => {
    mockWs = { send: vi.fn() };
    mockCtx = {
      ws: mockWs as any,
      session: { session: { id: "test-session" } },
    } as WSContext;
    vi.clearAllMocks();
  });

  describe("sendSuccess", () => {
    it("sends success message with type and data", () => {
      sendSuccess(mockCtx, "ack", { foo: "bar" });
      expect(mockWs.send).toHaveBeenCalledTimes(1);
      const sent = JSON.parse(mockWs.send.mock.calls[0][0]);
      expect(sent).toEqual({ type: "ack", foo: "bar" });
    });

    it("sends success message without extra data", () => {
      sendSuccess(mockCtx, "ready");
      const sent = JSON.parse(mockWs.send.mock.calls[0][0]);
      expect(sent).toEqual({ type: "ready" });
    });
  });

  describe("sendError", () => {
    it("sends error message", () => {
      sendError(mockCtx, "Something went wrong");
      const sent = JSON.parse(mockWs.send.mock.calls[0][0]);
      expect(sent).toEqual({ type: "error", error: "Something went wrong" });
    });

    it("sends error with messageType", () => {
      sendError(mockCtx, "Failed", "prompt");
      const sent = JSON.parse(mockWs.send.mock.calls[0][0]);
      expect(sent).toEqual({ type: "error", error: "Failed", messageType: "prompt" });
    });
  });

  describe("checkSessionInitialized", () => {
    it("returns true when session exists", () => {
      expect(checkSessionInitialized(mockCtx)).toBe(true);
      expect(mockWs.send).not.toHaveBeenCalled();
    });

    it("returns false and sends error when session is missing", () => {
      mockCtx.session.session = null as any;
      expect(checkSessionInitialized(mockCtx)).toBe(false);
      expect(mockWs.send).toHaveBeenCalledTimes(1);
      const sent = JSON.parse(mockWs.send.mock.calls[0][0]);
      expect(sent.type).toBe("error");
      expect(sent.error).toContain("not initialized");
    });
  });

  describe("checkPathExists", () => {
    it("returns true when path exists", () => {
      vi.mocked(existsSync).mockReturnValue(true);
      expect(checkPathExists("/existing/path", mockCtx)).toBe(true);
      expect(mockWs.send).not.toHaveBeenCalled();
    });

    it("returns false and sends error when path does not exist", () => {
      vi.mocked(existsSync).mockReturnValue(false);
      expect(checkPathExists("/missing/path", mockCtx)).toBe(false);
      expect(mockWs.send).toHaveBeenCalledTimes(1);
      const sent = JSON.parse(mockWs.send.mock.calls[0][0]);
      expect(sent.error).toContain("does not exist");
    });
  });

  describe("withErrorHandling", () => {
    it("calls handler normally when no error", async () => {
      const handler = vi.fn().mockResolvedValue(undefined);
      const wrapped = withErrorHandling(handler);

      await wrapped(mockCtx);
      expect(handler).toHaveBeenCalledTimes(1);
      expect(mockWs.send).not.toHaveBeenCalled();
    });

    it("catches errors and sends error message", async () => {
      const handler = vi.fn().mockRejectedValue(new Error("Test error"));
      const wrapped = withErrorHandling(handler);

      await wrapped(mockCtx);
      expect(mockWs.send).toHaveBeenCalledTimes(1);
      const sent = JSON.parse(mockWs.send.mock.calls[0][0]);
      expect(sent.type).toBe("error");
      expect(sent.error).toBe("Test error");
    });

    it("handles non-Error thrown values", async () => {
      const handler = vi.fn().mockRejectedValue("string error");
      const wrapped = withErrorHandling(handler);

      await wrapped(mockCtx);
      const sent = JSON.parse(mockWs.send.mock.calls[0][0]);
      expect(sent.error).toContain("Error occurred");
    });
  });

  describe("createHandler", () => {
    it("creates handler with logging and error handling", async () => {
      const handler = vi.fn().mockResolvedValue(undefined);
      const wrapped = createHandler(handler, { name: "test-handler" });

      await wrapped(mockCtx);
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it("creates handler requiring session", async () => {
      const handler = vi.fn().mockResolvedValue(undefined);
      const wrapped = createHandler(handler, { name: "test-handler", requireSession: true });

      await wrapped(mockCtx);
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it("blocks handler when session required but missing", async () => {
      mockCtx.session.session = null as any;
      const handler = vi.fn().mockResolvedValue(undefined);
      const wrapped = createHandler(handler, { name: "test-handler", requireSession: true });

      await wrapped(mockCtx);
      expect(handler).not.toHaveBeenCalled();
      expect(mockWs.send).toHaveBeenCalledTimes(1);
    });

    it("wraps handler with error handling even with session check", async () => {
      const handler = vi.fn().mockRejectedValue(new Error("fail"));
      const wrapped = createHandler(handler, { name: "test-handler", requireSession: true });

      await wrapped(mockCtx);
      expect(mockWs.send).toHaveBeenCalledTimes(1);
      const sent = JSON.parse(mockWs.send.mock.calls[0][0]);
      expect(sent.error).toBe("fail");
    });
  });
});
