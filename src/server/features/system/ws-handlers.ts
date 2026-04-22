/**
 * System WebSocket Handlers
 * System info WebSocket handlers
 */

import { createHandler, sendError, sendSuccess } from "../chat/ws-handlers/handler-utils.js";
import type { WSContext } from "../chat/ws-router.js";
import { getPortUsageData } from "./port-usage.js";
import { getProcessOpenFiles, getProcessThreads, getProcessTreeData } from "./process-tree.js";

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
// Get Port Usage Handler
// ============================================================================

export async function handleGetPortUsage(ctx: WSContext, _payload: unknown): Promise<void> {
  try {
    const data = await getPortUsageData();

    sendSuccess(ctx, "port_usage_data", data);
  } catch (error) {
    sendError(ctx, error instanceof Error ? error.message : "Failed to get port usage");
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

export const handleGetPortUsageWrapped = createHandler(handleGetPortUsage, {
  name: "get_port_usage",
  requireSession: false,
});
