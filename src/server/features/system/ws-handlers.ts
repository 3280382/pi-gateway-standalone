/**
 * System WebSocket Handlers
 * 系统信息相关的 WebSocket 处理器
 */

import type { WSContext } from "../chat/ws-router";
import { createHandler, sendError, sendSuccess } from "../chat/ws-handlers/handler-utils";
import {
  getProcessTreeData,
  getProcessThreads,
  getProcessOpenFiles,
} from "./process-tree";

// ============================================================================
// Get Process Tree Handler
// ============================================================================

export async function handleGetProcessTree(
  ctx: WSContext,
  payload: { serverPid?: number }
): Promise<void> {
  const { serverPid } = payload;

  try {
    const data = await getProcessTreeData(serverPid);

    sendSuccess(ctx, "process_tree_data", data);
  } catch (error) {
    sendError(ctx, error instanceof Error ? error.message : "Failed to get process tree");
  }
}

// ============================================================================
// Get Process Details Handler
// ============================================================================

export async function handleGetProcessDetails(
  ctx: WSContext,
  payload: { pid: number }
): Promise<void> {
  const { pid } = payload;

  if (!pid) {
    sendError(ctx, "PID is required");
    return;
  }

  try {
    const [threads, openFiles] = await Promise.all([
      getProcessThreads(pid),
      getProcessOpenFiles(pid),
    ]);

    sendSuccess(ctx, "process_details", {
      pid,
      threads,
      openFiles,
      threadCount: threads.length,
    });
  } catch (error) {
    sendError(ctx, error instanceof Error ? error.message : "Failed to get process details");
  }
}

// ============================================================================
// Wrapped Handlers
// ============================================================================

export const handleGetProcessTreeWrapped = createHandler(handleGetProcessTree, {
  name: "get_process_tree",
  requireSession: false,
});

export const handleGetProcessDetailsWrapped = createHandler(handleGetProcessDetails, {
  name: "get_process_details",
  requireSession: false,
});
