/**
 * Abort Handler 单元测试
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WebSocket } from "ws";
import type { WSContext } from "../../ws-router";
import { handleAbort } from "./abort";

describe("handleAbort", () => {
  let mockCtx: WSContext;
  let mockWs: Partial<WebSocket>;
  let mockSession: any;

  beforeEach(() => {
    mockWs = {
      send: vi.fn() as any,
      readyState: 1,
    };
    mockSession = {
      session: {},
      abort: vi.fn().mockResolvedValue(undefined),
    };
    mockCtx = {
      ws: mockWs as WebSocket,
      session: mockSession,
      connectionId: "test-conn-1",
      connectedAt: new Date(),
    };
  });

  it("should do nothing if session not initialized", async () => {
    mockCtx.session.session = null;

    await handleAbort(mockCtx, {});

    expect(mockWs.send).not.toHaveBeenCalled();
  });

  it("should call session.abort when session exists", async () => {
    await handleAbort(mockCtx, {});

    expect(mockSession.abort).toHaveBeenCalled();
  });

  it("should handle abort errors gracefully", async () => {
    mockSession.abort = vi.fn().mockRejectedValue(new Error("Abort failed"));

    // Should not throw
    await expect(handleAbort(mockCtx, {})).resolves.not.toThrow();
  });
});
