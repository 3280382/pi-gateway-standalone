/**
 * Workspace Controller - Workspace API controller
 * Corresponds to /api/workspace/* routes
 */

import type { Request, Response } from "express";

// Store recent workspaces in memory (lost after restart, can be persistent later)
const recentWorkspaces = new Map<string, { path: string; name: string; lastAccessed: string }>();

/**
 * Get current workspace - corresponds to /api/workspace/current
 */
export async function current(_req: Request, res: Response) {
  res.json({
    path: process.cwd(),
    name: process.cwd().split("/").pop() || "pi-gateway-standalone",
    isCurrent: true,
    sessionCount: 0,
    lastAccessed: new Date().toISOString(),
  });
}

/**
 * Get working directory - corresponds to /api/workspace/working-dir
 */
export async function workingDir(_req: Request, res: Response) {
  res.json({
    cwd: process.cwd(),
  });
}

/**
 * Get recent workspaces - corresponds to /api/workspace/recent
 */
export async function recent(_req: Request, res: Response) {
  const workspaces = Array.from(recentWorkspaces.values())
    .sort((a, b) => new Date(b.lastAccessed).getTime() - new Date(a.lastAccessed).getTime())
    .slice(0, 10);
  res.json({ workspaces });
}

/**
 * Add recent workspace - corresponds to /api/workspace/add-recent
 */
export async function addRecent(req: Request, res: Response) {
  const { path } = req.body;
  if (!path || typeof path !== "string") {
    return res.status(400).json({ error: "Path is required" });
  }
  const name = path.split("/").pop() || path;
  recentWorkspaces.set(path, {
    path,
    name,
    lastAccessed: new Date().toISOString(),
  });
  res.json({ success: true });
}

/**
 * Clear recent workspaces - corresponds to /api/workspace/clear-recent
 */
export async function clearRecent(_req: Request, res: Response) {
  recentWorkspaces.clear();
  res.json({ success: true });
}
