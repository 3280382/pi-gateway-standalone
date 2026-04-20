/**
 * Workspace Feature HTTP route registration
 * Centralized registration of all workspace HTTP API routes
 */

import type { Application } from "express";

/**
 * Register all HTTP routes for Workspace Feature
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
