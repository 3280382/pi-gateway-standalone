/**
 * Workspace Controller - 工作区API控制器
 * 对应 /api/workspace/workspace/* 路由
 */

import type { Request, Response } from "express";

// 内存中存储最近工作区（重启后丢失，后续可改为持久化）
const recentWorkspaces = new Map<string, { path: string; name: string; lastAccessed: string }>();

/**
 * 获取当前工作区 - 对应 /api/workspace/workspace/current
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
 * 获取工作目录 - 对应 /api/workspace/workspace/working-dir
 */
export async function workingDir(_req: Request, res: Response) {
  res.json({
    cwd: process.cwd(),
  });
}

/**
 * 获取最近工作区 - 对应 /api/workspace/workspace/recent
 */
export async function recent(_req: Request, res: Response) {
  const workspaces = Array.from(recentWorkspaces.values())
    .sort((a, b) => new Date(b.lastAccessed).getTime() - new Date(a.lastAccessed).getTime())
    .slice(0, 10);
  res.json({ workspaces });
}

/**
 * 添加最近工作区 - 对应 /api/workspace/workspace/add-recent
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
 * 清除最近工作区 - 对应 /api/workspace/workspace/clear-recent
 */
export async function clearRecent(_req: Request, res: Response) {
  recentWorkspaces.clear();
  res.json({ success: true });
}