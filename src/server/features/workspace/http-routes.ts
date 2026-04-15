/**
 * Workspace Feature HTTP 路由注册
 * 集中注册所有工作区相关的 HTTP API 路由
 */

import type { Application } from "express";

/**
 * 注册 Workspace Feature 的所有 HTTP 路由
 */
export async function registerWorkspaceHTTPRoutes(app: Application): Promise<void> {
  const { current, workingDir, recent, addRecent, clearRecent } = await import(
    "./workspace.controller"
  );

  app.get("/api/workspace/current", current);
  app.get("/api/workspace/working-dir", workingDir);
  app.get("/api/workspace/recent", recent);
  app.post("/api/workspace/add-recent", addRecent);
  app.delete("/api/workspace/clear-recent", clearRecent);

  // Backward compatibility
  app.get("/api/working-dir", workingDir);
}
