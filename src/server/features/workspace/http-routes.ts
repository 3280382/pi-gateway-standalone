/**
 * Workspace Feature HTTP 路由注册
 * 集中注册所有工作区相关的 HTTP API 路由
 */

import type { Application } from "express";

/**
 * 注册 Workspace Feature 的所有 HTTP 路由
 */
export async function registerWorkspaceHTTPRoutes(app: Application): Promise<void> {
  const { current, workingDir, recent, addRecent, clearRecent } = await import("./workspace/workspace.controller");

  app.get("/api/workspace/workspace/current", current);
  app.get("/api/workspace/workspace/working-dir", workingDir);
  app.get("/api/workspace/workspace/recent", recent);
  app.post("/api/workspace/workspace/add-recent", addRecent);
  app.delete("/api/workspace/workspace/clear-recent", clearRecent);
}